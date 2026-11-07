import "server-only";
import { Prisma, type DeliveryMethod } from "@/generated/prisma/client";
import { getShippingAdapter } from "@/integrations/shipping-providers/registry";
import { PARCEL_SIZE_MAX_GRAMS } from "@/features/listings/schemas";
import { generateOrderReference, listingPath } from "@/lib/domain/ids";
import { MoneyError } from "@/lib/domain/money";
import { computeOrderPricing, type PricingResult } from "@/lib/domain/pricing";
import { track } from "@/server/analytics";
import type { CurrentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { enqueue } from "@/server/jobs/queue";
import { logger } from "@/server/logger";
import { conflict, invalid, notFound, precondition } from "@/server/security/errors";
import { rateLimit } from "@/server/security/rate-limit";
import { getNumberSetting } from "@/server/settings";
import { getOwnedAddress, listAddresses } from "../addresses";
import { BLOCK_REASON_LABELS, getPurchaseEligibility, type PurchaseEligibility } from "../eligibility";
import { getActiveBuyerFeeRule, getActiveSellerFeeRule } from "../fees";
import { startPaymentSession } from "../payments";
import { holdTransportForOrder } from "../transport-orders";
import { restockListing, SYSTEM, transitionOrder } from "./core";

type ShippingChoice = { provider: string; amount: number; currency: string; quoteId: string | null; serviceName: string; etaMin: number | null; etaMax: number | null; isSimulated: boolean };

export interface CheckoutPreview {
  listing: {
    id: string;
    title: string;
    priceAmount: number;
    currency: string;
    countryCode: string;
    sellerName: string;
    sellerHandle: string | null;
    imageId: string | null;
    deliveryMethods: DeliveryMethod[];
    isDemo: boolean;
    path: string;
  };
  eligibility: PurchaseEligibility;
  method: DeliveryMethod | null;
  shipping: ShippingChoice | null;
  pricing: PricingResult | null;
  pricingError: string | null;
  addresses: Awaited<ReturnType<typeof listAddresses>>;
  selectedAddressId: string | null;
  requiresAddress: boolean;
}

async function loadListing(listingId: string) {
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    include: { seller: { select: { status: true, profile: { select: { displayName: true, handle: true, sellerType: true } } } }, images: { take: 1, orderBy: { sortOrder: "asc" }, select: { id: true } } },
  });
  if (!listing || listing.status === "DELETED") throw notFound("Annonce introuvable.");
  return listing;
}

