import "server-only";
import { getTransportClient, TransportApiError, TransportUnavailableError } from "@/integrations/tamurt-transport";
import { track } from "@/server/analytics";
import { db } from "@/server/db/client";
import { enqueue } from "@/server/jobs/queue";
import { logger } from "@/server/logger";
import { notify } from "@/server/notifications";
import { unavailable } from "@/server/security/errors";
import { getNumberSetting } from "@/server/settings";
import { getOrderRef, SYSTEM, transitionOrder } from "./orders/core";
import { requestRefund } from "./payments";

/**
 * Saga de réservation Tamurt Transport pour une commande :
 * 1. blocage temporaire de capacité (HELD) avant le paiement ;
 * 2. confirmation après paiement confirmé (tâche avec reprises) ;
 * 3. compensation si la confirmation échoue définitivement : remboursement intégral et
 *    annulation, l'acheteur est prévenu ; une annulation libère la capacité chez Transport.
 * Aucun appel externe n'est effectué à l'intérieur d'une transaction de base de données.
 */
export async function holdTransportForOrder(order: { id: string; reference: string; originCountry: string; destinationCountry: string }, quoteId: string) {
  const client = getTransportClient();
  if (!client) throw unavailable("Tamurt Transport n'est pas activé.");
  const quote = await db.shippingQuote.findUniqueOrThrow({ where: { id: quoteId } });
  if (!quote.externalQuoteId) throw unavailable("Devis Tamurt Transport invalide.");
  const ttl = await getNumberSetting("orders.reservationTtlMinutes");
  let reservation;
  try {
    reservation = await client.reserve({ quoteId: quote.externalQuoteId, partnerOrderId: order.id, holdMinutes: Math.min(60, ttl + 10) }, `hold:${order.id}`);
  } catch (e) {
    if (e instanceof TransportApiError) throw unavailable(e.code === "corridor_closed" ? "Ce trajet Tamurt Transport n'est pas ouvert aux réservations." : e.code === "capacity_unavailable" ? "Le voyageur n'a plus de capacité disponible sur ce trajet." : "La réservation Tamurt Transport a été refusée.");
    if (e instanceof TransportUnavailableError) throw unavailable("Tamurt Transport est momentanément indisponible. Choisissez un autre mode de remise ou réessayez plus tard.");
    throw e;
  }
  try {
    await db.transportReservation.create({
      data: {
        orderId: order.id,
        shippingQuoteId: quote.id,
        externalReservationId: reservation.reservationId,
        status: "HELD",
        amount: reservation.price.amount,
        currency: reservation.price.currency,
        corridor: `${order.originCountry}-${order.destinationCountry}`,
        holdExpiresAt: new Date(reservation.holdExpiresAt),
        isSimulated: client.isSimulated,
      },
    });
  } catch (e) {
    // Compensation : la capacité bloquée chez Transport est libérée.
    await client.cancel(reservation.reservationId, "Échec d'enregistrement côté Market", `cancel:hold:${order.id}`, order.id).catch(() => undefined);
    throw e;
  }
  await track("transport.reservation_created", { properties: { corridor: `${order.originCountry}-${order.destinationCountry}`, simulated: client.isSimulated } });
}

