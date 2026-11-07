import "server-only";
import { env } from "@/lib/env";
import type { CurrentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { getActiveCountries, getBrands, getCategoryAttributes, getRegions, getSelectableCategories } from "@/server/services/catalog";
import { getActiveBuyerFeeRule } from "@/server/services/fees";
import { isEnabled } from "@/server/settings";
import type { WizardAttribute, WizardCountry } from "./listing-wizard";

/** Données de référence du parcours de publication (référentiels en base, pas de valeurs figées). */
export async function getWizardData(user: CurrentUser) {
  const [categories, countries, brands, carriers, transportQuotes] = await Promise.all([
    getSelectableCategories(),
    getActiveCountries(),
    getBrands(),
    db.shippingProvider.findMany({ where: { kind: "NATIONAL_CARRIER", isEnabled: true }, select: { supportedCountries: true } }),
    isEnabled("transport.quotes"),
  ]);
  const attributes: Record<string, WizardAttribute[]> = {};
  for (const c of categories) attributes[c.id] = (await getCategoryAttributes(c.id)).map((a) => ({ key: a.key, label: a.label, type: a.type, options: a.options, unit: a.unit, isRequired: a.isRequired }));
  const regionsByCountry = Object.fromEntries(await Promise.all(countries.map(async (c) => [c.code, await getRegions(c.code)] as const)));
  const cities = await db.city.findMany({ where: { countryCode: { in: countries.map((c) => c.code) } }, orderBy: [{ isPopular: "desc" }, { name: "asc" }], select: { id: true, name: true, regionId: true } });
  const citiesByRegion: Record<string, { id: string; name: string }[]> = {};
  for (const c of cities) (citiesByRegion[c.regionId] ??= []).push({ id: c.id, name: c.name });
  const defaultCountry = countries.find((c) => c.code === user.profile?.countryCode) ?? countries[0]!;
  const fee = await getActiveBuyerFeeRule(defaultCountry.currency, defaultCountry.code);
  const wizardCountries: WizardCountry[] = countries.map((c) => ({ code: c.code, name: c.name, currency: c.currency, regionLabel: c.regionLabel, nationalShipping: carriers.some((p) => p.supportedCountries.includes(c.code)) }));
  return {
    categories,
    attributes,
    countries: wizardCountries,
    regionsByCountry,
    citiesByRegion,
    brands: brands.map((b) => b.name),
    buyerFeeRateBps: fee.rateBps,
    transportEnabled: env.TRANSPORT_INTEGRATION !== "disabled" && transportQuotes,
    defaultCountry: defaultCountry.code,
  };
}
