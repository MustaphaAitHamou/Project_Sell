import "server-only";
import { evaluateCompliance, type ComplianceDecision, type ComplianceRuleInput } from "@/lib/domain/compliance";
import { db } from "@/server/db/client";
import { getCategoryAncestry } from "./catalog";

let cache: { at: number; rules: ComplianceRuleInput[] } | null = null;

async function rules(): Promise<ComplianceRuleInput[]> {
  if (cache && Date.now() - cache.at < 30_000) return cache.rules;
  const rows = await db.complianceRule.findMany();
  cache = {
    at: Date.now(),
    rules: rows.map((r) => ({
      id: r.id,
      originCountry: r.originCountry,
      destinationCountry: r.destinationCountry,
      categoryId: r.categoryId,
      paymentProvider: r.paymentProvider,
      carrier: r.carrier,
      status: r.status,
      conditions: r.conditions,
      maxDeclaredValueMinor: r.maxDeclaredValueMinor,
    })),
  };
  return cache.rules;
}

export function invalidateComplianceCache() {
  cache = null;
}

/** Évaluation de la matrice pays vendeur × pays acheteur × catégorie × paiement × transporteur. */
export async function evaluateTrade(ctx: {
  originCountry: string;
  destinationCountry: string;
  categoryId: string;
  paymentProvider: string | null;
  carrier: string | null;
  declaredValueMinor?: number;
}): Promise<ComplianceDecision> {
  const ancestry = await getCategoryAncestry(ctx.categoryId);
  return evaluateCompliance(await rules(), {
    originCountry: ctx.originCountry,
    destinationCountry: ctx.destinationCountry,
    categoryAncestry: ancestry.map((c) => ({ id: c.id, isProhibited: c.isProhibited })),
    paymentProvider: ctx.paymentProvider,
    carrier: ctx.carrier,
    declaredValueMinor: ctx.declaredValueMinor,
  });
}
