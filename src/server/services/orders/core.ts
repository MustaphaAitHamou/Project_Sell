import "server-only";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { assertOrderTransition, type OrderActor } from "@/lib/domain/order-state";
import { track } from "@/server/analytics";
import { type db, type Tx } from "@/server/db/client";
import { enqueue } from "@/server/jobs/queue";
import { notify } from "@/server/notifications";
import { hashScopedCode, randomToken } from "@/server/security/crypto";
import { conflict } from "@/server/security/errors";
import { getNumberSetting } from "@/server/settings";
import { ledgerTemplates, postLedger } from "../ledger";

export type ActorRef = { type: OrderActor; id: string | null };
export const SYSTEM: ActorRef = { type: "SYSTEM", id: null };

type OrderRef = { id: string; status: OrderStatus; version: number };

/**
 * Transition contrôlée : arête autorisée pour l'acteur (machine à états), puis UPDATE
 * conditionnel sur (statut, version) — deux traitements concurrents ne peuvent pas
 * appliquer la même transition — et ligne d'historique immuable.
 */
export async function transitionOrder(
  tx: Tx,
  order: OrderRef,
  to: OrderStatus,
  actor: ActorRef,
  opts: { reason?: string; metadata?: Prisma.InputJsonValue; data?: Prisma.OrderUncheckedUpdateManyInput } = {},
): Promise<OrderRef> {
  assertOrderTransition(order.status, to, actor.type);
  const res = await tx.order.updateMany({
    where: { id: order.id, status: order.status, version: order.version },
    data: { ...opts.data, status: to, version: { increment: 1 } },
  });
  if (res.count !== 1) throw conflict("La commande a été modifiée entre-temps. Rechargez la page.");
  await tx.orderStatusHistory.create({
    data: { orderId: order.id, fromStatus: order.status, toStatus: to, actorType: actor.type, actorId: actor.id, reason: opts.reason ?? null, metadata: opts.metadata },
  });
  return { id: order.id, status: to, version: order.version + 1 };
}

