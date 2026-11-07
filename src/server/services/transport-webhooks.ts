import "server-only";
import { Prisma, type ShipmentStatus } from "@/generated/prisma/client";
import { TRANSPORT_SIGNATURE_HEADER, webhookEventSchema, type TransportEventType } from "@/integrations/tamurt-transport/contract";
import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import { logger } from "@/server/logger";
import { verifyWebhookSignature } from "@/server/security/crypto";
import { applyShipmentEvent } from "./orders/fulfillment";
import { compensateTransportFailure } from "./transport-orders";

const SHIPMENT_STATUS: Partial<Record<TransportEventType, ShipmentStatus>> = {
  "transport.shipment.collected": "HANDED_OVER",
  "transport.shipment.in_transit": "IN_TRANSIT",
  "transport.shipment.customs_hold": "CUSTOMS_HOLD",
  "transport.shipment.out_for_delivery": "OUT_FOR_DELIVERY",
  "transport.shipment.delivered": "DELIVERED",
  "transport.shipment.issue_reported": "EXCEPTION",
};

const LABELS: Partial<Record<TransportEventType, string>> = {
  "transport.shipment.collected": "Colis remis au voyageur Tamurt Transport",
  "transport.shipment.in_transit": "Colis en cours d'acheminement",
  "transport.shipment.customs_hold": "Colis en contrôle douanier",
  "transport.shipment.out_for_delivery": "Colis en cours de livraison",
  "transport.shipment.delivered": "Colis livré (confirmé par Tamurt Transport)",
  "transport.shipment.issue_reported": "Incident signalé par Tamurt Transport",
};

/**
 * Webhooks Tamurt Transport → Market : signature HMAC vérifiée, schéma du contrat v1
 * validé, traitement idempotent (source « transport », identifiant d'événement unique).
 * Un événement de livraison fait avancer la commande mais ne déclenche JAMAIS de
 * versement : celui-ci n'intervient qu'à la clôture (période de vérification, sans litige).
 */
export async function handleTransportWebhook(rawBody: string, headers: Headers): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!env.TRANSPORT_WEBHOOK_SECRET || !verifyWebhookSignature(env.TRANSPORT_WEBHOOK_SECRET, rawBody, headers.get(TRANSPORT_SIGNATURE_HEADER))) {
    logger.warn("transport.webhook.rejected", { reason: "signature" });
    return { status: 400, body: { error: "invalid_signature" } };
  }
  const parsed = webhookEventSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) return { status: 400, body: { error: "invalid_payload" } };
  const event = parsed.data;
  let record = await db.webhookEvent.findUnique({ where: { source_eventId: { source: "transport", eventId: event.id } } });
  if (record?.status === "PROCESSED" || record?.status === "IGNORED") return { status: 200, body: { received: true, duplicate: true } };
  if (!record) {
    try {
      record = await db.webhookEvent.create({ data: { source: "transport", eventId: event.id, eventType: event.type, payload: event as unknown as Prisma.InputJsonValue, signatureValid: true } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { status: 200, body: { received: true, duplicate: true } };
      throw e;
    }
  }
  try {
    const outcome = await process(event);
    await db.webhookEvent.update({ where: { id: record.id }, data: { status: outcome === "ignored" ? "IGNORED" : "PROCESSED", processedAt: new Date(), attempts: { increment: 1 } } });
    await db.integrationEvent.create({ data: { system: "TRANSPORT", direction: "INBOUND", operation: event.type, aggregateType: "ORDER", aggregateId: event.data.partnerOrderId, status: "PROCESSED", summary: { outcome } } }).catch(() => undefined);
    return { status: 200, body: { received: true, outcome } };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.webhookEvent.update({ where: { id: record.id }, data: { status: "FAILED", attempts: { increment: 1 }, lastError: message.slice(0, 1000) } });
    logger.error("transport.webhook.failed", { type: event.type, error: message });
    return { status: 500, body: { error: "processing_failed" } };
  }
}

async function process(event: ReturnType<typeof webhookEventSchema.parse>): Promise<string> {
  const reservation = await db.transportReservation.findUnique({ where: { externalReservationId: event.data.reservationId } });
  if (!reservation || !reservation.orderId || reservation.orderId !== event.data.partnerOrderId) return "ignored";
  switch (event.type) {
    case "transport.reservation.created":
    case "transport.quote.created":
      return "ignored";
    case "transport.reservation.confirmed":
      await db.transportReservation.update({ where: { id: reservation.id }, data: { lastSyncedAt: new Date(), ...(event.data.shipmentId ? { externalShipmentId: event.data.shipmentId } : {}) } });
      return "synced";
    case "transport.reservation.cancelled":
    case "transport.reservation.expired": {
      const order = await db.order.findUniqueOrThrow({ where: { id: reservation.orderId }, select: { status: true } });
      if (["PAID", "SHIPPING_PENDING", "READY_TO_SHIP"].includes(order.status)) {
        await compensateTransportFailure(reservation.id, event.type === "transport.reservation.expired" ? "Réservation Tamurt Transport expirée" : "Réservation annulée par Tamurt Transport");
        return "compensated";
      }
      await db.transportReservation.update({ where: { id: reservation.id }, data: { status: event.type === "transport.reservation.expired" ? "EXPIRED" : "CANCELLED", cancelledAt: new Date() } });
      return "released";
    }
    default: {
      const status = SHIPMENT_STATUS[event.type];
      if (!status) return "ignored";
      return db.$transaction(async (tx) => {
        const shipment = await tx.shipment.upsert({
          where: { orderId: reservation.orderId! },
          create: {
            orderId: reservation.orderId!,
            providerCode: "tamurt_transport",
            serviceCode: "crowdshipping",
            status: "PENDING",
            externalShipmentId: event.data.shipmentId ?? reservation.externalShipmentId,
            isSimulated: reservation.isSimulated,
            originCountry: reservation.corridor.slice(0, 2),
            destinationCountry: reservation.corridor.slice(3, 5),
          },
          update: {},
        });
        return applyShipmentEvent(tx, shipment, {
          status,
          description: event.data.description ?? LABELS[event.type] ?? event.type,
          occurredAt: new Date(event.data.occurredAt),
          location: event.data.location,
          externalEventId: event.id,
          source: "tamurt_transport",
        });
      });
    }
  }
}