/** Devis de livraison calculé et enregistré côté serveur (seul son identifiant transite). */
async function resolveShipping(
  user: Pick<CurrentUser, "id">,
  listing: Awaited<ReturnType<typeof loadListing>>,
  method: DeliveryMethod,
  carrier: string | null,
  ctx: { destinationCountry: string; transportQuoteId?: string | null },
): Promise<ShippingChoice> {
  if (method === "HAND_DELIVERY") return { provider: "hand_delivery", amount: 0, currency: listing.currency, quoteId: null, serviceName: "Remise en main propre", etaMin: null, etaMax: null, isSimulated: false };
  if (method === "NATIONAL_SHIPPING") {
    const adapter = carrier ? getShippingAdapter(carrier) : null;
    if (!adapter || !listing.parcelSize) throw precondition("La livraison nationale n'est pas disponible pour cet article.");
    const reusable = await db.shippingQuote.findFirst({
      where: { listingId: listing.id, buyerId: user.id, providerCode: adapter.code, usedByOrderId: null, expiresAt: { gt: new Date(Date.now() + 5 * 60_000) }, destinationCountry: ctx.destinationCountry },
      orderBy: { createdAt: "desc" },
    });
    const quote =
      reusable ??
      (await (async () => {
        const q = await adapter.quote({ originCountry: listing.countryCode, destinationCountry: ctx.destinationCountry, parcelSize: listing.parcelSize!, weightGrams: listing.weightGrams, currency: listing.currency });
        if (!q) throw precondition("Aucun tarif de livraison disponible pour cet envoi.");
        return db.shippingQuote.create({
          data: {
            listingId: listing.id,
            buyerId: user.id,
            providerCode: adapter.code,
            serviceCode: q.serviceCode,
            serviceName: q.serviceName,
            amount: q.amount,
            currency: q.currency,
            originCountry: listing.countryCode,
            destinationCountry: ctx.destinationCountry,
            estimatedDaysMin: q.estimatedDaysMin,
            estimatedDaysMax: q.estimatedDaysMax,
            isSimulated: adapter.isSandbox,
            expiresAt: new Date(Date.now() + 30 * 60_000),
          },
        });
      })());
    return { provider: quote.providerCode, amount: quote.amount, currency: quote.currency, quoteId: quote.id, serviceName: quote.serviceName, etaMin: quote.estimatedDaysMin, etaMax: quote.estimatedDaysMax, isSimulated: quote.isSimulated };
  }
  // Tamurt Transport : devis préalablement obtenu via getTransportQuotes et revérifié ici.
  if (!ctx.transportQuoteId) throw precondition("Choisissez un trajet Tamurt Transport.");
  const quote = await db.shippingQuote.findUnique({ where: { id: ctx.transportQuoteId } });
  if (!quote || quote.listingId !== listing.id || quote.providerCode !== "tamurt_transport" || (quote.buyerId && quote.buyerId !== user.id)) throw notFound("Devis Tamurt Transport introuvable.");
  if (quote.usedByOrderId) throw conflict("Ce devis a déjà été utilisé.");
  if (quote.expiresAt < new Date()) throw precondition("Ce devis a expiré : demandez un nouveau devis.");
  if (quote.destinationCountry !== ctx.destinationCountry) throw invalid("Le devis ne correspond pas au pays de livraison.");
  const details = (quote.details ?? {}) as { bookable?: boolean };
  if (!details.bookable) throw precondition("Ce trajet n'est pas ouvert aux réservations.");
  return { provider: "tamurt_transport", amount: quote.amount, currency: quote.currency, quoteId: quote.id, serviceName: quote.serviceName, etaMin: quote.estimatedDaysMin, etaMax: quote.estimatedDaysMax, isSimulated: quote.isSimulated };
}

/** Aperçu de paiement : montants calculés exclusivement côté serveur. */
export async function getCheckoutPreview(
  user: CurrentUser,
  listingId: string,
  opts: { deliveryMethod?: DeliveryMethod | null; addressId?: string | null; transportQuoteId?: string | null } = {},
): Promise<CheckoutPreview> {
  const listing = await loadListing(listingId);
  const addresses = await listAddresses(user);
  const address = opts.addressId ? await getOwnedAddress(user, opts.addressId) : (addresses.find((a) => a.isDefault) ?? addresses[0] ?? null);
  const shippingMethod = opts.deliveryMethod && opts.deliveryMethod !== "HAND_DELIVERY";
  const destinationCountry = shippingMethod && address ? address.countryCode : listing.countryCode;
  // Pays du payeur = pays du profil de l'acheteur ; pays de destination = adresse de livraison.
  const eligibility = await getPurchaseEligibility({ ...listing, sellerStatus: listing.seller.status }, { id: user.id, countryCode: user.profile?.countryCode ?? destinationCountry }, destinationCountry);
  const available = eligibility.methods.filter((m) => m.available);
  const method = (opts.deliveryMethod && available.some((m) => m.method === opts.deliveryMethod) ? opts.deliveryMethod : (available[0]?.method ?? null)) as DeliveryMethod | null;

  let shipping: ShippingChoice | null = null;
  let pricing: PricingResult | null = null;
  let pricingError: string | null = null;
  if (eligibility.purchasable && method) {
    try {
      const carrier = eligibility.methods.find((m) => m.method === method)?.carrier ?? null;
      shipping = await resolveShipping(user, listing, method, carrier, { destinationCountry, transportQuoteId: opts.transportQuoteId });
      const [buyerFeeRule, sellerFeeRule] = await Promise.all([
        getActiveBuyerFeeRule(listing.currency, listing.countryCode),
        getActiveSellerFeeRule(listing.currency, listing.countryCode, listing.seller.profile?.sellerType ?? "INDIVIDUAL"),
      ]);
      pricing = computeOrderPricing({
        currency: listing.currency,
        unitPrice: listing.priceAmount,
        quantity: 1,
        buyerFeeRule,
        sellerFeeRule,
        shipping: method === "HAND_DELIVERY" ? null : { amount: shipping.amount, currency: shipping.currency, provider: shipping.provider, quoteId: shipping.quoteId },
        tax: eligibility.isCrossBorder ? { amount: 0, status: "UNKNOWN", note: "Droits et taxes d'importation non connus, susceptibles d'être exigés à la livraison." } : null,
      });
    } catch (e) {
      if (e instanceof MoneyError) pricingError = e.message;
      else if (e instanceof Error && e.name === "AppError") pricingError = e.message;
      else throw e;
    }
  }
  return {
    listing: {
      id: listing.id,
      title: listing.title,
      priceAmount: listing.priceAmount,
      currency: listing.currency,
      countryCode: listing.countryCode,
      sellerName: listing.seller.profile?.displayName ?? "Vendeur",
      sellerHandle: listing.seller.profile?.handle ?? null,
      imageId: listing.images[0]?.id ?? null,
      deliveryMethods: listing.deliveryMethods,
      isDemo: listing.isDemo,
      path: listingPath(listing.slug, listing.publicId),
    },
    eligibility,
    method,
    shipping,
    pricing,
    pricingError,
    addresses,
    selectedAddressId: address?.id ?? null,
    requiresAddress: !!method && method !== "HAND_DELIVERY",
  };
}

