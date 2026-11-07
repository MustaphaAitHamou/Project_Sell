"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sandboxFee, SANDBOX_SIGNATURE_HEADER, signSandboxEvent } from "@/integrations/payment-providers/sandbox";
import { SHIPPING_SANDBOX_SIGNATURE_HEADER, signShippingSandboxEvent } from "@/integrations/shipping-providers/sandbox-national";
import type { TransportEventType } from "@/integrations/tamurt-transport/contract";
import { emitSimulatorEvent, setSimulatorCorridorLive, setSimulatorMode } from "@/integrations/tamurt-transport/simulator";
import { getTransportClient } from "@/integrations/tamurt-transport";
import { devToolsEnabled, env } from "@/lib/env";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { drainJobs } from "@/server/jobs/runner";
import { action } from "@/server/security/action";
import { forbidden, notFound } from "@/server/security/errors";
import { handlePaymentWebhook } from "@/server/services/payments";
import { handleShippingWebhook } from "@/server/services/shipping-webhooks";

function guard() {
  if (!devToolsEnabled) throw forbidden("Outils de développement indisponibles.");
}

const lastEvents = (globalThis as unknown as { __tmSandboxLast?: Map<string, string> }).__tmSandboxLast ?? new Map<string, string>();
(globalThis as unknown as { __tmSandboxLast?: Map<string, string> }).__tmSandboxLast = lastEvents;

/**
 * Simulation d'un paiement : construit l'événement que produirait un prestataire, le signe
 * et le transmet au MÊME gestionnaire que la route /api/webhooks/payments/sandbox.
 */
export const simulatePaymentAction = action(z.object({ sessionId: z.string().min(8).max(80), outcome: z.enum(["success", "failure"]) }), async ({ sessionId, outcome }) => {
  guard();
  if (env.PAYMENT_PROVIDER !== "sandbox") throw forbidden("Le simulateur de paiement n'est pas actif.");
  const user = await requireUser();
  const payment = await db.payment.findUnique({ where: { providerSessionId: sessionId }, include: { order: { select: { id: true, buyerId: true } } } });
  if (!payment || payment.order.buyerId !== user.id) throw notFound("Session de paiement introuvable.");
  const event = {
    id: `sbx_evt_${crypto.randomUUID().replace(/-/g, "")}`,
    type: outcome === "success" ? "payment.succeeded" : "payment.failed",
    created: Math.floor(Date.now() / 1000),
    data:
      outcome === "success"
        ? { session: sessionId, payment: `sbx_pi_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`, amount: payment.amount, currency: payment.currency, fee: sandboxFee(payment.amount) }
        : { session: sessionId, code: "card_declined", message: "Carte refusée (simulation)" },
  };
  const raw = JSON.stringify(event);
  lastEvents.set(sessionId, raw);
  const res = await handlePaymentWebhook("sandbox", raw, new Headers({ [SANDBOX_SIGNATURE_HEADER]: signSandboxEvent(raw) }));
  await drainJobs(50);
  return { orderId: payment.order.id, webhook: res };
});

/** Rejoue à l'identique le dernier webhook (même identifiant d'événement) : doit rester sans effet. */
export const replayPaymentWebhookAction = action(z.object({ sessionId: z.string().min(8).max(80) }), async ({ sessionId }) => {
  guard();
  await requireUser();
  const raw = lastEvents.get(sessionId);
  if (!raw) throw notFound("Aucun webhook à rejouer pour cette session.");
  return handlePaymentWebhook("sandbox", raw, new Headers({ [SANDBOX_SIGNATURE_HEADER]: signSandboxEvent(raw) }));
});

export const setTransportSimulatorAction = action(z.object({ mode: z.enum(["normal", "down", "slow"]).optional(), corridorLive: z.boolean().optional(), resetBreaker: z.boolean().optional() }), async (input) => {
  guard();
  const user = await requireUser({ onboarded: false });
  if (!user.isStaff) throw forbidden("Réservé au personnel.");
  if (input.mode) setSimulatorMode(input.mode);
  if (input.corridorLive !== undefined) setSimulatorCorridorLive(input.corridorLive);
  if (input.resetBreaker) getTransportClient()?.resetBreaker();
  revalidatePath("/dev/transport");
  return { done: true };
});

const TRANSPORT_EVENTS = ["transport.shipment.collected", "transport.shipment.in_transit", "transport.shipment.customs_hold", "transport.shipment.out_for_delivery", "transport.shipment.delivered", "transport.shipment.issue_reported", "transport.reservation.cancelled"] as const;

export const emitTransportEventAction = action(z.object({ reservationId: z.string().min(4).max(120), type: z.enum(TRANSPORT_EVENTS) }), async ({ reservationId, type }) => {
  guard();
  const user = await requireUser({ onboarded: false });
  if (!user.isStaff) throw forbidden("Réservé au personnel.");
  const res = await emitSimulatorEvent(reservationId, type as TransportEventType, type === "transport.shipment.customs_hold" ? { location: "Port d'arrivée" } : {});
  await drainJobs(50);
  revalidatePath("/dev/transport");
  return res;
});

/** Événement de suivi du transporteur national simulé (webhook signé). */
export const emitShippingEventAction = action(z.object({ shipmentId: z.uuid(), status: z.enum(["HANDED_OVER", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION"]) }), async ({ shipmentId, status }) => {
  guard();
  const user = await requireUser();
  const shipment = await db.shipment.findUnique({ where: { id: shipmentId }, include: { order: { select: { sellerId: true, buyerId: true } } } });
  if (!shipment || (!user.isStaff && shipment.order.sellerId !== user.id && shipment.order.buyerId !== user.id)) throw notFound();
  const labels = { HANDED_OVER: "Colis déposé par le vendeur", IN_TRANSIT: "Colis en cours d'acheminement", OUT_FOR_DELIVERY: "Colis en cours de livraison", DELIVERED: "Colis livré", EXCEPTION: "Incident de livraison" };
  const raw = JSON.stringify({ id: `sbx_trk_${crypto.randomUUID().replace(/-/g, "")}`, shipment: shipment.externalShipmentId, status, occurredAt: new Date().toISOString(), description: `${labels[status]} (simulation)`, location: "Centre de tri (simulation)" });
  const res = await handleShippingWebhook("sandbox_national", raw, new Headers({ [SHIPPING_SANDBOX_SIGNATURE_HEADER]: signShippingSandboxEvent(raw) }));
  await drainJobs(50);
  revalidatePath(`/commande/${shipment.orderId}/livraison`);
  return res;
});
