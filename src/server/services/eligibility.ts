import "server-only";
import type { DeliveryMethod } from "@/generated/prisma/client";
import { getActivePaymentProvider } from "@/integrations/payment-providers/registry";
import type { ComplianceDecision } from "@/lib/domain/compliance";
import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import { isEnabled } from "@/server/settings";
import { getCategoryById } from "./catalog";
import { evaluateTrade } from "./compliance";

export type PurchaseBlockReason =
  | "OWN_LISTING"
  | "NOT_AVAILABLE"
  | "SELLER_INACTIVE"
  | "CHECKOUT_DISABLED"
  | "NO_PAYMENT_PROVIDER"
  | "COUNTRY_CLASSIFIED_ONLY"
  | "PROVIDER_UNSUPPORTED"
  | "CATEGORY_NOT_TRANSACTIONAL"
  | "CROSS_BORDER_DISABLED"
  | "COMPLIANCE_TO_VERIFY"
  | "COMPLIANCE_PROHIBITED"
  | "NO_DELIVERY_OPTION";

export interface MethodAvailability {
  method: DeliveryMethod;
  available: boolean;
  carrier: string | null;
  reason?: "CROSS_BORDER_ONLY_TRANSPORT" | "CARRIER_UNAVAILABLE" | "TRANSPORT_DISABLED" | "COMPLIANCE" | "NOT_OFFERED";
}

export interface PurchaseEligibility {
  purchasable: boolean;
  mode: "INTEGRATED" | "CLASSIFIED_ONLY" | "UNAVAILABLE";
  reasons: PurchaseBlockReason[];
  isCrossBorder: boolean;
  destinationCountry: string;
  compliance: ComplianceDecision;
  methods: MethodAvailability[];
  paymentProvider: string | null;
}

type ListingForEligibility = {
  id: string;
  sellerId: string;
  status: string;
  countryCode: string;
  categoryId: string;
  priceAmount: number;
  currency: string;
  quantityAvailable: number;
  deliveryMethods: DeliveryMethod[];
  acceptsCrossBorder: boolean;
  sellerStatus?: string;
};

/**
 * Éligibilité à l'achat intégré. Toutes les conditions sont vérifiées côté serveur et
 * revérifiées au moment de la commande. Une condition non remplie bloque l'achat : les
 * restrictions de conformité ne sont jamais de simples avertissements contournables.
 */