/**
 * Création de commande. Le navigateur ne transmet que l'annonce, le mode de remise,
 * l'adresse, l'identifiant du devis et une clé d'idempotence : AUCUN montant. Tout prix
 * est recalculé ici à partir des valeurs en base.
 */
export async function createOrder(
  user: CurrentUser,
  input: { listingId: string; deliveryMethod: DeliveryMethod; addressId?: string | null; transportQuoteId?: string | null; idempotencyKey: string },
): Promise<{ orderId: string; redirectUrl: string; replayed: boolean }> {
  const existing = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.buyerId !== user.id) throw conflict("Requête invalide.");
    return { orderId: existing.id, redirectUrl: `/commande/${existing.id}`, replayed: true };
  }
  await rateLimit(`order.create:${user.id}`, 10, 600);
  if (!user.emailVerified) throw precondition("Confirmez votre adresse email avant d'acheter.");

  const preview = await getCheckoutPreview(user, input.listingId, { deliveryMethod: input.deliveryMethod, addressId: input.addressId, transportQuoteId: input.transportQuoteId });
  if (!preview.eligibility.purchasable) throw precondition(BLOCK_REASON_LABELS[preview.eligibility.reasons[0]!] ?? "Achat impossible.");
  if (preview.method !== input.deliveryMethod) throw precondition("Ce mode de remise n'est pas disponible pour cet article.");
  if (!preview.pricing || !preview.shipping) throw precondition(preview.pricingError ?? "Montant impossible à calculer.");
  const address = preview.requiresAddress ? (preview.addresses.find((a) => a.id === preview.selectedAddressId) ?? null) : null;
  if (preview.requiresAddress && !address) throw invalid("Ajoutez une adresse de livraison.", { addressId: ["Adresse requise."] });

  const pricing = preview.pricing;
  const ttl = await getNumberSetting("orders.reservationTtlMinutes");
  const listing = await db.listing.findUniqueOrThrow({ where: { id: input.listingId }, select: { sellerId: true, countryCode: true, categoryId: true, condition: true, title: true, isDemo: true } });
  const conversation = await db.conversation.findUnique({ where: { listingId_buyerId: { listingId: input.listingId, buyerId: user.id } }, select: { id: true } });

  let order: { id: string; reference: string; status: "CREATED"; version: number; originCountry: string; destinationCountry: string } | null = null;
  for (let attempt = 0; attempt < 3 && !order; attempt++) {
    try {
      order = await db.$transaction(async (tx) => {
        // Verrou de ligne : deux achats simultanés du même exemplaire sont sérialisés.
        const [locked] = await tx.$queryRaw<{ status: string; quantityAvailable: number; priceAmount: number; currency: string }[]>`
          SELECT "status", "quantityAvailable", "priceAmount", "currency" FROM "listing" WHERE "id" = ${input.listingId}::uuid FOR UPDATE`;
        if (!locked || locked.status !== "ACTIVE" || locked.quantityAvailable < 1) throw conflict("Cet article vient d'être réservé ou vendu.");
        if (locked.priceAmount !== pricing.unitPrice || locked.currency !== pricing.currency) throw conflict("Le prix de l'article a changé. Vérifiez le nouveau montant avant de valider.");
        await tx.$executeRaw`
          UPDATE "listing" SET "quantityAvailable" = "quantityAvailable" - 1,
            "status" = CASE WHEN "quantityAvailable" - 1 = 0 THEN 'RESERVED'::"ListingStatus" ELSE "status" END,
            "version" = "version" + 1, "updatedAt" = now()
          WHERE "id" = ${input.listingId}::uuid`;
        const created = await tx.order.create({
          data: {
            reference: generateOrderReference(),
            buyerId: user.id,
            sellerId: listing.sellerId,
            listingId: input.listingId,
            status: "CREATED",
            deliveryMethod: input.deliveryMethod,
            currency: pricing.currency,
            itemsSubtotal: pricing.itemsSubtotal,
            buyerFee: pricing.buyerFee,
            shippingAmount: pricing.shippingAmount,
            taxAmount: pricing.taxAmount,
            totalAmount: pricing.totalAmount,
            sellerNetAmount: pricing.sellerNetAmount,
            originCountry: listing.countryCode,
            destinationCountry: preview.eligibility.destinationCountry,
            isCrossBorder: preview.eligibility.isCrossBorder,
            shippingAddress: address
              ? { fullName: address.fullName, line1: address.line1, line2: address.line2, postalCode: address.postalCode, city: address.city, region: address.region?.name ?? null, countryCode: address.countryCode, phone: address.phone }
              : Prisma.JsonNull,
            reservationExpiresAt: new Date(Date.now() + ttl * 60_000),
            idempotencyKey: input.idempotencyKey,
            isSimulated: preview.eligibility.paymentProvider === "sandbox" || !!preview.shipping?.isSimulated,
            items: { create: { listingId: input.listingId, title: listing.title, unitPrice: pricing.unitPrice, quantity: 1, currency: pricing.currency, categoryId: listing.categoryId, condition: listing.condition, imageKey: preview.listing.imageId } },
            pricing: {
              create: {
                calculatorVersion: pricing.calculatorVersion,
                currency: pricing.currency,
                unitPrice: pricing.unitPrice,
                quantity: pricing.quantity,
                itemsSubtotal: pricing.itemsSubtotal,
                buyerFeeRuleId: pricing.buyerFeeRuleId,
                buyerFeeRateBps: pricing.buyerFeeRateBps,
                buyerFeeFixed: pricing.buyerFeeFixed,
                buyerFee: pricing.buyerFee,
                sellerFeeRuleId: pricing.sellerFeeRuleId,
                sellerFeeRateBps: pricing.sellerFeeRateBps,
                sellerFee: pricing.sellerFee,
                shippingQuoteId: pricing.shippingQuoteId,
                shippingProvider: pricing.shippingProvider,
                shippingAmount: pricing.shippingAmount,
                taxAmount: pricing.taxAmount,
                taxStatus: pricing.taxStatus,
                taxNote: pricing.taxNote,
                totalAmount: pricing.totalAmount,
                sellerNetAmount: pricing.sellerNetAmount,
                breakdown: pricing.breakdown as unknown as Prisma.InputJsonValue,
              },
            },
            history: { create: { toStatus: "CREATED", actorType: "BUYER", actorId: user.id, reason: "Commande créée" } },
          },
          select: { id: true, reference: true, version: true, originCountry: true, destinationCountry: true },
        });
        if (preview.shipping?.quoteId) {
          const used = await tx.shippingQuote.updateMany({ where: { id: preview.shipping.quoteId, usedByOrderId: null }, data: { usedByOrderId: created.id } });
          if (used.count !== 1) throw conflict("Ce devis de livraison a déjà été utilisé.");
        }
        if (conversation) await tx.conversation.update({ where: { id: conversation.id }, data: { orderId: created.id } });
        return { ...created, status: "CREATED" as const };
      });
    } catch (e) {
      // Collision (très improbable) sur la référence lisible : nouvel essai avec une autre référence.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && String(e.meta?.target ?? "").includes("reference")) continue;
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && String(e.meta?.target ?? "").includes("idempotencyKey")) {
        const replay = await db.order.findUniqueOrThrow({ where: { idempotencyKey: input.idempotencyKey } });
        return { orderId: replay.id, redirectUrl: `/commande/${replay.id}`, replayed: true };
      }
      throw e;
    }
  }
  if (!order) throw conflict("Impossible de créer la commande. Réessayez.");
  await track("checkout.started", { userId: user.id, properties: { method: input.deliveryMethod, crossBorder: preview.eligibility.isCrossBorder } });

  // Étapes externes (hors transaction) avec compensation en cas d'échec.
  if (input.deliveryMethod === "TAMURT_TRANSPORT") {
    try {
      await holdTransportForOrder(order, preview.shipping.quoteId!);
    } catch (e) {
      await cancelOrderBySystem(order.id, "Réservation Tamurt Transport impossible", true);
      throw e;
    }
  }
  try {
    const redirectUrl = await startPaymentSession(order.id);
    return { orderId: order.id, redirectUrl, replayed: false };
  } catch (e) {
    logger.error("checkout.payment_session_failed", { orderId: order.id, error: e });
    await cancelOrderBySystem(order.id, "Création de la session de paiement impossible", true);
    throw e;
  }
}

