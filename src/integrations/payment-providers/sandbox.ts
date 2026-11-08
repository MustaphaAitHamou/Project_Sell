import "server-only";
import { env } from "@/lib/env";
import { signWebhook, verifyWebhookSignature } from "@/server/security/crypto";
import { WebhookSignatureError, type NormalizedPaymentEvent, type PaymentProvider } from "./types";

export const SANDBOX_SIGNATURE_HEADER = "tamurt-sandbox-signature";

/**
 * Simulateur local de prestataire de paiement (développement et tests UNIQUEMENT ;
 * refusé en production par src/lib/env.ts). Il ne débite rien : la page /dev/paiement
 * permet de déclencher un succès, un échec ou un rejeu, sous forme de webhooks signés
 * HMAC traités exactement comme ceux d'un vrai prestataire.
 * Frais prestataire fictifs : 1,4 % + 0,25 € (pour exercer la comptabilisation des frais).
 */
const secret = () => {
  if (!env.PAYMENT_SANDBOX_WEBHOOK_SECRET) throw new Error("PAYMENT_SANDBOX_WEBHOOK_SECRET manquant");
  return env.PAYMENT_SANDBOX_WEBHOOK_SECRET;
};

export function sandboxFee(amount: number) {
  return Math.floor((amount * 140 + 5000) / 10000) + 25;
}

export function signSandboxEvent(payload: string) {
  return signWebhook(secret(), payload);
}

export const sandboxProvider: PaymentProvider = {
  code: "sandbox",
  label: "Paiement simulé (aucun débit réel)",
  isSandbox: true,
  capabilities: { payerCountries: ["FR"], currencies: ["EUR"], payoutCountries: ["FR"], delayedPayouts: true, partialRefunds: true, webhooks: true },

  async createPayment() {
    const providerSessionId = `sbx_cs_${crypto.randomUUID().replace(/-/g, "")}`;
    return { providerSessionId, redirectUrl: `/dev/paiement/${providerSessionId}` };
  },
  async cancelPayment() {},
  async refund() {
    return { providerRefundId: `sbx_re_${crypto.randomUUID().replace(/-/g, "")}`, status: "SUCCEEDED" };
  },
  async payout() {
    return { providerTransferId: `sbx_tr_${crypto.randomUUID().replace(/-/g, "")}`, status: "PAID" };
  },
  async createPayoutAccount() {
    return { providerAccountId: `sbx_acct_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`, payoutsEnabled: true };
  },
  parseWebhook(rawBody, headers): NormalizedPaymentEvent {
    if (!verifyWebhookSignature(secret(), rawBody, headers.get(SANDBOX_SIGNATURE_HEADER))) throw new WebhookSignatureError();
    const e = JSON.parse(rawBody) as Record<string, unknown>;
    const id = String(e.id ?? "");
    const data = (e.data ?? {}) as Record<string, unknown>;
    switch (e.type) {
      case "payment.succeeded":
        return { eventId: id, type: "payment.succeeded", providerSessionId: String(data.session), providerPaymentId: String(data.payment), amount: Number(data.amount), currency: String(data.currency), providerFeeAmount: data.fee == null ? null : Number(data.fee) };
      case "payment.failed":
        return { eventId: id, type: "payment.failed", providerSessionId: String(data.session), code: String(data.code ?? "card_declined"), message: String(data.message ?? "Paiement refusé") };
      case "payment.expired":
        return { eventId: id, type: "payment.expired", providerSessionId: String(data.session) };
      default:
        return { eventId: id, type: "ignored", rawType: String(e.type) };
    }
  },
};
