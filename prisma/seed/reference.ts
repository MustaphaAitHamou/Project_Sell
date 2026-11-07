import { CATEGORIES, BRANDS, type CategoryDef } from "../reference/catalog";
import { CITIES, COUNTRIES, DZ_WILAYAS, FR_DEPARTMENTS, GEO_DATASETS } from "../reference/geography";
import { COMPLIANCE_RULES, FEATURE_FLAGS, INITIAL_FEE_RULES, PLATFORM_SETTINGS, SHIPPING_PROVIDERS } from "@/lib/config/platform-defaults";
import { normalizeForSearch, slugify } from "@/lib/domain/text";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Référentiels et configuration initiale. Idempotent : les référentiels sont mis à
 * jour (noms, ordre), la configuration administrable (indicateurs, réglages, frais,
 * matrice de conformité, transporteurs) n'est créée que si elle est absente.
 */
export async function seedReference(db: PrismaClient) {
  for (const c of COUNTRIES) {
    const datasetVersion = (GEO_DATASETS as Record<string, string>)[c.code] ?? null;
    await db.country.upsert({
      where: { code: c.code },
      create: { ...c, geoDatasetVersion: datasetVersion },
      update: { name: c.name, nativeName: c.nativeName, currency: c.currency, phonePrefix: c.phonePrefix, regionLabel: c.regionLabel, sortOrder: c.sortOrder, geoDatasetVersion: datasetVersion },
    });
  }

  const regionIds = new Map<string, string>();
  const regionSets: [string, readonly (readonly [string, string])[]][] = [
    ["FR", FR_DEPARTMENTS],
    ["DZ", DZ_WILAYAS],
  ];
  for (const [country, list] of regionSets) {
    let i = 0;
    for (const [code, name] of list) {
      const r = await db.region.upsert({
        where: { countryCode_code: { countryCode: country, code } },
        create: { countryCode: country, code, name, slug: slugify(name), datasetVersion: GEO_DATASETS[country as "FR" | "DZ"], sortOrder: i },
        update: { name, slug: slugify(name), datasetVersion: GEO_DATASETS[country as "FR" | "DZ"], sortOrder: i },
      });
      regionIds.set(`${country}:${code}`, r.id);
      i++;
    }
  }

  for (const [country, regionCode, name, variants, popular] of CITIES) {
    const regionId = regionIds.get(`${country}:${regionCode}`);
    if (!regionId) throw new Error(`Région inconnue ${country}:${regionCode}`);
    const searchNames = [...new Set([normalizeForSearch(name), ...variants.map(normalizeForSearch)])];
    await db.city.upsert({
      where: { countryCode_slug: { countryCode: country, slug: slugify(name) } },
      create: { countryCode: country, regionId, name, slug: slugify(name), searchNames, isPopular: popular },
      update: { name, regionId, searchNames, isPopular: popular },
    });
  }

  const upsertCategory = async (def: CategoryDef, parentId: string | null, sortOrder: number) => {
    const data = {
      name: def.name,
      icon: def.icon ?? null,
      description: def.description ?? null,
      parentId,
      sortOrder,
      isActive: def.isActive ?? true,
      isTransactional: def.isTransactional ?? true,
      requiresReview: def.requiresReview ?? false,
      isProhibited: def.isProhibited ?? false,
      conditionRequired: def.conditionRequired ?? true,
    };
    const cat = await db.category.upsert({ where: { slug: def.slug }, create: { slug: def.slug, ...data }, update: data });
    let a = 0;
    for (const attr of def.attributes ?? []) {
      const attrData = {
        label: attr.label,
        type: attr.type,
        options: attr.options ? [...attr.options] : undefined,
        unit: attr.unit ?? null,
        isRequired: attr.isRequired ?? false,
        isFilterable: attr.isFilterable ?? false,
        sortOrder: a++,
      };
      await db.categoryAttribute.upsert({
        where: { categoryId_key: { categoryId: cat.id, key: attr.key } },
        create: { categoryId: cat.id, key: attr.key, ...attrData },
        update: attrData,
      });
    }
    let c = 0;
    for (const child of def.children ?? []) await upsertCategory(child, cat.id, c++);
  };
  let order = 0;
  for (const def of CATEGORIES) await upsertCategory(def, null, order++);

  for (const name of BRANDS) {
    await db.brand.upsert({
      where: { slug: slugify(name) },
      create: { name, slug: slugify(name), normalizedName: normalizeForSearch(name) },
      update: { name },
    });
  }

  for (const p of SHIPPING_PROVIDERS) {
    await db.shippingProvider.upsert({
      where: { code: p.code },
      create: { ...p, supportedCountries: [...p.supportedCountries], capabilities: p.capabilities },
      update: {},
    });
  }

  for (const f of FEATURE_FLAGS) {
    await db.featureFlag.upsert({ where: { key: f.key }, create: { key: f.key, enabled: f.enabled, description: f.description }, update: { description: f.description } });
  }
  for (const s of PLATFORM_SETTINGS) {
    await db.platformSetting.upsert({ where: { key: s.key }, create: { key: s.key, value: s.value }, update: {} });
  }

  for (const rule of INITIAL_FEE_RULES) {
    const existing = await db.feeRule.findFirst({ where: { kind: rule.kind } });
    if (!existing) await db.feeRule.create({ data: { ...rule, activeFrom: new Date("2026-01-01T00:00:00Z") } });
  }

  for (const rule of COMPLIANCE_RULES) {
    const categoryId = rule.categorySlug ? (await db.category.findUniqueOrThrow({ where: { slug: rule.categorySlug } })).id : null;
    const existing = await db.complianceRule.findFirst({
      where: { originCountry: rule.originCountry, destinationCountry: rule.destinationCountry, categoryId, paymentProvider: null, carrier: null },
    });
    if (!existing)
      await db.complianceRule.create({
        data: { originCountry: rule.originCountry, destinationCountry: rule.destinationCountry, categoryId, status: rule.status, notes: rule.notes },
      });
  }

  for (const system of ["TRANSPORT", "PAYMENT", "SHIPPING"]) {
    await db.integrationHealth.upsert({ where: { system }, create: { system }, update: {} });
  }
}
