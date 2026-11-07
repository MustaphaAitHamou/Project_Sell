import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getShippingAdapter } from "@/integrations/shipping-providers/registry";
import { db } from "@/server/db/client";
import { logger } from "@/server/logger";
import { applyShipmentEvent } from "./orders/fulfillment";

/** Webhooks des transporteurs nationaux (même garanties : signature, idempotence, rejouabilité). */
export async function handleShippingWebhook(providerCode: string, rawBody: string, headers: Headers): Promise<{ status: number; body: Record<string, unknown> }> {
  const adapter = getShippingAdapter(providerCode);
  if (!adapter) return { status: 404, body: { error: "unknown_provider" } };
  let event;
  try {
    event = adapter.parseWebhook(rawBody, headers);
  } catch {
    logger.warn("shipping.webhook.rejected", { provider: providerCode });
    return { status: 400, body: { error: "invalid_signature" } };
  }
  const source = `shipping:${providerCode}`;
  const existing = await db.webhookEvent.findUnique({ where: { source_eventId: { source, eventId: event.eventId } } });
  if (existing?.status === "PROCESSED" || existing?.status === "IGNORED") return { status: 200, body: { received: true, duplicate: true } };
  const record =
    existing ??
    (await db.webhookEvent
      .create({ data: { source, eventId: event.eventId, eventType: event.status, payload: JSON.parse(rawBody) as Prisma.InputJsonValue, signatureValid: true } })
      .catch((e) => {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return null;
        throw e;
      }));
  if (!record) return { status: 200, body: { received: true, duplicate: true } };
  try {
    const outcome = await db.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({ where: { providerCode_externalShipmentId: { providerCode, externalShipmentId: event.externalShipmentId } } });
      if (!shipment) return "ignored";
      return applyShipmentEvent(tx, shipment, { status: event.status, description: event.description, occurredAt: event.occurredAt, location: event.location, externalEventId: event.eventId, source: providerCode });
    });
    await db.webhookEvent.update({ where: { id: record.id }, data: { status: outcome === "ignored" ? "IGNORED" : "PROCESSED", processedAt: new Date(), attempts: { increment: 1 } } });
    return { status: 200, body: { received: true, outcome } };
  } catch (e) {
    await db.webhookEvent.update({ where: { id: record.id }, data: { status: "FAILED", attempts: { increment: 1 }, lastError: (e instanceof Error ? e.message : String(e)).slice(0, 1000) } });
    return { status: 500, body: { error: "processing_failed" } };
  }
}
