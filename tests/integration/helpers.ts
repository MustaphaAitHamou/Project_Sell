import { COMPLIANCE_RULES } from "@/lib/config/platform-defaults";
import type { DeliveryMethod, StaffRole } from "@/generated/prisma/client";
import { generatePublicId, listingSlug } from "@/lib/domain/ids";
import { sandboxFee, SANDBOX_SIGNATURE_HEADER, signSandboxEvent } from "@/integrations/payment-providers/sandbox";
import type { CurrentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { drainJobs } from "@/server/jobs/runner";
import { invalidateCatalogCache } from "@/server/services/catalog";
import { invalidateComplianceCache } from "@/server/services/compliance";
import { handlePaymentWebhook } from "@/server/services/payments";
import { invalidateConfigCache } from "@/server/settings";
import { COUNTRIES } from "../../prisma/reference/geography";

/** Tables de référence conservées entre les fichiers de test (référentiels du seed). */
const REFERENCE = new Set(["country", "region", "city", "category", "category_attribute", "brand", "fee_rule", "compliance_rule", "shipping_provider"]);

/** Vide toutes les tables transactionnelles et restaure la configuration de référence. */
export async function resetDatabase() {
  const rows = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const tables = rows.map((r) => r.tablename).filter((t) => !REFERENCE.has(t));
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
  await restoreConfig();
}

export async function restoreConfig() {
  for (const c of COUNTRIES) await db.country.update({ where: { code: c.code }, data: { isActive: c.isActive, checkoutMode: c.checkoutMode, payoutsEnabled: c.payoutsEnabled } });
  for (const r of COMPLIANCE_RULES) {
    await db.complianceRule.updateMany({ where: { originCountry: r.originCountry ?? null, destinationCountry: r.destinationCountry ?? null, categoryId: null }, data: { status: r.status } });
  }
  invalidateConfigCache();
  invalidateComplianceCache();
  invalidateCatalogCache();
}

let counter = 0;

export async function makeUser(opts: { country?: "FR" | "DZ"; roles?: StaffRole[]; business?: boolean; verified?: boolean } = {}): Promise<CurrentUser> {
  const id = crypto.randomUUID();
  const handle = `testeur-${(++counter).toString(36)}-${id.slice(0, 6)}`;
  const country = opts.country ?? "FR";
  const roles = opts.roles ?? [];
  const sellerType = opts.business ? "BUSINESS" : "INDIVIDUAL";
  await db.user.create({
    data: {
      id,
      name: handle,
      email: `${handle}@test.invalid`,
      emailVerified: opts.verified ?? true,
      termsAcceptedAt: new Date(),
      onboardedAt: new Date(),
      profile: { create: { handle, displayName: `Testeur ${counter}`, countryCode: country, sellerType } },
      ...(roles.length ? { roles: { create: roles.map((role) => ({ role })) } } : {}),
    },
  });
  return {
    id,
    email: `${handle}@test.invalid`,
    name: handle,
    image: null,
    status: "ACTIVE",
    emailVerified: opts.verified ?? true,
    twoFactorEnabled: false,
    termsAccepted: true,
    onboarded: true,
    roles,
    isStaff: roles.length > 0,
    profile: { handle, displayName: `Testeur ${counter}`, countryCode: country, regionId: null, sellerType, avatarKey: null },
  };
}

export async function makeListing(
  seller: CurrentUser,
  opts: { price?: number; country?: "FR" | "DZ"; deliveryMethods?: DeliveryMethod[]; title?: string; categorySlug?: string; quantity?: number; acceptsCrossBorder?: boolean; description?: string; regionCode?: string; cityName?: string; brandName?: string } = {},
) {
  const country = opts.country ?? "FR";
  const category = await db.category.findFirstOrThrow({ where: { slug: opts.categorySlug ?? "decoration", isActive: true } });
  const region = await db.region.findFirstOrThrow({ where: { countryCode: country, ...(opts.regionCode ? { code: opts.regionCode } : {}) }, orderBy: { code: "asc" } });
  const city = opts.cityName ? await db.city.findFirst({ where: { name: opts.cityName, countryCode: country } }) : null;
  const title = opts.title ?? `Objet de test ${++counter}`;
  return db.listing.create({
    data: {
      publicId: generatePublicId(),
      slug: listingSlug(title),
      sellerId: seller.id,
      title,
      description: opts.description ?? "Description de test suffisamment longue pour une annonce réaliste.",
      categoryId: category.id,
      condition: "VERY_GOOD",
      priceAmount: opts.price ?? 2490,
      currency: country === "FR" ? "EUR" : "DZD",
      countryCode: country,
      regionId: region.id,
      cityId: city?.id ?? null,
      brandName: opts.brandName ?? null,
      quantity: opts.quantity ?? 1,
      quantityAvailable: opts.quantity ?? 1,
      deliveryMethods: opts.deliveryMethods ?? ["HAND_DELIVERY"],
      parcelSize: "S",
      weightGrams: 800,
      acceptsCrossBorder: opts.acceptsCrossBorder ?? false,
      status: "ACTIVE",
      publishedAt: new Date(),
    },
  });
}

/** Webhook de paiement réussi signé, transmis au même gestionnaire que la route HTTP. */
export async function paySandbox(orderId: string, opts: { eventId?: string; paymentId?: string; session?: string; amount?: number } = {}) {
  const payment = await db.payment.findFirstOrThrow({ where: { orderId, ...(opts.session ? { providerSessionId: opts.session } : {}) }, orderBy: { createdAt: "desc" } });
  const raw = JSON.stringify({
    id: opts.eventId ?? `evt_${crypto.randomUUID()}`,
    type: "payment.succeeded",
    data: { session: payment.providerSessionId, payment: opts.paymentId ?? `sbx_pi_${crypto.randomUUID().slice(0, 18)}`, amount: opts.amount ?? payment.amount, currency: payment.currency, fee: sandboxFee(payment.amount) },
  });
  return { raw, result: await handlePaymentWebhook("sandbox", raw, new Headers({ [SANDBOX_SIGNATURE_HEADER]: signSandboxEvent(raw) })) };
}

export async function replayWebhook(raw: string) {
  return handlePaymentWebhook("sandbox", raw, new Headers({ [SANDBOX_SIGNATURE_HEADER]: signSandboxEvent(raw) }));
}

/** Exécute les tâches en file (e-mails vers la boîte simulée, remboursements, versements…). */
export async function runJobs() {
  for (let i = 0; i < 5; i++) {
    const n = await drainJobs(200);
    if (!n) break;
  }
  await db.job.updateMany({ where: { status: "PENDING", runAt: { gt: new Date() } }, data: { runAt: new Date() } });
  await drainJobs(200);
}

export async function ledgerBalance() {
  const rows = await db.$queryRaw<{ currency: string; balance: bigint }[]>`
    SELECT "currency", SUM(CASE WHEN "direction" = 'DEBIT' THEN "amount" ELSE -"amount" END) AS balance FROM "ledger_entry" GROUP BY 1`;
  return Object.fromEntries(rows.map((r) => [r.currency, Number(r.balance)]));
}

/** Solde d'un compte du registre (débit positif), pour une commande donnée. */
export async function accountBalance(account: string, orderId: string, currency = "EUR") {
  const [row] = await db.$queryRaw<{ balance: bigint | null }[]>`
    SELECT SUM(CASE WHEN e."direction" = 'DEBIT' THEN e."amount" ELSE -e."amount" END) AS balance
    FROM "ledger_entry" e JOIN "ledger_transaction" t ON t."id" = e."transactionId"
    WHERE e."account" = ${account} AND e."currency" = ${currency} AND t."orderId" = ${orderId}::uuid`;
  return Number(row?.balance ?? 0);
}

export async function makeAddress(user: CurrentUser, country: "FR" | "DZ", city = country === "FR" ? "Lyon" : "Béjaïa") {
  const region = await db.region.findFirstOrThrow({ where: { countryCode: country }, orderBy: { code: "asc" } });
  return db.address.create({ data: { userId: user.id, fullName: "Destinataire Test", line1: "1 rue de l'Essai", postalCode: country === "FR" ? "69001" : "06000", city, regionId: region.id, countryCode: country, phone: "+33600000000", isDefault: true } });
}

export async function setFlag(key: string, enabled: boolean) {
  await db.featureFlag.upsert({ where: { key }, create: { key, enabled, description: "test" }, update: { enabled } });
  invalidateConfigCache();
}

export async function setCompliance(origin: string, destination: string, status: "ALLOWED" | "CONDITIONAL" | "TO_VERIFY" | "PROHIBITED") {
  await db.complianceRule.updateMany({ where: { originCountry: origin, destinationCountry: destination, categoryId: null }, data: { status } });
  invalidateComplianceCache();
}
