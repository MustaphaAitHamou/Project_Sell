import "server-only";
import type { ShipmentStatus } from "@/generated/prisma/client";
import { getShippingAdapter } from "@/integrations/shipping-providers/registry";
import type { CurrentUser } from "@/server/auth/session";
import { db, type Tx } from "@/server/db/client";
import { notify } from "@/server/notifications";
import { safeEqual } from "@/server/security/crypto";
import { conflict, invalid, notFound, precondition } from "@/server/security/errors";
import { rateLimit } from "@/server/security/rate-limit";
import { getNumberSetting } from "@/server/settings";
import { requestRefund } from "../payments";
import { completeOrder, deriveHandoverCode, getOrderRef, markDelivered, SYSTEM, transitionOrder } from "./core";

async function ownOrder(user: Pick<CurrentUser, "id">, orderId: string, as: "buyer" | "seller") {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true, shipment: true } });
  if (!order || (as === "buyer" ? order.buyerId : order.sellerId) !== user.id) throw notFound("Commande introuvable.");
  return order;
}

// ─────────────────────────────── Remise en main propre ───────────────────────────────

/** Code affiché à l'acheteur, à communiquer au vendeur uniquement au moment de la remise de l'article. */
export async function getHandoverCode(user: Pick<CurrentUser, "id">, orderId: string) {
  const order = await ownOrder(user, orderId, "buyer");
  if (order.deliveryMethod !== "HAND_DELIVERY" || order.status !== "SHIPPING_PENDING" || !order.handoverSalt) return null;
  return deriveHandoverCode(order.id, order.handoverSalt);
}

/** Le vendeur saisit le code de l'acheteur : la remise est constatée (essais limités). */
export async function confirmHandover(user: Pick<CurrentUser, "id">, orderId: string, code: string) {
  await rateLimit(`handover:${user.id}`, 20, 600);
  const order = await ownOrder(user, orderId, "seller");
  if (order.deliveryMethod !== "HAND_DELIVERY" || order.status !== "SHIPPING_PENDING" || !order.handoverSalt) throw conflict("Cette commande n'attend pas de remise en main propre.");
  const maxAttempts = await getNumberSetting("orders.handoverMaxAttempts");
  if (order.handoverAttempts >= maxAttempts) throw precondition("Trop d'essais : contactez le support pour débloquer la remise.");
  const expected = deriveHandoverCode(order.id, order.handoverSalt);
  const ok = /^\d{6}$/.test(code) && safeEqual(expected, code);
  if (!ok) {
    await db.order.update({ where: { id: order.id }, data: { handoverAttempts: { increment: 1 } } });
    throw invalid(`Code incorrect. Essais restants : ${Math.max(0, maxAttempts - order.handoverAttempts - 1)}.`, { code: ["Code incorrect."] });
  }
  await db.$transaction(async (tx) => {
    await markDelivered(tx, order, SYSTEM, "Remise en main propre confirmée par le code de l'acheteur");
  });
}

// ─────────────────────────────── Expédition nationale ───────────────────────────────

