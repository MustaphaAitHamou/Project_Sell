import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getActivePaymentProvider, getPaymentProviderByCode } from "@/integrations/payment-providers/registry";
import { WebhookSignatureError, type NormalizedPaymentEvent } from "@/integrations/payment-providers/types";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/domain/money";
import { track } from "@/server/analytics";
import { audit } from "@/server/audit";
import { db, type Tx } from "@/server/db/client";
import { enqueue } from "@/server/jobs/queue";
import { logger } from "@/server/logger";
import { notify } from "@/server/notifications";
import { conflict, invalid, notFound, unavailable } from "@/server/security/errors";
import { ledgerTemplates, postLedger } from "./ledger";
import { completeOrder, getOrderRef, lockOrder, newHandoverSalt, restockListing, SYSTEM, transitionOrder } from "./orders/core";

// ─────────────────────────────── Sessions de paiement ───────────────────────────────

/** Crée une tentative de paiement et la session chez le prestataire ; la commande passe en attente de paiement. */
export async function startPaymentSession(orderId: string): Promise<string> {
  const provider = getActivePaymentProvider();
  if (!provider) throw unavailable("Aucun prestataire de paiement n'est configuré.");
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  if (!["CREATED", "PAYMENT_PENDING"].includes(order.status)) throw conflict("Cette commande n'est plus en attente de paiement.");
  const attempts = await db.payment.count({ where: { orderId } });
  if (attempts >= 5) throw conflict("Trop de tentatives de paiement pour cette commande.");
  const expiresAt = order.reservationExpiresAt ?? new Date(Date.now() + 30 * 60_000);
  const payment = await db.payment.create({
    data: { orderId, provider: provider.code, idempotencyKey: `pay:${orderId}:${attempts + 1}`, amount: order.totalAmount, currency: order.currency, isSimulated: provider.isSandbox, expiresAt },
  });
  const session = await provider.createPayment({
    paymentId: payment.id,
    orderId,
    reference: order.reference,
    amount: order.totalAmount,
    currency: order.currency,
    description: `Tamurt Market — ${order.items[0]?.title ?? order.reference}`,
    idempotencyKey: payment.idempotencyKey,
    returnUrl: new URL(`/commande/${orderId}`, env.APP_URL).toString(),
    cancelUrl: new URL(`/commande/${orderId}?paiement=annule`, env.APP_URL).toString(),
    expiresAt,
  });
  await db.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: payment.id }, data: { providerSessionId: session.providerSessionId } });
    const ref = await getOrderRef(tx, orderId);
    if (ref.status === "CREATED") await transitionOrder(tx, ref, "PAYMENT_PENDING", SYSTEM, { reason: "Session de paiement créée", data: { reservationExpiresAt: expiresAt } });
  });
  return session.redirectUrl;
}

// ─────────────────────────────── Webhooks ───────────────────────────────

export type WebhookOutcome = { status: number; body: Record<string, unknown> };

/**
 * Traitement d'un webhook de prestataire de paiement :
 * 1. signature vérifiée (sinon 400, rien n'est traité) ;
 * 2. enregistrement unique (source, identifiant d'événement) : un rejeu est sans effet ;
 * 3. traitement transactionnel ; en cas d'erreur, l'événement reste rejouable.
 */
