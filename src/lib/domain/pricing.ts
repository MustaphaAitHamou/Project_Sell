import { applyRateBps, assertMinor, MoneyError, multiplyMinor, sumMinor } from "./money";

/**
 * Calcul du prix d'une commande. Fonction pure : les entrées proviennent
 * exclusivement de valeurs serveur faisant autorité (prix de l'annonce en base,
 * règle de frais active, devis de livraison enregistré). Aucune valeur transmise
 * par le navigateur n'intervient.
 *
 * Modèle économique :
 * - Frais de protection acheteur Tamurt Market : taux appliqué au prix des articles
 *   (10 % par défaut), AJOUTÉS côté acheteur. Ils ne s'appliquent jamais à la livraison.
 * - Livraison : prix du prestataire tel que devisé (pour Tamurt Transport, ce prix
 *   inclut déjà sa propre rémunération, calculée selon son contrat : aucune
 *   commission Market n'y est ajoutée, donc pas de double commission).
 * - Taxes : ventilées séparément ; inconnues ou estimées pour un flux transfrontalier.
 * - Vendeur : reçoit le prix des articles, diminué d'une éventuelle commission vendeur
 *   explicitement convenue (0 par défaut).
 */

export const PRICING_CALCULATOR_VERSION = "2026.11.1";

export interface FeeRuleInput {
  id: string | null;
  rateBps: number;
  fixedAmount: number;
  minAmount: number;
  maxAmount: number | null;
}

export interface PricingInput {
  currency: string;
  unitPrice: number;
  quantity: number;
  buyerFeeRule: FeeRuleInput;
  sellerFeeRule?: FeeRuleInput | null;
  shipping: { amount: number; currency: string; provider: string; quoteId: string | null } | null;
  tax?: { amount: number; status: "NONE" | "INCLUDED" | "ESTIMATED" | "UNKNOWN"; note?: string | null } | null;
}

export type BreakdownLineKind = "ITEMS" | "BUYER_FEE" | "SHIPPING" | "TAX";

export interface BreakdownLine {
  kind: BreakdownLineKind;
  amount: number;
  /** Clé de traduction du libellé (messages/*.json, espace « pricing »). */
  labelKey: string;
  detail?: Record<string, string | number>;
}

export interface PricingResult {
  calculatorVersion: string;
  currency: string;
  unitPrice: number;
  quantity: number;
  itemsSubtotal: number;
  buyerFee: number;
  buyerFeeRuleId: string | null;
  buyerFeeRateBps: number;
  buyerFeeFixed: number;
  sellerFee: number;
  sellerFeeRuleId: string | null;
  sellerFeeRateBps: number;
  shippingAmount: number;
  shippingProvider: string | null;
  shippingQuoteId: string | null;
  taxAmount: number;
  taxStatus: "NONE" | "INCLUDED" | "ESTIMATED" | "UNKNOWN";
  taxNote: string | null;
  /** Montant effectivement débité à l'acheteur. */
  totalAmount: number;
  /** Montant dû au vendeur (avant éventuels frais de son propre prestataire de versement). */
  sellerNetAmount: number;
  breakdown: BreakdownLine[];
}

/** Frais selon une règle : taux + fixe, bornés par minimum et maximum. */
export function computeFee(base: number, rule: FeeRuleInput): number {
  assertMinor(base, "base");
  assertMinor(rule.fixedAmount, "fixedAmount");
  assertMinor(rule.minAmount, "minAmount");
  if (rule.maxAmount !== null) assertMinor(rule.maxAmount, "maxAmount");
  let fee = sumMinor(applyRateBps(base, rule.rateBps), rule.fixedAmount);
  fee = Math.max(fee, rule.minAmount);
  if (rule.maxAmount !== null) fee = Math.min(fee, rule.maxAmount);
  return fee;
}

export function computeOrderPricing(input: PricingInput): PricingResult {
  const { currency } = input;
  if (!/^[A-Z]{3}$/.test(currency)) throw new MoneyError("Devise invalide");
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) throw new MoneyError("Quantité invalide");
  assertMinor(input.unitPrice, "unitPrice");
  if (input.unitPrice === 0) throw new MoneyError("Le prix doit être strictement positif");

  const itemsSubtotal = multiplyMinor(input.unitPrice, input.quantity);
  const buyerFee = computeFee(itemsSubtotal, input.buyerFeeRule);
  const sellerFee = input.sellerFeeRule ? computeFee(itemsSubtotal, input.sellerFeeRule) : 0;
  if (sellerFee > itemsSubtotal) throw new MoneyError("Commission vendeur supérieure au prix");

  let shippingAmount = 0;
  if (input.shipping) {
    if (input.shipping.currency !== currency)
      throw new MoneyError("La devise de la livraison diffère de celle de l'article : aucune conversion n'est appliquée");
    assertMinor(input.shipping.amount, "shipping");
    shippingAmount = input.shipping.amount;
  }

  const taxStatus = input.tax?.status ?? "NONE";
  // Seules les taxes réellement collectées entrent dans le total ; une estimation est affichée à part.
  const taxAmount = taxStatus === "INCLUDED" ? (input.tax?.amount ?? 0) : 0;
  assertMinor(taxAmount, "tax");

  const totalAmount = sumMinor(itemsSubtotal, buyerFee, shippingAmount, taxAmount);
  const sellerNetAmount = itemsSubtotal - sellerFee;

  const breakdown: BreakdownLine[] = [
    { kind: "ITEMS", amount: itemsSubtotal, labelKey: "items", detail: { quantity: input.quantity, unitPrice: input.unitPrice } },
    { kind: "BUYER_FEE", amount: buyerFee, labelKey: "buyerFee", detail: { rateBps: input.buyerFeeRule.rateBps } },
  ];
  if (input.shipping) breakdown.push({ kind: "SHIPPING", amount: shippingAmount, labelKey: "shipping", detail: { provider: input.shipping.provider } });
  if (taxStatus !== "NONE") breakdown.push({ kind: "TAX", amount: taxAmount, labelKey: `tax.${taxStatus}` });

  return {
    calculatorVersion: PRICING_CALCULATOR_VERSION,
    currency,
    unitPrice: input.unitPrice,
    quantity: input.quantity,
    itemsSubtotal,
    buyerFee,
    buyerFeeRuleId: input.buyerFeeRule.id,
    buyerFeeRateBps: input.buyerFeeRule.rateBps,
    buyerFeeFixed: input.buyerFeeRule.fixedAmount,
    sellerFee,
    sellerFeeRuleId: input.sellerFeeRule?.id ?? null,
    sellerFeeRateBps: input.sellerFeeRule?.rateBps ?? 0,
    shippingAmount,
    shippingProvider: input.shipping?.provider ?? null,
    shippingQuoteId: input.shipping?.quoteId ?? null,
    taxAmount,
    taxStatus,
    taxNote: input.tax?.note ?? null,
    totalAmount,
    sellerNetAmount,
    breakdown,
  };
}

/** Règle par défaut utilisée si aucune règle n'est configurée : 10 % côté acheteur. */
export const DEFAULT_BUYER_FEE_RULE: FeeRuleInput = { id: null, rateBps: 1000, fixedAmount: 0, minAmount: 0, maxAmount: null };
