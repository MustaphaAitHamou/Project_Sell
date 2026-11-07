"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { FEATURE_FLAGS, PLATFORM_SETTINGS } from "@/lib/config/platform-defaults";
import { sha256Hex, randomToken } from "@/server/security/crypto";
import { requirePermission } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { db } from "@/server/db/client";
import { action } from "@/server/security/action";
import { forbidden, invalid } from "@/server/security/errors";
import { invalidateCatalogCache } from "@/server/services/catalog";
import { invalidateComplianceCache } from "@/server/services/compliance";
import { resolveDispute } from "@/server/services/disputes";
import { createFeeRuleVersion } from "@/server/services/fees";
import { dismissReport, hideMessage, moderateListing, moderateReview, setStaffRole, setUserStatus } from "@/server/services/moderation";
import { releasePayout, replayFailedWebhooks } from "@/server/services/payments";
import { setFlag, setSetting, type FlagKey, type SettingKey } from "@/server/settings";

export const moderateListingAction = action(z.object({ listingId: z.uuid(), decision: z.enum(["APPROVE", "REJECT", "SUSPEND", "REINSTATE", "REMOVE"]), reason: z.string().max(1000).default(""), reportId: z.uuid().optional() }), async (i) => {
  const staff = await requirePermission("listings.moderate");
  await moderateListing(staff, i.listingId, i.decision, i.reason, i.reportId);
  revalidatePath("/admin/moderation");
  return { done: true };
});

export const reportAction = action(z.object({ reportId: z.uuid(), op: z.enum(["dismiss", "hideMessage", "hideReview"]), targetId: z.string().optional(), note: z.string().max(1000).default("") }), async (i) => {
  const staff = await requirePermission("reports.handle");
  if (i.op === "dismiss") await dismissReport(staff, i.reportId, i.note);
  if (i.op === "hideMessage" && i.targetId) await hideMessage(staff, i.targetId, i.note, i.reportId);
  if (i.op === "hideReview" && i.targetId) await moderateReview(staff, i.targetId, false, i.note, i.reportId);
  revalidatePath("/admin/moderation");
  return { done: true };
});

export const userStatusAction = action(z.object({ userId: z.string().min(1).max(64), status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]), reason: z.string().max(1000) }), async (i) => {
  const staff = await requirePermission("users.suspend");
  await setUserStatus(staff, i.userId, i.status, i.reason);
  revalidatePath("/admin/utilisateurs");
  return { done: true };
});

export const userRoleAction = action(z.object({ userId: z.string().min(1).max(64), role: z.enum(["MODERATOR", "SUPPORT", "FINANCE", "ADMIN", "SUPER_ADMIN"]), grant: z.boolean() }), async (i) => {
  const staff = await requirePermission("users.roles.assign");
  await setStaffRole(staff, i.userId, i.role, i.grant);
  revalidatePath("/admin/utilisateurs");
  return { done: true };
});

export const resolveDisputeAction = action(z.object({ disputeId: z.uuid(), resolution: z.enum(["FULL_REFUND", "PARTIAL_REFUND", "NO_REFUND"]), refundAmount: z.number().int().positive().optional(), note: z.string().max(2000) }), async (i) => {
  const staff = await requirePermission("disputes.resolve");
  await resolveDispute(staff, i.disputeId, { resolution: i.resolution, refundAmount: i.refundAmount, note: i.note });
  revalidatePath("/admin/litiges");
  return { done: true };
});

export const flagAction = action(z.object({ key: z.string(), enabled: z.boolean(), confirmation: z.string().optional() }), async ({ key, enabled, confirmation }) => {
  const staff = await requirePermission("flags.write");
  if (!FEATURE_FLAGS.some((f) => f.key === key)) throw invalid("Indicateur inconnu.");
  if (key === "checkout.crossBorder" && enabled) {
    // Garde-fou : ouverture transfrontalière réservée au super-administrateur, avec preuve de validation enregistrée.
    if (!staff.roles.includes("SUPER_ADMIN")) throw forbidden("Réservé au super-administrateur.");
    const record = await db.complianceRecord.findFirst({ where: { subjectType: "CORRIDOR", status: "VALID" } });
    if (!record) throw invalid("Aucune validation juridique de corridor n'est enregistrée dans le registre de conformité.");
    if (confirmation !== "JE CONFIRME LA VALIDATION JURIDIQUE") throw invalid("Confirmation explicite requise.");
  }
  await setFlag(key as FlagKey, enabled, staff);
  revalidatePath("/admin/configuration");
  return { done: true };
});