export async function handlePaymentWebhook(providerCode: string, rawBody: string, headers: Headers): Promise<WebhookOutcome> {
  const provider = getPaymentProviderByCode(providerCode);
  if (!provider) return { status: 404, body: { error: "unknown_provider" } };
  let event: NormalizedPaymentEvent;
  try {
    event = provider.parseWebhook(rawBody, headers);
  } catch (e) {
    logger.warn("payment.webhook.rejected", { provider: providerCode, reason: e instanceof WebhookSignatureError ? "signature" : "payload" });
    return { status: 400, body: { error: "invalid_signature" } };
  }
  if (!event.eventId) return { status: 400, body: { error: "missing_event_id" } };
  const source = `payment:${providerCode}`;
  let record = await db.webhookEvent.findUnique({ where: { source_eventId: { source, eventId: event.eventId } } });
  if (record?.status === "PROCESSED" || record?.status === "IGNORED") return { status: 200, body: { received: true, duplicate: true } };
  if (!record) {
    try {
      record = await db.webhookEvent.create({ data: { source, eventId: event.eventId, eventType: event.type, payload: JSON.parse(rawBody) as Prisma.InputJsonValue, signatureValid: true } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { status: 200, body: { received: true, duplicate: true } };
      throw e;
    }
  }
  try {
    const outcome = await processPaymentEvent(providerCode, event);
    await db.webhookEvent.update({ where: { id: record.id }, data: { status: outcome === "ignored" ? "IGNORED" : "PROCESSED", processedAt: new Date(), attempts: { increment: 1 }, lastError: null } });
    return { status: 200, body: { received: true, outcome } };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.webhookEvent.update({ where: { id: record.id }, data: { status: "FAILED", attempts: { increment: 1 }, lastError: message.slice(0, 1000) } });
    logger.error("payment.webhook.failed", { provider: providerCode, eventType: event.type, error: message });
    return { status: 500, body: { error: "processing_failed" } };
  }
}

/** Rejoue les événements en échec (tâche de maintenance ou action d'administration). */
export async function replayFailedWebhooks(limit = 20) {
  const failed = await db.webhookEvent.findMany({ where: { status: "FAILED", source: { startsWith: "payment:" }, attempts: { lt: 10 } }, take: limit, orderBy: { receivedAt: "asc" } });
  let ok = 0;
  for (const w of failed) {
    const provider = getPaymentProviderByCode(w.source.split(":")[1]!);
    if (!provider) continue;
    try {
      // L'événement a déjà été authentifié à sa réception : on le renormalise depuis sa charge utile.
      const event = normalizeStored(w.eventType, w.eventId, w.payload as Record<string, unknown>);
      const outcome = await processPaymentEvent(provider.code, event);
      await db.webhookEvent.update({ where: { id: w.id }, data: { status: outcome === "ignored" ? "IGNORED" : "PROCESSED", processedAt: new Date(), attempts: { increment: 1 }, lastError: null } });
      ok++;
    } catch (e) {
      await db.webhookEvent.update({ where: { id: w.id }, data: { attempts: { increment: 1 }, lastError: (e instanceof Error ? e.message : String(e)).slice(0, 1000) } });
    }
  }
  return ok;
}

function normalizeStored(type: string, eventId: string, payload: Record<string, unknown>): NormalizedPaymentEvent {
  const data = (payload.data ?? {}) as Record<string, unknown>;
  if (type === "payment.succeeded")
    return { eventId, type, providerSessionId: String(data.session), providerPaymentId: String(data.payment), amount: Number(data.amount), currency: String(data.currency), providerFeeAmount: data.fee == null ? null : Number(data.fee) };
  if (type === "payment.failed") return { eventId, type, providerSessionId: String(data.session), code: String(data.code ?? ""), message: String(data.message ?? "") };
  if (type === "payment.expired") return { eventId, type, providerSessionId: String(data.session) };
  return { eventId, type: "ignored", rawType: type };
}

async function processPaymentEvent(providerCode: string, event: NormalizedPaymentEvent): Promise<string> {
  switch (event.type) {
    case "payment.succeeded":
      return onPaymentSucceeded(providerCode, event);
    case "payment.failed": {
      const payment = await db.payment.findUnique({ where: { providerSessionId: event.providerSessionId }, include: { order: { select: { id: true, buyerId: true, reference: true, status: true } } } });
      if (!payment) throw new Error("Paiement inconnu");
      if (payment.status === "SUCCEEDED") return "ignored_after_success";
      await db.$transaction(async (tx) => {
        await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureCode: event.code.slice(0, 80), failureMessage: event.message.slice(0, 500) } });
        await notify(tx, payment.order.buyerId, {
          type: "SYSTEM",
          title: `Paiement refusé — commande ${payment.order.reference}`,
          body: "Votre paiement n'a pas abouti. Vous pouvez réessayer tant que la réservation de l'article est active.",
          link: `/commande/${payment.order.id}`,
        });
      });
      return "payment_failed";
    }
    case "payment.expired":
      await db.payment.updateMany({ where: { providerSessionId: event.providerSessionId, status: { in: ["REQUIRES_ACTION", "PROCESSING"] } }, data: { status: "EXPIRED" } });
      return "payment_expired";
    default:
      return "ignored";
  }
}