/** Création de l'étiquette (transporteur national) par le vendeur. */
export async function createShipmentLabel(user: Pick<CurrentUser, "id">, orderId: string) {
  const order = await ownOrder(user, orderId, "seller");
  if (order.deliveryMethod !== "NATIONAL_SHIPPING") throw conflict("Cette commande n'est pas une livraison nationale.");
  if (order.status !== "SHIPPING_PENDING") throw conflict("L'étiquette ne peut être créée qu'après paiement et avant expédition.");
  if (order.shipment) return order.shipment;
  const pricing = await db.pricingSnapshot.findUniqueOrThrow({ where: { orderId } });
  const adapter = pricing.shippingProvider ? getShippingAdapter(pricing.shippingProvider) : null;
  if (!adapter) throw precondition("Le transporteur de cette commande n'est pas disponible.");
  const listing = await db.listing.findUniqueOrThrow({ where: { id: order.listingId }, select: { parcelSize: true, weightGrams: true } });
  const label = await adapter.createLabel({ orderId, reference: order.reference, originCountry: order.originCountry, destinationCountry: order.destinationCountry, parcelSize: listing.parcelSize ?? "M", weightGrams: listing.weightGrams, idempotencyKey: `label:${orderId}` });
  return db.$transaction(async (tx) => {
    const shipment = await tx.shipment.create({
      data: {
        orderId,
        providerCode: adapter.code,
        serviceCode: "standard",
        status: "LABEL_CREATED",
        trackingNumber: label.trackingNumber,
        trackingUrl: label.trackingUrl,
        externalShipmentId: label.externalShipmentId,
        isSimulated: adapter.isSandbox,
        originCountry: order.originCountry,
        destinationCountry: order.destinationCountry,
        events: { create: { status: "LABEL_CREATED", description: "Étiquette créée", source: "system", occurredAt: new Date() } },
      },
    });
    await transitionOrder(tx, order, "READY_TO_SHIP", SYSTEM, { reason: `Étiquette ${label.trackingNumber} créée` });
    await notify(tx, order.buyerId, { type: "ORDER_SHIPPED", title: `Commande ${order.reference} en préparation`, body: `Le vendeur a préparé l'envoi (suivi ${label.trackingNumber}).`, link: `/commande/${orderId}/livraison` });
    return shipment;
  });
}

/**
 * Application d'un événement de suivi vérifié (webhook transporteur ou Tamurt Transport).
 * Seuls ces événements — jamais une saisie du vendeur — font avancer la livraison.
 */
export async function applyShipmentEvent(
  tx: Tx,
  shipment: { id: string; orderId: string; status: ShipmentStatus },
  event: { status: ShipmentStatus; description: string; occurredAt: Date; location?: string; externalEventId: string; source: string },
) {
  const existing = await tx.shipmentEvent.findUnique({ where: { shipmentId_externalEventId: { shipmentId: shipment.id, externalEventId: event.externalEventId } } });
  if (existing) return "duplicate";
  await tx.shipmentEvent.create({ data: { shipmentId: shipment.id, status: event.status, description: event.description.slice(0, 300), location: event.location ?? null, source: event.source, externalEventId: event.externalEventId, occurredAt: event.occurredAt } });
  await tx.shipment.update({
    where: { id: shipment.id },
    data: { status: event.status, ...(event.status === "HANDED_OVER" ? { handedOverAt: event.occurredAt } : {}), ...(event.status === "DELIVERED" ? { deliveredAt: event.occurredAt } : {}) },
  });
  let ref = await getOrderRef(tx, shipment.orderId);
  const order = await tx.order.findUniqueOrThrow({ where: { id: shipment.orderId }, select: { reference: true, buyerId: true, sellerId: true } });
  const link = `/commande/${shipment.orderId}/livraison`;
  if ((event.status === "HANDED_OVER" || event.status === "IN_TRANSIT" || event.status === "CUSTOMS_HOLD" || event.status === "OUT_FOR_DELIVERY" || event.status === "DELIVERED") && ref.status === "READY_TO_SHIP") {
    ref = await transitionOrder(tx, ref, "IN_TRANSIT", SYSTEM, { reason: event.description, data: { shippedAt: event.occurredAt } });
    if (event.status !== "DELIVERED") await notify(tx, order.buyerId, { type: "ORDER_SHIPPED", title: `Commande ${order.reference} expédiée`, body: "Votre colis est en cours d'acheminement.", link });
  }
  if (event.status === "CUSTOMS_HOLD")
    await notify(tx, order.buyerId, { type: "SYSTEM", title: `Colis en contrôle douanier — ${order.reference}`, body: "Le colis est retenu pour contrôle. Des droits ou formalités peuvent être demandés.", link });
  if (event.status === "DELIVERED" && ref.status === "IN_TRANSIT") await markDelivered(tx, ref, SYSTEM, `Livraison confirmée par le transporteur (${event.source})`);
  if (event.status === "EXCEPTION") {
    await notify(tx, order.buyerId, { type: "SYSTEM", title: `Incident de livraison — ${order.reference}`, body: "Un incident a été signalé. Vous pouvez ouvrir un litige si le problème persiste.", link });
    await notify(tx, order.sellerId, { type: "SYSTEM", title: `Incident de livraison — ${order.reference}`, body: "Un incident a été signalé par le transporteur.", link });
  }
  return "applied";
}