export const settingAction = action(z.object({ key: z.string(), value: z.string().max(2000) }), async ({ key, value }) => {
  const staff = await requirePermission("settings.write");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw invalid("Valeur JSON invalide.");
  }
  // Le type doit correspondre à celui de la valeur par défaut (entier ≥ 0, ou objet de mêmes clés).
  const def = PLATFORM_SETTINGS.find((x) => x.key === key);
  if (!def) throw invalid("Réglage inconnu.");
  const isCount = (n: unknown) => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  if (typeof def.value === "number" ? !isCount(parsed) : !(parsed && typeof parsed === "object" && !Array.isArray(parsed) && Object.keys(def.value).every((k) => isCount((parsed as Record<string, unknown>)[k])) && Object.keys(parsed).length === Object.keys(def.value).length))
    throw invalid(typeof def.value === "number" ? "Entier positif attendu." : `Objet attendu avec les clés ${Object.keys(def.value).join(", ")} (entiers positifs).`);
  await setSetting(key as SettingKey, parsed as never, staff);
  revalidatePath("/admin/configuration");
  return { done: true };
});

export const feeRuleAction = action(z.object({ ratePercent: z.string().regex(/^\d{1,2}(?:[.,]\d{1,2})?$/, "Pourcentage invalide."), currency: z.string().length(3).nullable(), note: z.string().max(500).optional() }), async ({ ratePercent, currency, note }) => {
  const staff = await requirePermission("fees.write");
  const [units, frac = ""] = ratePercent.replace(",", ".").split(".");
  const rateBps = Number(units) * 100 + Number(frac.padEnd(2, "0"));
  await createFeeRuleVersion(staff, { kind: "BUYER_PROTECTION", rateBps, fixedAmount: 0, minAmount: 0, maxAmount: null, currency, note });
  revalidatePath("/admin/configuration");
  return { rateBps };
});

export const countryAction = action(z.object({ code: z.string().length(2), checkoutMode: z.enum(["INTEGRATED", "CLASSIFIED_ONLY", "DISABLED"]).optional(), payoutsEnabled: z.boolean().optional(), isActive: z.boolean().optional() }), async ({ code, ...data }) => {
  const staff = await requirePermission("compliance.write");
  await db.$transaction(async (tx) => {
    const before = await tx.country.findUniqueOrThrow({ where: { code } });
    await tx.country.update({ where: { code }, data });
    await audit({ actorId: staff.id, actorRoles: staff.roles, action: "country.update", targetType: "country", targetId: code, metadata: { before: { checkoutMode: before.checkoutMode, payoutsEnabled: before.payoutsEnabled, isActive: before.isActive }, after: data } }, tx);
  });
  revalidatePath("/admin/configuration");
  return { done: true };
});

export const complianceRuleAction = action(z.object({ id: z.uuid(), status: z.enum(["ALLOWED", "CONDITIONAL", "TO_VERIFY", "PROHIBITED"]), conditions: z.string().max(2000).optional(), reviewedByName: z.string().max(200).optional() }), async ({ id, status, conditions, reviewedByName }) => {
  const staff = await requirePermission("compliance.write");
  await db.$transaction(async (tx) => {
    const before = await tx.complianceRule.findUniqueOrThrow({ where: { id } });
    if ((status === "ALLOWED" || status === "CONDITIONAL") && before.originCountry !== before.destinationCountry && !reviewedByName)
      throw invalid("Ouvrir un flux transfrontalier exige le nom du professionnel ayant validé la conformité.");
    await tx.complianceRule.update({ where: { id }, data: { status, conditions: conditions ?? before.conditions, reviewedByName: reviewedByName ?? before.reviewedByName, reviewedAt: reviewedByName ? new Date() : before.reviewedAt, updatedById: staff.id } });
    await audit({ actorId: staff.id, actorRoles: staff.roles, action: "compliance.rule_update", targetType: "compliance_rule", targetId: id, metadata: { before: before.status, after: status, reviewedByName } }, tx);
  });
  invalidateComplianceCache();
  revalidatePath("/admin/configuration");
  return { done: true };
});

