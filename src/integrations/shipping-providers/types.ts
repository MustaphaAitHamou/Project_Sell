/**
 * Contrat commun des transporteurs (adaptateurs indépendants). Chaque prestataire
 * déclare les pays, services et marchandises pris en charge ; aucune expédition réelle
 * n'est affichée tant qu'un prestataire réel n'est pas contractualisé et intégré.
 */
export interface ShippingQuoteResult {
  serviceCode: string;
  serviceName: string;
  amount: number;
  currency: string;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
}

export interface CreateLabelArgs {
  orderId: string;
  reference: string;
  originCountry: string;
  destinationCountry: string;
  parcelSize: "XS" | "S" | "M" | "L" | "XL";
  weightGrams: number | null;
  idempotencyKey: string;
}

export type NormalizedShippingEvent = {
  eventId: string;
  externalShipmentId: string;
  status: "HANDED_OVER" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "EXCEPTION" | "RETURNED";
  occurredAt: Date;
  description: string;
  location?: string;
};

export interface ShippingProviderAdapter {
  code: string;
  label: string;
  isSandbox: boolean;
  countries: readonly string[];
  quote(a: { originCountry: string; destinationCountry: string; parcelSize: CreateLabelArgs["parcelSize"]; weightGrams: number | null; currency: string }): Promise<ShippingQuoteResult | null>;
  createLabel(a: CreateLabelArgs): Promise<{ externalShipmentId: string; trackingNumber: string; trackingUrl: string | null }>;
  cancel(externalShipmentId: string): Promise<void>;
  parseWebhook(rawBody: string, headers: Headers): NormalizedShippingEvent;
}