/** Verrouille la commande (SELECT … FOR UPDATE) et relit son état dans la transaction. */
export async function lockOrder(tx: Tx, orderId: string) {
  await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${orderId}::uuid FOR UPDATE`;
  return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { pricing: true, items: true } });
}

/** Remise en stock après annulation ou remboursement (l'annonce redevient visible si demandé). */
export async function restockListing(tx: Tx, listingId: string, quantity: number, relist: boolean) {
  await tx.$executeRaw`
    UPDATE "listing" SET
      "quantityAvailable" = LEAST("quantity", "quantityAvailable" + ${quantity}),
      "status" = CASE WHEN ${relist} AND "status" IN ('RESERVED', 'SOLD') THEN 'ACTIVE'::"ListingStatus" ELSE "status" END,
      "soldAt" = CASE WHEN ${relist} AND "status" IN ('RESERVED', 'SOLD') THEN NULL ELSE "soldAt" END,
      "version" = "version" + 1,
      "updatedAt" = now()
    WHERE "id" = ${listingId}::uuid`;
}

/** Code de remise en main propre : dérivé (HMAC + poivre + sel), jamais stocké. */
export function deriveHandoverCode(orderId: string, salt: string): string {
  const digest = hashScopedCode(`handover:${orderId}`, salt);
  return String(parseInt(digest.slice(0, 12), 16) % 1_000_000).padStart(6, "0");
}

export function newHandoverSalt() {
  return randomToken(24);
}

/** Solde dû au vendeur pour une commande, lu dans le registre (crédits − débits du compte vendeur). */
export async function sellerPayableBalance(tx: Tx, orderId: string): Promise<number> {
  const rows = await tx.$queryRaw<{ balance: bigint | null }[]>`
    SELECT SUM(CASE WHEN e."direction" = 'CREDIT' THEN e."amount" ELSE -e."amount" END) AS balance
    FROM "ledger_entry" e JOIN "ledger_transaction" t ON t."id" = e."transactionId"
    WHERE t."orderId" = ${orderId}::uuid AND e."account" = 'seller_payable'`;
  return Number(rows[0]?.balance ?? 0);
}

/**
 * Clôture d'une commande : frais acquis, règlement du transport, création du versement
 * vendeur (éventuellement bloqué), compteurs de réputation, notifications.
 * Un événement de livraison ne déclenche jamais directement un versement : seule la
 * clôture (après la période de vérification, sans litige) le fait.
 */
export async function completeOrder(tx: Tx, order: OrderRef, actor: ActorRef, reason?: string) {
  const full = await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { pricing: true } });
  const next = await transitionOrder(tx, order, "COMPLETED", actor, { reason, data: { completedAt: new Date() } });
  const p = full.pricing!;
  const hasCapture = await tx.ledgerTransaction.findUnique({ where: { idempotencyKey: `capture:${full.id}` }, select: { id: true } });
  if (hasCapture) {
    if (p.buyerFee + p.sellerFee > 0)
      await postLedger(tx, { orderId: full.id, kind: "FEES_EARNED", currency: full.currency, idempotencyKey: `fees:${full.id}`, description: `Frais acquis — ${full.reference}`, lines: ledgerTemplates.feesEarned({ buyerFee: p.buyerFee, sellerFee: p.sellerFee }) });
    if (full.shippingAmount > 0)
      await postLedger(tx, { orderId: full.id, kind: "SHIPPING_SETTLED", currency: full.currency, idempotencyKey: `shipping:${full.id}`, description: `Règlement transport — ${full.reference}`, lines: ledgerTemplates.shippingSettled(full.shippingAmount) });
    const amount = await sellerPayableBalance(tx, full.id);
    if (amount > 0) {
      const payout = await tx.payout.upsert({
        where: { orderId: full.id },
        create: { orderId: full.id, sellerId: full.sellerId, amount, currency: full.currency, provider: (await tx.payment.findFirst({ where: { orderId: full.id, status: "SUCCEEDED", isDuplicate: false }, select: { provider: true } }))?.provider ?? "sandbox", idempotencyKey: `payout:${full.id}`, isSimulated: full.isSimulated, scheduledFor: new Date(Date.now() + (await getNumberSetting("payouts.delayHours")) * 3_600_000) },
        update: {},
      });
      await enqueue(tx, "payout.release", { payoutId: payout.id }, { dedupeKey: `payout.release:${payout.id}`, runAt: payout.scheduledFor ?? undefined });
    }
  }
  await tx.userProfile.update({ where: { userId: full.sellerId }, data: { salesCount: { increment: 1 } } });
  await tx.userProfile.update({ where: { userId: full.buyerId }, data: { purchasesCount: { increment: 1 } } });
  const link = `/commande/${full.id}`;
  await notify(tx, full.buyerId, { type: "ORDER_COMPLETED", title: `Commande ${full.reference} terminée`, body: "Merci ! Vous pouvez maintenant laisser un avis sur cette transaction.", link });
  await notify(tx, full.sellerId, { type: "ORDER_COMPLETED", title: `Vente ${full.reference} terminée`, body: "La transaction est terminée ; le versement du montant dû est en préparation.", link });
  await track("order.completed", { userId: full.buyerId, properties: { currency: full.currency, crossBorder: full.isCrossBorder } });
  return next;
}

export async function disputeWindowEnd() {
  return new Date(Date.now() + (await getNumberSetting("protection.disputeWindowHours")) * 3_600_000);
}

/** Livraison constatée (événement transporteur vérifié, code de remise, confirmation acheteur) → période de vérification. */
export async function markDelivered(tx: Tx, order: OrderRef, actor: ActorRef, reason: string) {
  const full = await tx.order.findUniqueOrThrow({ where: { id: order.id }, select: { reference: true, buyerId: true, sellerId: true } });
  const delivered = await transitionOrder(tx, order, "DELIVERED", actor, { reason, data: { deliveredAt: new Date() } });
  const endsAt = await disputeWindowEnd();
  const inWindow = await transitionOrder(tx, delivered, "DISPUTE_WINDOW", SYSTEM, { reason: "Ouverture de la période de vérification", data: { disputeWindowEndsAt: endsAt } });
  const link = `/commande/${order.id}`;
  await notify(tx, full.buyerId, {
    type: "ORDER_DELIVERED",
    title: `Commande ${full.reference} reçue`,
    body: "Vérifiez l'article. Confirmez que tout est conforme ou signalez un problème avant la fin de la période de vérification.",
    link,
  });
  await notify(tx, full.sellerId, { type: "ORDER_DELIVERED", title: `Vente ${full.reference} livrée`, body: "L'acheteur dispose d'une période de vérification avant la clôture de la vente.", link });
  return inWindow;
}

export async function getOrderRef(tx: Tx | typeof db, orderId: string): Promise<OrderRef> {
  return tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { id: true, status: true, version: true } });
}
