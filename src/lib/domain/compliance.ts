/**
 * Matrice de conformité des transactions :
 *   pays vendeur × pays acheteur × catégorie × prestataire de paiement × transporteur.
 *
 * Règles d'évaluation (fonction pure, testée) :
 * 1. Une catégorie interdite (ou un de ses ancêtres) rend la transaction INTERDITE, sans exception.
 * 2. Une règle s'applique si chacune de ses dimensions renseignées correspond au contexte
 *    (une dimension nulle signifie « toutes »). Une règle de catégorie s'applique à la
 *    catégorie et à toutes ses descendantes.
 * 3. La règle la plus spécifique l'emporte (nombre de dimensions renseignées, puis
 *    profondeur de la catégorie visée). À spécificité égale, la plus restrictive l'emporte.
 * 4. Sans règle applicable : flux national AUTORISÉ, flux transfrontalier À VÉRIFIER.
 * 5. « À vérifier » et « Interdit » bloquent l'achat : ce ne sont pas des avertissements.
 */

export type ComplianceStatus = "ALLOWED" | "CONDITIONAL" | "TO_VERIFY" | "PROHIBITED";

export interface ComplianceRuleInput {
  id: string;
  originCountry: string | null;
  destinationCountry: string | null;
  categoryId: string | null;
  paymentProvider: string | null;
  carrier: string | null;
  status: ComplianceStatus;
  conditions: string | null;
  maxDeclaredValueMinor: number | null;
}

export interface ComplianceContext {
  originCountry: string;
  destinationCountry: string;
  /** Chaîne de catégories de la plus spécifique (index 0) à la racine. */
  categoryAncestry: readonly { id: string; isProhibited: boolean }[];
  paymentProvider: string | null;
  carrier: string | null;
  /** Valeur déclarée (prix de l'article) dans la devise de la commande. */
  declaredValueMinor?: number;
}

export interface ComplianceDecision {
  status: ComplianceStatus;
  purchasable: boolean;
  isCrossBorder: boolean;
  ruleId: string | null;
  conditions: string | null;
  reason:
    | "CATEGORY_PROHIBITED"
    | "RULE"
    | "VALUE_ABOVE_LIMIT"
    | "DEFAULT_DOMESTIC"
    | "DEFAULT_CROSS_BORDER_UNVERIFIED";
}

const SEVERITY: Record<ComplianceStatus, number> = { ALLOWED: 0, CONDITIONAL: 1, TO_VERIFY: 2, PROHIBITED: 3 };

export function isPurchasableStatus(status: ComplianceStatus): boolean {
  return status === "ALLOWED" || status === "CONDITIONAL";
}

function matchScore(rule: ComplianceRuleInput, ctx: ComplianceContext): number | null {
  let score = 0;
  if (rule.originCountry !== null) {
    if (rule.originCountry !== ctx.originCountry) return null;
    score += 100;
  }
  if (rule.destinationCountry !== null) {
    if (rule.destinationCountry !== ctx.destinationCountry) return null;
    score += 100;
  }
  if (rule.paymentProvider !== null) {
    if (rule.paymentProvider !== ctx.paymentProvider) return null;
    score += 100;
  }
  if (rule.carrier !== null) {
    if (rule.carrier !== ctx.carrier) return null;
    score += 100;
  }
  if (rule.categoryId !== null) {
    const index = ctx.categoryAncestry.findIndex((c) => c.id === rule.categoryId);
    if (index === -1) return null;
    // Plus la catégorie visée est proche de l'article, plus la règle est spécifique.
    score += 100 + (ctx.categoryAncestry.length - index);
  }
  return score;
}

export function evaluateCompliance(rules: readonly ComplianceRuleInput[], ctx: ComplianceContext): ComplianceDecision {
  const isCrossBorder = ctx.originCountry !== ctx.destinationCountry;

  if (ctx.categoryAncestry.some((c) => c.isProhibited)) {
    return { status: "PROHIBITED", purchasable: false, isCrossBorder, ruleId: null, conditions: null, reason: "CATEGORY_PROHIBITED" };
  }

  let best: { rule: ComplianceRuleInput; score: number } | null = null;
  for (const rule of rules) {
    const score = matchScore(rule, ctx);
    if (score === null) continue;
    if (
      !best ||
      score > best.score ||
      (score === best.score && SEVERITY[rule.status] > SEVERITY[best.rule.status])
    ) {
      best = { rule, score };
    }
  }

  if (!best) {
    const status: ComplianceStatus = isCrossBorder ? "TO_VERIFY" : "ALLOWED";
    return {
      status,
      purchasable: isPurchasableStatus(status),
      isCrossBorder,
      ruleId: null,
      conditions: null,
      reason: isCrossBorder ? "DEFAULT_CROSS_BORDER_UNVERIFIED" : "DEFAULT_DOMESTIC",
    };
  }

  const { rule } = best;
  if (
    isPurchasableStatus(rule.status) &&
    rule.maxDeclaredValueMinor !== null &&
    ctx.declaredValueMinor !== undefined &&
    ctx.declaredValueMinor > rule.maxDeclaredValueMinor
  ) {
    return { status: "PROHIBITED", purchasable: false, isCrossBorder, ruleId: rule.id, conditions: rule.conditions, reason: "VALUE_ABOVE_LIMIT" };
  }

  return {
    status: rule.status,
    purchasable: isPurchasableStatus(rule.status),
    isCrossBorder,
    ruleId: rule.id,
    conditions: rule.conditions,
    reason: "RULE",
  };
}