async function onPaymentSucceeded(providerCode: string, event: Extract<NormalizedPaymentEvent, { type: "payment.succeeded" }>): Promise<string> {
  // Contrôle préalable hors transaction : l'alerte d'audit doit survivre au rejet de l'événement
  // (le montant d'un paiement est figé à sa création, le contrôle est donc fiable).
  const pre = await db.payment.findUnique({ where: { providerSessionId: event.providerSessionId }, select: { id: true, provider: true, amount: true, currency: true } });
  if (pre && pre.provider === providerCode && (event.amount !== pre.amount || event.currency !== pre.currency)) {
    await audit({ actorId: null, action: "payment.amount_mismatch", targetType: "payment", targetId: pre.id, metadata: { expected: pre.amount, received: event.amount, currency: event.currency } });
    throw new Error("Montant ou devise du paiement incohérent avec la commande");
  }
  return db.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { providerSessionId: event.providerSessionId } });
    if (!payment || payment.provider !== providerCode) throw new Error("Paiement inconnu pour ce prestataire");
    if (payment.status === "SUCCEEDED") return "already_processed";
    // Défense en profondeur : jamais de passage en « payé » avec un montant incohérent.
    if (event.amount !== payment.amount || event.currency !== payment.currency) throw new Error("Montant ou devise du paiement incohérent avec la commande");
    const order = await lockOrder(tx, payment.orderId);
    const isEffective = order.status === "PAYMENT_PENDING" || order.status === "CREATED";
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCEEDED", providerPaymentId: event.providerPaymentId, providerFeeAmount: event.providerFeeAmount, succeededAt: new Date(), isDuplicate: !isEffective },
    });

    if (!isEffective) {
      // Paiement arrivé après expiration/annulation, ou en double : remboursement automatique intégral.
      await postLedger(tx, { orderId: order.id, kind: "UNALLOCATED_RECEIPT", currency: order.currency, idempotencyKey: `unallocated:${payment.id}`, description: `Encaissement non affecté — ${order.reference}`, lines: ledgerTemplates.unallocatedReceipt(payment.amount) });
      await requestRefund(tx, { orderId: order.id, paymentId: payment.id, amount: payment.amount, reason: "Paiement en double ou reçu après expiration de la réservation", kind: "UNALLOCATED", initiatedById: null });
      return "duplicate_refunded";
    }

    const p = order.pricing!;
    let ref = await transitionOrder(tx, order, "PAID", SYSTEM, { reason: "Paiement confirmé par webhook signé", data: { paidAt: new Date() } });
    await postLedger(tx, {
      orderId: order.id,
      kind: "PAYMENT_CAPTURED",
      currency: order.currency,
      idempotencyKey: `capture:${order.id}`,
      description: `Paiement ${order.reference}`,
      lines: ledgerTemplates.paymentCaptured({ total: p.totalAmount, sellerNet: p.sellerNetAmount, sellerFee: p.sellerFee, buyerFee: p.buyerFee, shipping: p.shippingAmount, tax: p.taxAmount }),
    });
    if (event.providerFeeAmount && event.providerFeeAmount > 0)
      await postLedger(tx, { orderId: order.id, kind: "PSP_FEE", currency: order.currency, idempotencyKey: `pspfee:${payment.id}`, description: `Frais prestataire ${order.reference}`, lines: ledgerTemplates.pspFee(event.providerFeeAmount) });

    // L'article est vendu dès le paiement (un exemplaire unique ne peut plus être acheté).
    await tx.$executeRaw`UPDATE "listing" SET "status" = 'SOLD'::"ListingStatus", "soldAt" = now(), "version" = "version" + 1, "updatedAt" = now() WHERE "id" = ${order.listingId}::uuid AND "quantityAvailable" = 0 AND "status" = 'RESERVED'`;

    ref = await transitionOrder(tx, ref, "SHIPPING_PENDING", SYSTEM, {
      reason: order.deliveryMethod === "HAND_DELIVERY" ? "En attente de remise en main propre" : "En attente d'expédition",
      data: order.deliveryMethod === "HAND_DELIVERY" ? { handoverSalt: newHandoverSalt() } : undefined,
    });

    const reservation = await tx.transportReservation.findFirst({ where: { orderId: order.id, status: "HELD" } });
    if (reservation) await enqueue(tx, "transport.reservation.confirm", { reservationId: reservation.id }, { dedupeKey: `transport.confirm:${reservation.id}`, maxAttempts: 8 });

    const link = `/commande/${order.id}`;
    const total = formatMoney(p.totalAmount, order.currency);
    await notify(tx, order.buyerId, { type: "PAYMENT_CONFIRMED", title: `Paiement confirmé — ${order.reference}`, body: `Votre paiement de ${total} est confirmé. Le vendeur est prévenu.`, link });
    await notify(tx, order.sellerId, {
      type: "NEW_ORDER",
      title: `Nouvelle vente — ${order.reference}`,
      body: order.deliveryMethod === "HAND_DELIVERY" ? "Convenez d'un rendez-vous avec l'acheteur ; demandez-lui son code de remise lors de l'échange." : "Préparez le colis et générez l'étiquette d'expédition depuis votre espace vendeur.",
      link: `/compte/ventes?commande=${order.id}`,
    });
    await track("payment.succeeded", { userId: order.buyerId, properties: { currency: order.currency, method: order.deliveryMethod } });
    return "paid";
  });
}

