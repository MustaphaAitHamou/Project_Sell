import "server-only";
import type { FeeKind, SellerType } from "@/generated/prisma/client";
import { DEFAULT_BUYER_FEE_RULE, type FeeRuleInput } from "@/lib/domain/pricing";
import { audit } from "@/server/audit";
import { db } from "@/server/db/client";
import { invalid } from "@/server/security/errors";

/** Règle de frais en vigueur : la plus spécifique (devise, pays, type de vendeur) parmi les versions actives. */
export async function getActiveFeeRule(kind: FeeKind, ctx: { currency: string; countryCode?: string; sellerType?: SellerType }, at = new Date()) {
  const rules = await db.feeRule.findMany({
    where: {
      kind,
      activeFrom: { lte: at },
      OR: [{ activeUntil: null }, { activeUntil: { gt: at } }],
      AND: [
        { OR: [{ currency: null }, { currency: ctx.currency }] },
        { OR: [{ countryCode: null }, ...(ctx.countryCode ? [{ countryCode: ctx.countryCode }] : [])] },
        { OR: [{ sellerType: null }, ...(ctx.sellerType ? [{ sellerType: ctx.sellerType }] : [])] },
      ],
    },
  });
  const score = (r: (typeof rules)[number]) => (r.currency ? 4 : 0) + (r.countryCode ? 2 : 0) + (r.sellerType ? 1 : 0);
  return rules.sort((a, b) => score(b) - score(a) || b.activeFrom.getTime() - a.activeFrom.getTime())[0] ?? null;
}

export async function getActiveBuyerFeeRule(currency: string, countryCode?: string): Promise<FeeRuleInput> {
  const rule = await getActiveFeeRule("BUYER_PROTECTION", { currency, countryCode });
  return rule ? { id: rule.id, rateBps: rule.rateBps, fixedAmount: rule.fixedAmount, minAmount: rule.minAmount, maxAmount: rule.maxAmount } : DEFAULT_BUYER_FEE_RULE;
}

export async function getActiveSellerFeeRule(currency: string, countryCode: string, sellerType: SellerType): Promise<FeeRuleInput | null> {
  const rule = await getActiveFeeRule("SELLER_COMMISSION", { currency, countryCode, sellerType });
  return rule ? { id: rule.id, rateBps: rule.rateBps, fixedAmount: rule.fixedAmount, minAmount: rule.minAmount, maxAmount: rule.maxAmount } : null;
}

/**
 * Nouvelle version d'une règle de frais (la précédente est close, jamais modifiée) :
 * les commandes passées conservent la règle appliquée dans leur instantané de prix.
 */
export async function createFeeRuleVersion(
  actor: { id: string; roles: string[] },
  input: { kind: FeeKind; rateBps: number; fixedAmount: number; minAmount: number; maxAmount: number | null; currency: string | null; note?: string },
) {
  if (!Number.isInteger(input.rateBps) || input.rateBps < 0 || input.rateBps > 5000) throw invalid("Taux invalide (0 à 50 %).");
  return db.$transaction(async (tx) => {
    const now = new Date();
    const previous = await tx.feeRule.findFirst({ where: { kind: input.kind, currency: input.currency, countryCode: null, sellerType: null, activeUntil: null } });
    if (previous) await tx.feeRule.update({ where: { id: previous.id }, data: { activeUntil: now } });
    const rule = await tx.feeRule.create({
      data: { kind: input.kind, currency: input.currency, rateBps: input.rateBps, fixedAmount: input.fixedAmount, minAmount: input.minAmount, maxAmount: input.maxAmount, activeFrom: now, note: input.note ?? null, createdById: actor.id },
    });
    await audit(
      { actorId: actor.id, actorRoles: actor.roles, action: "fees.version_created", targetType: "fee_rule", targetId: rule.id, metadata: { previous: previous ? { id: previous.id, rateBps: previous.rateBps } : null, rateBps: input.rateBps, kind: input.kind } },
      tx,
    );
    return rule;
  });
}
