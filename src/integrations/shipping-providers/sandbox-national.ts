import "server-only";
import { env } from "@/lib/env";
import { signWebhook, verifyWebhookSignature } from "@/server/security/crypto";
import type { NormalizedShippingEvent, ShippingProviderAdapter } from "./types";

export const SHIPPING_SANDBOX_SIGNATURE_HEADER = "tamurt-shipping-signature";

/**
 * Transporteur national SIMULÉ (France). Tarifs fictifs par format, aucune étiquette ni
 * expédition réelle. Les événements de suivi sont déclenchés depuis /dev/livraison et
 * transmis sous forme de webhooks signés, comme le ferait un vrai transporteur.
 */
const TARIFFS: Record<string, number> = { XS: 390, S: 490, M: 690, L: 990, XL: 1490 };
const secret = () => {
  if (!env.SHIPPING_SANDBOX_WEBHOOK_SECRET) throw new Error("SHIPPING_SANDBOX_WEBHOOK_SECRET manquant");
  return env.SHIPPING_SANDBOX_WEBHOOK_SECRET;
};

export function signShippingSandboxEvent(payload: string) {
  return signWebhook(secret(), payload);
}

export const sandboxNationalCarrier: ShippingProviderAdapter = {
  code: "sandbox_national",
  label: "Livraison nationale (simulation)",
  isSandbox: true,
  countries: ["FR"],
  async quote(a) {
    if (a.originCountry !== a.destinationCountry || !this.countries.includes(a.originCountry) || a.currency !== "EUR") return null;
    const amount = TARIFFS[a.parcelSize];
    if (!amount) return null;
    return { serviceCode: `standard_${a.parcelSize.toLowerCase()}`, serviceName: `Colis standard (${a.parcelSize}) — simulation`, amount, currency: "EUR", estimatedDaysMin: 2, estimatedDaysMax: 4 };
  },
  async createLabel() {
    const n = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
    return { externalShipmentId: `sim_shp_${n.toLowerCase()}`, trackingNumber: `SIM-FR-${n}`, trackingUrl: null };
  },
  async cancel() {},
  parseWebhook(rawBody, headers): NormalizedShippingEvent {
    if (!verifyWebhookSignature(secret(), rawBody, headers.get(SHIPPING_SANDBOX_SIGNATURE_HEADER))) throw new Error("Signature de webhook invalide");
    const e = JSON.parse(rawBody) as { id: string; shipment: string; status: NormalizedShippingEvent["status"]; occurredAt: string; description: string; location?: string };
    return { eventId: e.id, externalShipmentId: e.shipment, status: e.status, occurredAt: new Date(e.occurredAt), description: e.description, location: e.location };
  },
};