// ─────────────────────────────── Remboursements ───────────────────────────────

/**
 * Demande de remboursement (toujours exécutée par le prestataire de paiement concerné,
 * via la file de tâches avec clé d'idempotence). Le statut local ne change qu'à sa réponse.
 */
export async function requestRefund(
  tx: Tx,
  input: { orderId: string; paymentId?: string; amount: number; reason: string; kind: "FULL" | "PARTIAL" | "UNALLOCATED"; initiatedById: string | null; disputeId?: string; relist?: boolean },
) {
  const payment = input.paymentId
    ? await tx.payment.findUniqueOrThrow({ where: { id: input.paymentId } })
    : await tx.payment.findFirst({ where: { orderId: input.orderId, status: "SUCCEEDED", isDuplicate: false } });
  if (!payment) throw notFound("Aucun paiement à rembourser.");
  const already = await tx.refund.aggregate({ where: { paymentId: payment.id, status: { in: ["PENDING", "SUCCEEDED"] } }, _sum: { amount: true } });
  if ((already._sum.amount ?? 0) + input.amount > payment.amount) throw invalid("Le montant remboursé dépasserait le montant payé.");
  const refund = await tx.refund.create({
    data: {
      orderId: input.orderId,
      paymentId: payment.id,
      disputeId: input.disputeId ?? null,
      amount: input.amount,
      currency: payment.currency,
      reason: input.reason.slice(0, 500),
      includesShipping: input.kind === "FULL",
      idempotencyKey: `refund:${payment.id}:${(await tx.refund.count({ where: { paymentId: payment.id } })) + 1}`,
      initiatedById: input.initiatedById,
    },
  });
  await enqueue(tx, "refund.execute", { refundId: refund.id, kind: input.kind, relist: input.relist ?? true }, { dedupeKey: `refund.execute:${refund.id}`, maxAttempts: 8 });
  return refund;
}