/** Tâche « transport.reservation.confirm » (après paiement confirmé). */
export async function confirmTransportReservation(reservationId: string, attempt: number, maxAttempts: number) {
  const client = getTransportClient();
  const r = await db.transportReservation.findUnique({ where: { id: reservationId }, include: { order: { include: { buyer: { select: { name: true } }, seller: { select: { name: true } } } } } });
  if (!r || !r.order || r.status !== "HELD") return;
  const order = r.order;
  if (!["PAID", "SHIPPING_PENDING"].includes(order.status)) return;
  const address = (order.shippingAddress ?? {}) as { fullName?: string; city?: string; phone?: string };
  try {
    if (!client) throw new TransportUnavailableError("disabled");
    const payment = await db.payment.findFirst({ where: { orderId: order.id, status: "SUCCEEDED", isDuplicate: false }, select: { id: true } });
    const res = await client.confirm(
      r.externalReservationId,
      {
        partnerOrderId: order.id,
        paymentReference: payment?.id ?? order.reference,
        sender: { displayName: order.seller.name },
        recipient: { displayName: address.fullName ?? order.buyer.name, phone: address.phone, city: address.city ?? "" },
      },
      `confirm:${r.id}`,
    );
    await db.$transaction(async (tx) => {
      await tx.transportReservation.update({ where: { id: r.id }, data: { status: "CONFIRMED", confirmedAt: new Date(), externalShipmentId: res.shipmentId, lastSyncedAt: new Date() } });
      if (res.shipmentId)
        await tx.shipment.upsert({
          where: { orderId: order.id },
          create: { orderId: order.id, providerCode: "tamurt_transport", serviceCode: "crowdshipping", status: "PENDING", externalShipmentId: res.shipmentId, isSimulated: r.isSimulated, originCountry: order.originCountry, destinationCountry: order.destinationCountry },
          update: { externalShipmentId: res.shipmentId },
        });
      const ref = await getOrderRef(tx, order.id);
      if (ref.status === "SHIPPING_PENDING") await transitionOrder(tx, ref, "READY_TO_SHIP", SYSTEM, { reason: "Réservation Tamurt Transport confirmée" });
      await notify(tx, order.sellerId, { type: "SYSTEM", title: `Tamurt Transport confirmé — ${order.reference}`, body: "Le voyageur est réservé. Tamurt Transport vous contactera pour la remise du colis.", link: `/commande/${order.id}/livraison` });
    });
  } catch (e) {
    const definitive = e instanceof TransportApiError && !e.retryable;
    const exhausted = attempt >= maxAttempts;
    logger.warn("transport.confirm_failed", { reservationId, definitive, exhausted, error: e });
    if (definitive || exhausted) {
      await compensateTransportFailure(r.id, definitive ? `Confirmation refusée par Tamurt Transport (${(e as TransportApiError).code})` : "Tamurt Transport injoignable après plusieurs tentatives");
      return;
    }
    throw e; // reprise par la file de tâches (backoff exponentiel)
  }
}

/** Compensation : réservation marquée en échec, remboursement intégral, commande annulée. */
export async function compensateTransportFailure(reservationId: string, reason: string) {
  await db.$transaction(async (tx) => {
    const r = await tx.transportReservation.findUniqueOrThrow({ where: { id: reservationId } });
    await tx.transportReservation.update({ where: { id: r.id }, data: { status: "FAILED" } });
    if (!r.orderId) return;
    const ref = await getOrderRef(tx, r.orderId);
    if (["PAID", "SHIPPING_PENDING", "READY_TO_SHIP"].includes(ref.status)) {
      await transitionOrder(tx, ref, "REFUND_PENDING", SYSTEM, { reason });
      const order = await tx.order.findUniqueOrThrow({ where: { id: r.orderId } });
      await requestRefund(tx, { orderId: order.id, amount: order.totalAmount, reason, kind: "FULL", initiatedById: null, relist: true });
      await notify(tx, order.buyerId, { type: "ORDER_CANCELLED", title: `Commande ${order.reference} annulée`, body: "Le transport n'a pas pu être confirmé. Vous êtes intégralement remboursé.", link: `/commande/${order.id}` });
      await notify(tx, order.sellerId, { type: "ORDER_CANCELLED", title: `Vente ${order.reference} annulée`, body: "Le transport n'a pas pu être confirmé ; la vente est annulée et l'article remis en vente.", link: `/commande/${order.id}` });
    }
    await enqueue(tx, "transport.reservation.cancel", { reservationId: r.id, reason }, { dedupeKey: `transport.cancel:${r.id}` });
  });
}

/** Tâche « transport.reservation.cancel » : libère la capacité chez Transport (idempotent). */
export async function cancelTransportReservation(reservationId: string, reason: string) {
  const client = getTransportClient();
  const r = await db.transportReservation.findUnique({ where: { id: reservationId } });
  if (!r || r.status === "CANCELLED" || r.status === "EXPIRED") return;
  if (!client) return;
  try {
    await client.cancel(r.externalReservationId, reason, `cancel:${r.id}`, r.orderId ?? undefined);
  } catch (e) {
    if (e instanceof TransportApiError && e.status === 404) {
      // Inconnue chez Transport (expirée de son côté) : rien à libérer.
    } else throw e;
  }
  await db.transportReservation.update({ where: { id: r.id }, data: { status: r.status === "FAILED" ? "FAILED" : "CANCELLED", cancelledAt: new Date() } });
}