/** Annulation d'une commande non payée (expiration, compensation) : remise en stock, libération du transport. */
export async function cancelOrderBySystem(orderId: string, reason: string, relist: boolean) {
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    if (!["CREATED", "PAYMENT_PENDING"].includes(order.status)) return;
    await transitionOrder(tx, order, "CANCELLED", SYSTEM, { reason, data: { cancelledAt: new Date(), cancelReason: reason } });
    await restockListing(tx, order.listingId, order.items[0]?.quantity ?? 1, relist);
    await tx.payment.updateMany({ where: { orderId, status: { in: ["REQUIRES_ACTION", "PROCESSING"] } }, data: { status: "CANCELLED" } });
    const reservations = await tx.transportReservation.findMany({ where: { orderId, status: "HELD" }, select: { id: true } });
    for (const r of reservations) await enqueue(tx, "transport.reservation.cancel", { reservationId: r.id, reason }, { dedupeKey: `transport.cancel:${r.id}` });
  });
}

/** Annulation par l'acheteur avant paiement. */
export async function cancelUnpaidOrderByBuyer(user: Pick<CurrentUser, "id">, orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || order.buyerId !== user.id) throw notFound("Commande introuvable.");
  if (!["CREATED", "PAYMENT_PENDING"].includes(order.status)) throw conflict("Cette commande ne peut plus être annulée de cette façon.");
  await db.$transaction(async (tx) => {
    await transitionOrder(tx, order, "CANCELLED", { type: "BUYER", id: user.id }, { reason: "Annulée par l'acheteur avant paiement", data: { cancelledAt: new Date(), cancelReason: "Annulée par l'acheteur" } });
    await restockListing(tx, order.listingId, order.items[0]?.quantity ?? 1, true);
    await tx.payment.updateMany({ where: { orderId, status: { in: ["REQUIRES_ACTION", "PROCESSING"] } }, data: { status: "CANCELLED" } });
    const reservations = await tx.transportReservation.findMany({ where: { orderId, status: "HELD" }, select: { id: true } });
    for (const r of reservations) await enqueue(tx, "transport.reservation.cancel", { reservationId: r.id, reason: "Annulation par l'acheteur" }, { dedupeKey: `transport.cancel:${r.id}` });
  });
}

/** Nouvelle tentative de paiement tant que la réservation de l'article est active. */
export async function retryPayment(user: Pick<CurrentUser, "id">, orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.buyerId !== user.id) throw notFound("Commande introuvable.");
  if (order.status !== "PAYMENT_PENDING") throw conflict("Cette commande n'attend pas de paiement.");
  if (order.reservationExpiresAt && order.reservationExpiresAt < new Date()) throw precondition("La réservation a expiré. Relancez un achat depuis l'annonce.");
  return startPaymentSession(orderId);
}

/** Tâche de maintenance : annulation des commandes non payées dont la réservation a expiré. */
export async function expireUnpaidOrders(limit = 100) {
  const stale = await db.order.findMany({
    where: { status: { in: ["CREATED", "PAYMENT_PENDING"] }, reservationExpiresAt: { lt: new Date() } },
    select: { id: true },
    take: limit,
  });
  for (const o of stale) await cancelOrderBySystem(o.id, "Réservation expirée sans paiement", true).catch((e) => logger.warn("order.expire_failed", { orderId: o.id, error: e }));
  return stale.length;
}

export { PARCEL_SIZE_MAX_GRAMS };