export async function executeRefund(payload: { refundId: string; kind: "FULL" | "PARTIAL" | "UNALLOCATED"; relist: boolean }) {
  const refund = await db.refund.findUnique({ where: { id: payload.refundId }, include: { payment: true } });
  if (!refund || refund.status !== "PENDING") return;
  const provider = getPaymentProviderByCode(refund.payment.provider);
  if (!provider) throw new Error(`Prestataire ${refund.payment.provider} indisponible`);
  if (!refund.payment.providerPaymentId) throw new Error("Paiement sans référence prestataire");
  const res = await provider.refund({ providerPaymentId: refund.payment.providerPaymentId, amount: refund.amount, currency: refund.currency, idempotencyKey: refund.idempotencyKey, reason: refund.reason });
  if (res.status === "PENDING") {
    await db.refund.update({ where: { id: refund.id }, data: { providerRefundId: res.providerRefundId } });
    return;
  }
  if (res.status === "FAILED") {
    await db.refund.update({ where: { id: refund.id }, data: { status: "FAILED", providerRefundId: res.providerRefundId, failureMessage: "Refusé par le prestataire" } });
    await audit({ actorId: null, action: "refund.failed", targetType: "refund", targetId: refund.id });
    return;
  }
  await db.$transaction(async (tx) => {
    const updated = await tx.refund.updateMany({ where: { id: refund.id, status: "PENDING" }, data: { status: "SUCCEEDED", providerRefundId: res.providerRefundId, succeededAt: new Date() } });
    if (updated.count !== 1) return;
    await tx.payment.update({ where: { id: refund.paymentId }, data: { amountRefunded: { increment: refund.amount } } });
    const order = await lockOrder(tx, refund.orderId);
    const p = order.pricing!;
    if (payload.kind === "UNALLOCATED") {
      await postLedger(tx, { orderId: order.id, kind: "UNALLOCATED_REFUND", currency: order.currency, idempotencyKey: `refund-ledger:${refund.id}`, description: `Remboursement automatique — ${order.reference}`, lines: ledgerTemplates.unallocatedRefund(refund.amount) });
      return;
    }
    if (payload.kind === "FULL") {
      await postLedger(tx, {
        orderId: order.id,
        kind: "REFUND",
        currency: order.currency,
        idempotencyKey: `refund-ledger:${refund.id}`,
        description: `Remboursement intégral — ${order.reference}`,
        lines: ledgerTemplates.fullRefund({ total: p.totalAmount, sellerNet: p.sellerNetAmount, sellerFee: p.sellerFee, buyerFee: p.buyerFee, shipping: p.shippingAmount, tax: p.taxAmount }),
      });
      if (order.status === "REFUND_PENDING") {
        await transitionOrder(tx, order, "REFUNDED", SYSTEM, { reason: "Remboursement confirmé par le prestataire" });
        const wasShipped = !!order.shippedAt;
        if (!wasShipped) await restockListing(tx, order.listingId, order.items[0]?.quantity ?? 1, payload.relist);
      }
    } else {
      await postLedger(tx, { orderId: order.id, kind: "REFUND_PARTIAL", currency: order.currency, idempotencyKey: `refund-ledger:${refund.id}`, description: `Remboursement partiel — ${order.reference}`, lines: ledgerTemplates.partialRefund(refund.amount) });
      if (order.status === "REFUND_PENDING") await completeOrder(tx, order, SYSTEM, "Remboursement partiel confirmé ; solde versé au vendeur");
    }
    await notify(tx, order.buyerId, {
      type: "REFUND_ISSUED",
      title: `Remboursement — ${order.reference}`,
      body: `Un remboursement de ${formatMoney(refund.amount, refund.currency)} a été émis. Le délai d'apparition sur votre compte dépend de votre banque.`,
      link: `/commande/${order.id}`,
    });
  });
}

// ─────────────────────────────── Versements ───────────────────────────────

async function payoutBlockReason(tx: Tx | typeof db, payout: { sellerId: string; orderId: string; provider: string }) {
  const openDispute = await tx.dispute.findFirst({ where: { orderId: payout.orderId, status: { notIn: ["RESOLVED", "CLOSED"] } }, select: { id: true } });
  if (openDispute) return "Litige en cours sur la commande.";
  const account = await tx.payoutAccount.findUnique({ where: { userId_provider: { userId: payout.sellerId, provider: payout.provider } } });
  if (!account || !account.payoutsEnabled) return "Compte de versement non configuré par le vendeur.";
  const country = await tx.country.findUnique({ where: { code: account.countryCode }, select: { payoutsEnabled: true } });
  const provider = getPaymentProviderByCode(payout.provider);
  if (!country?.payoutsEnabled || !provider?.capabilities.payoutCountries.includes(account.countryCode))
    return "Versements non disponibles vers le pays de résidence du vendeur (prestataire ou réglementation non validés).";
  return null;
}