export async function getPurchaseEligibility(listing: ListingForEligibility, buyer: { id: string; countryCode: string | null } | null, destinationCountry?: string): Promise<PurchaseEligibility> {
  const destination = destinationCountry ?? buyer?.countryCode ?? listing.countryCode;
  const isCrossBorder = destination !== listing.countryCode;
  const reasons: PurchaseBlockReason[] = [];
  const provider = getActivePaymentProvider();

  if (buyer && buyer.id === listing.sellerId) reasons.push("OWN_LISTING");
  if (listing.status !== "ACTIVE" || listing.quantityAvailable < 1) reasons.push("NOT_AVAILABLE");
  if (listing.sellerStatus && listing.sellerStatus !== "ACTIVE") reasons.push("SELLER_INACTIVE");

  const [checkoutEnabled, crossBorderEnabled, transportQuotes, sellerCountry, category] = await Promise.all([
    isEnabled("checkout.enabled"),
    isEnabled("checkout.crossBorder"),
    isEnabled("transport.quotes"),
    db.country.findUnique({ where: { code: listing.countryCode }, select: { checkoutMode: true } }),
    getCategoryById(listing.categoryId),
  ]);

  const classifiedOnly = sellerCountry?.checkoutMode !== "INTEGRATED";
  if (!checkoutEnabled) reasons.push("CHECKOUT_DISABLED");
  if (classifiedOnly) reasons.push("COUNTRY_CLASSIFIED_ONLY");
  if (!provider) reasons.push("NO_PAYMENT_PROVIDER");
  // Le payeur est l'acheteur (pays de son profil) : un membre de la diaspora en France peut
  // payer avec un moyen de paiement français une livraison destinée à l'Algérie.
  else if (!provider.capabilities.currencies.includes(listing.currency) || !provider.capabilities.payerCountries.includes(buyer?.countryCode ?? destination) || !provider.capabilities.payoutCountries.includes(listing.countryCode))
    reasons.push("PROVIDER_UNSUPPORTED");
  if (category && !category.isTransactional) reasons.push("CATEGORY_NOT_TRANSACTIONAL");
  if (isCrossBorder && !crossBorderEnabled) reasons.push("CROSS_BORDER_DISABLED");

  const transportAvailable = env.TRANSPORT_INTEGRATION !== "disabled" && transportQuotes;
  const nationalCarrier = !isCrossBorder
    ? await db.shippingProvider.findFirst({ where: { kind: "NATIONAL_CARRIER", isEnabled: true, supportedCountries: { has: listing.countryCode } }, select: { code: true } })
    : null;

  // Conformité évaluée pour le transporteur pressenti (Transport en transfrontalier, transporteur national sinon).
  const primaryCarrier = isCrossBorder ? "tamurt_transport" : (nationalCarrier?.code ?? "hand_delivery");
  const compliance = await evaluateTrade({
    originCountry: listing.countryCode,
    destinationCountry: destination,
    categoryId: listing.categoryId,
    paymentProvider: provider?.code ?? null,
    carrier: primaryCarrier,
    declaredValueMinor: listing.priceAmount,
  });
  if (compliance.status === "TO_VERIFY") reasons.push("COMPLIANCE_TO_VERIFY");
  if (compliance.status === "PROHIBITED") reasons.push("COMPLIANCE_PROHIBITED");

  const methods: MethodAvailability[] = (["HAND_DELIVERY", "NATIONAL_SHIPPING", "TAMURT_TRANSPORT"] as const).map((method) => {
    if (!listing.deliveryMethods.includes(method)) return { method, available: false, carrier: null, reason: "NOT_OFFERED" };
    if (method === "HAND_DELIVERY") return isCrossBorder ? { method, available: false, carrier: null, reason: "CROSS_BORDER_ONLY_TRANSPORT" } : { method, available: true, carrier: "hand_delivery" };
    if (method === "NATIONAL_SHIPPING") {
      if (isCrossBorder) return { method, available: false, carrier: null, reason: "CROSS_BORDER_ONLY_TRANSPORT" };
      return nationalCarrier ? { method, available: true, carrier: nationalCarrier.code } : { method, available: false, carrier: null, reason: "CARRIER_UNAVAILABLE" };
    }
    if (!transportAvailable) return { method, available: false, carrier: null, reason: "TRANSPORT_DISABLED" };
    if (isCrossBorder && !listing.acceptsCrossBorder) return { method, available: false, carrier: null, reason: "NOT_OFFERED" };
    return compliance.purchasable ? { method, available: true, carrier: "tamurt_transport" } : { method, available: false, carrier: "tamurt_transport", reason: "COMPLIANCE" };
  });
  if (!methods.some((m) => m.available)) reasons.push("NO_DELIVERY_OPTION");

  const mode: PurchaseEligibility["mode"] = reasons.length === 0 ? "INTEGRATED" : classifiedOnly || !provider ? "CLASSIFIED_ONLY" : "UNAVAILABLE";
  return {
    purchasable: reasons.length === 0,
    mode,
    reasons,
    isCrossBorder,
    destinationCountry: destination,
    compliance,
    methods,
    paymentProvider: provider?.code ?? null,
  };
}

export const BLOCK_REASON_LABELS: Record<PurchaseBlockReason, string> = {
  OWN_LISTING: "C'est votre annonce.",
  NOT_AVAILABLE: "Cet article n'est plus disponible.",
  SELLER_INACTIVE: "Le compte du vendeur n'est pas actif.",
  CHECKOUT_DISABLED: "L'achat en ligne est momentanément désactivé.",
  NO_PAYMENT_PROVIDER: "Aucun prestataire de paiement n'est encore configuré : l'achat en ligne n'est pas disponible.",
  COUNTRY_CLASSIFIED_ONLY: "Le paiement en ligne n'est pas encore disponible dans le pays du vendeur.",
  PROVIDER_UNSUPPORTED: "Le prestataire de paiement ne prend pas en charge ce pays ou cette devise.",
  CATEGORY_NOT_TRANSACTIONAL: "Cette catégorie n'est pas ouverte à l'achat en ligne.",
  CROSS_BORDER_DISABLED: "Les achats entre pays ne sont pas encore ouverts (validation juridique et opérationnelle en cours).",
  COMPLIANCE_TO_VERIFY: "La conformité de cet envoi entre ces pays n'a pas encore été validée : achat impossible pour le moment.",
  COMPLIANCE_PROHIBITED: "Cet envoi n'est pas autorisé pour cette catégorie d'article entre ces pays.",
  NO_DELIVERY_OPTION: "Aucun mode de remise ou de livraison n'est disponible pour cette combinaison.",
};
