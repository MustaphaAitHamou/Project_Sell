/**
 * Contrat commun des prestataires de paiement. Chaque prestataire DÉCLARE ses capacités :
 * la plateforme n'utilise jamais une fonction (versement différé, versement vers un pays…)
 * qu'un prestataire n'a pas déclarée et qui n'est pas couverte contractuellement.
 */
export interface PaymentCapabilities {
  /** Pays des payeurs acceptés. */
  payerCountries: readonly string[];
  currencies: readonly string[];
  /** Pays de résidence des vendeurs pouvant recevoir un versement. */
  payoutCountries: readonly string[];
  /** Fonds conservés par le prestataire et versement différé après réception. */
  delayedPayouts: boolean;
  partialRefunds: boolean;
  webhooks: boolean;
}

export interface CreatePaymentArgs {
  paymentId: string;
  orderId: string;
  reference: string;
  amount: number;
  currency: string;
  description: string;
  idempotencyKey: string;
  returnUrl: string;
  cancelUrl: string;
  expiresAt: Date;
}

export type NormalizedPaymentEvent =
  | { eventId: string; type: "payment.succeeded"; providerSessionId: string; providerPaymentId: string; amount: number; currency: string; providerFeeAmount: number | null }
  | { eventId: string; type: "payment.failed"; providerSessionId: string; code: string; message: string }
  | { eventId: string; type: "payment.expired"; providerSessionId: string }
  | { eventId: string; type: "refund.succeeded"; providerRefundId: string }
  | { eventId: string; type: "refund.failed"; providerRefundId: string; message: string }
  | { eventId: string; type: "payout.paid"; providerTransferId: string }
  | { eventId: string; type: "payout.failed"; providerTransferId: string; message: string }
  | { eventId: string; type: "ignored"; rawType: string };

export interface PaymentProvider {
  code: string;
  label: string;
  isSandbox: boolean;
  capabilities: PaymentCapabilities;
  createPayment(a: CreatePaymentArgs): Promise<{ providerSessionId: string; redirectUrl: string }>;
  cancelPayment(providerSessionId: string): Promise<void>;
  refund(a: { providerPaymentId: string; amount: number; currency: string; idempotencyKey: string; reason: string }): Promise<{ providerRefundId: string; status: "SUCCEEDED" | "PENDING" | "FAILED" }>;
  payout(a: { amount: number; currency: string; destinationAccountId: string; idempotencyKey: string; reference: string }): Promise<{ providerTransferId: string; status: "PAID" | "PROCESSING" | "FAILED" }>;
  createPayoutAccount(a: { userId: string; countryCode: string; currency: string }): Promise<{ providerAccountId: string; payoutsEnabled: boolean }>;
  /** Vérifie la signature et normalise l'événement ; lève une erreur si la signature est invalide. */
  parseWebhook(rawBody: string, headers: Headers): NormalizedPaymentEvent;
}

export class WebhookSignatureError extends Error {
  constructor() {
    super("Signature de webhook invalide");
    this.name = "WebhookSignatureError";
  }
}

/** Prestataires étudiés, non intégrés : affichés en administration avec leur état réel. */
export const PLANNED_PAYMENT_PROVIDERS = [
  {
    code: "stripe_connect",
    label: "Stripe Connect (France / UE)",
    status: "PLANNED" as const,
    notes:
      "Candidat pour le marché France : modèle « charges et transferts séparés » à valider (délai maximal de conservation des fonds, pays de versement, KYC des vendeurs). Non intégré : aucune clé, aucun contrat.",
  },
  {
    code: "dz_satim_cib_edahabia",
    label: "Paiement en ligne Algérie (CIB / Edahabia via SATIM et banque acquéreuse)",
    status: "NOT_AVAILABLE" as const,
    notes:
      "Nécessite un contrat d'acceptation avec une banque algérienne. La distribution des fonds à des vendeurs tiers (marketplace) n'est pas présumée disponible : achat intégré désactivé en Algérie (mode petites annonces).",
  },
];