/** Libération d'un versement : vérifications, appel prestataire idempotent, écriture comptable. */
export async function releasePayout(payoutId: string) {
  const payout = await db.payout.findUnique({ where: { id: payoutId } });
  if (!payout || !["PENDING", "BLOCKED"].includes(payout.status)) return;
  const reason = await payoutBlockReason(db, payout);
  if (reason) {
    await db.payout.update({ where: { id: payout.id }, data: { status: "BLOCKED", blockedReason: reason } });
    return;
  }
  const claimed = await db.payout.updateMany({ where: { id: payout.id, status: { in: ["PENDING", "BLOCKED"] } }, data: { status: "PROCESSING", blockedReason: null } });
  if (claimed.count !== 1) return;
  const provider = getPaymentProviderByCode(payout.provider)!;
  const account = await db.payoutAccount.findUniqueOrThrow({ where: { userId_provider: { userId: payout.sellerId, provider: payout.provider } } });
  const order = await db.order.findUniqueOrThrow({ where: { id: payout.orderId }, select: { reference: true } });
  try {
    const res = await provider.payout({ amount: payout.amount, currency: payout.currency, destinationAccountId: account.providerAccountId, idempotencyKey: payout.idempotencyKey, reference: order.reference });
    await db.$transaction(async (tx) => {
      if (res.status === "FAILED") {
        await tx.payout.update({ where: { id: payout.id }, data: { status: "FAILED", providerTransferId: res.providerTransferId, failureMessage: "Refusé par le prestataire" } });
        return;
      }
      await tx.payout.update({ where: { id: payout.id }, data: { status: res.status === "PAID" ? "PAID" : "PROCESSING", providerTransferId: res.providerTransferId, paidAt: res.status === "PAID" ? new Date() : null } });
      if (res.status === "PAID") {
        await postLedger(tx, { orderId: payout.orderId, kind: "PAYOUT", currency: payout.currency, idempotencyKey: `payout-ledger:${payout.id}`, description: `Versement vendeur — ${order.reference}`, lines: ledgerTemplates.payout(payout.amount) });
        await notify(tx, payout.sellerId, { type: "PAYOUT_SENT", title: `Versement envoyé — ${order.reference}`, body: `${formatMoney(payout.amount, payout.currency)} ont été versés sur votre compte de versement.`, link: "/compte/paiements" });
      }
    });
  } catch (e) {
    await db.payout.update({ where: { id: payout.id }, data: { status: "FAILED", failureMessage: (e instanceof Error ? e.message : String(e)).slice(0, 500) } });
    throw e;
  }
}

/** Relance des versements bloqués dont la cause a pu disparaître (compte configuré, litige clos). */
export async function retryBlockedPayouts(limit = 50) {
  const blocked = await db.payout.findMany({ where: { status: "BLOCKED" }, take: limit, select: { id: true } });
  for (const p of blocked) await releasePayout(p.id).catch((e) => logger.warn("payout.retry_failed", { payoutId: p.id, error: e }));
  return blocked.length;
}

/** Activation du compte de versement du vendeur auprès du prestataire (simulé en développement). */
export async function enablePayoutAccount(user: { id: string; profile: { countryCode: string | null } | null }) {
  const provider = getActivePaymentProvider();
  if (!provider) throw unavailable("Aucun prestataire de paiement n'est configuré.");
  const countryCode = user.profile?.countryCode ?? "FR";
  if (!provider.capabilities.payoutCountries.includes(countryCode)) throw unavailable("Les versements ne sont pas disponibles vers votre pays de résidence pour le moment.");
  const existing = await db.payoutAccount.findUnique({ where: { userId_provider: { userId: user.id, provider: provider.code } } });
  if (existing) return existing;
  const country = await db.country.findUniqueOrThrow({ where: { code: countryCode } });
  const res = await provider.createPayoutAccount({ userId: user.id, countryCode, currency: country.currency });
  const account = await db.payoutAccount.create({
    data: { userId: user.id, provider: provider.code, providerAccountId: res.providerAccountId, countryCode, currency: country.currency, payoutsEnabled: res.payoutsEnabled, isSimulated: provider.isSandbox },
  });
  await retryBlockedPayouts();
  return account;
}