// ─────────────────────────────── Réception et clôture ───────────────────────────────

/**
 * Actions de l'acheteur :
 * - « J'ai reçu l'article » pendant l'acheminement → livrée, période de vérification ;
 * - « Tout est conforme » pendant la période de vérification → clôture et versement.
 */
export async function confirmReceipt(user: Pick<CurrentUser, "id">, orderId: string) {
  const order = await ownOrder(user, orderId, "buyer");
  const actor = { type: "BUYER" as const, id: user.id };
  await db.$transaction(async (tx) => {
    if (order.status === "IN_TRANSIT") return markDelivered(tx, order, actor, "Réception confirmée par l'acheteur");
    if (order.status === "DISPUTE_WINDOW") {
      const open = await tx.dispute.findFirst({ where: { orderId, status: { notIn: ["RESOLVED", "CLOSED"] } } });
      if (open) throw conflict("Un litige est en cours.");
      return completeOrder(tx, order, actor, "Conformité confirmée par l'acheteur");
    }
    throw conflict("Cette commande ne peut pas être confirmée à ce stade.");
  });
}

/** Annulation par le vendeur après paiement (article indisponible…) : remboursement intégral. */
export async function cancelPaidOrderBySeller(user: Pick<CurrentUser, "id">, orderId: string, reason: string, relist: boolean) {
  const order = await ownOrder(user, orderId, "seller");
  if (!["PAID", "SHIPPING_PENDING", "READY_TO_SHIP"].includes(order.status)) throw conflict("Cette commande ne peut plus être annulée par le vendeur.");
  if (order.shipment && order.shipment.status !== "LABEL_CREATED" && order.shipment.status !== "PENDING") throw conflict("Le colis a déjà été remis au transporteur.");
  await db.$transaction(async (tx) => {
    await transitionOrder(tx, order, "REFUND_PENDING", { type: "SELLER", id: user.id }, { reason: `Annulée par le vendeur : ${reason}`, data: { cancelReason: reason.slice(0, 500), cancelledAt: new Date() } });
    await requestRefund(tx, { orderId, amount: order.totalAmount, reason: `Annulation vendeur : ${reason}`, kind: "FULL", initiatedById: user.id, relist });
    await tx.userProfile.update({ where: { userId: user.id }, data: { sellerCancelledCount: { increment: 1 } } });
    await notify(tx, order.buyerId, { type: "ORDER_CANCELLED", title: `Commande ${order.reference} annulée par le vendeur`, body: "Vous allez être intégralement remboursé.", link: `/commande/${orderId}` });
  });
}

/** Tâche de maintenance : clôture des commandes dont la période de vérification est échue sans litige. */
export async function autoCompleteOrders(limit = 100) {
  const due = await db.order.findMany({ where: { status: "DISPUTE_WINDOW", disputeWindowEndsAt: { lt: new Date() } }, select: { id: true }, take: limit });
  let done = 0;
  for (const o of due) {
    await db.$transaction(async (tx) => {
      const open = await tx.dispute.findFirst({ where: { orderId: o.id, status: { notIn: ["RESOLVED", "CLOSED"] } } });
      if (open) return;
      const ref = await getOrderRef(tx, o.id);
      if (ref.status !== "DISPUTE_WINDOW") return;
      await completeOrder(tx, ref, SYSTEM, "Période de vérification écoulée sans litige");
      done++;
    });
  }
  return done;
}