export const complianceRecordAction = action(z.object({ subjectType: z.enum(["CORRIDOR", "PAYMENT_PROVIDER", "CATEGORY", "LEGAL_DOCUMENT", "COUNTRY"]), subjectRef: z.string().min(2).max(120), title: z.string().min(3).max(200), validatedBy: z.string().min(3).max(200), documentRef: z.string().max(500).optional() }), async (i) => {
  const staff = await requirePermission("compliance.write");
  await db.$transaction(async (tx) => {
    const r = await tx.complianceRecord.create({ data: { ...i, validatedAt: new Date(), recordedById: staff.id } });
    await audit({ actorId: staff.id, actorRoles: staff.roles, action: "compliance.record_created", targetType: "compliance_record", targetId: r.id, metadata: i }, tx);
  });
  revalidatePath("/admin/configuration");
  return { done: true };
});

export const categoryToggleAction = action(z.object({ id: z.uuid(), field: z.enum(["isActive", "requiresReview", "isProhibited", "isTransactional"]), value: z.boolean() }), async ({ id, field, value }) => {
  const staff = await requirePermission("settings.write");
  await db.$transaction(async (tx) => {
    await tx.category.update({ where: { id }, data: { [field]: value } });
    await audit({ actorId: staff.id, actorRoles: staff.roles, action: "category.update", targetType: "category", targetId: id, metadata: { [field]: value } }, tx);
  });
  invalidateCatalogCache();
  revalidatePath("/admin/configuration");
  return { done: true };
});

export const payoutRetryAction = action(z.object({ payoutId: z.uuid() }), async ({ payoutId }) => {
  const staff = await requirePermission("payouts.manage");
  await releasePayout(payoutId);
  await audit({ actorId: staff.id, actorRoles: staff.roles, action: "payout.retry", targetType: "payout", targetId: payoutId });
  revalidatePath("/admin/paiements");
  return { done: true };
});

export const replayWebhooksAction = action(z.object({}), async () => {
  const staff = await requirePermission("payments.read");
  const n = await replayFailedWebhooks(50);
  await audit({ actorId: staff.id, actorRoles: staff.roles, action: "webhooks.replay", targetType: "webhook_event", metadata: { replayed: n } });
  revalidatePath("/admin/paiements");
  return { replayed: n };
});

/** Jeton d'API interne (Tamurt HQ) : affiché une seule fois, seule son empreinte est stockée. */
export const createApiClientAction = action(z.object({ name: z.string().trim().min(3).max(120), scopes: z.array(z.enum(["metrics:read"])).min(1), allowedIps: z.array(z.string().max(64)).max(20).default([]) }), async ({ name, scopes, allowedIps }) => {
  const staff = await requirePermission("api_clients.manage");
  const token = `tmhq_${randomToken(32)}`;
  const client = await db.serviceApiClient.create({ data: { name, scopes, allowedIps, tokenHash: sha256Hex(token), tokenPrefix: token.slice(0, 10), createdById: staff.id } });
  await audit({ actorId: staff.id, actorRoles: staff.roles, action: "api_client.created", targetType: "service_api_client", targetId: client.id, metadata: { name, scopes } });
  revalidatePath("/admin/configuration");
  return { token };
});

export const revokeApiClientAction = action(z.object({ id: z.uuid() }), async ({ id }) => {
  const staff = await requirePermission("api_clients.manage");
  await db.serviceApiClient.update({ where: { id }, data: { revokedAt: new Date() } });
  await audit({ actorId: staff.id, actorRoles: staff.roles, action: "api_client.revoked", targetType: "service_api_client", targetId: id });
  revalidatePath("/admin/configuration");
  return { done: true };
});
