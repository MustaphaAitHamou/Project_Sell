import { defineRouting } from "next-intl/routing";

/**
 * Langues publiées. Seul le français est complet et relu ; l'arabe (RTL), le kabyle
 * (tamazight, graphie latine) et l'anglais sont préparés (voir PLANNED_LOCALES) mais ne
 * seront activés qu'après traduction relue par des locuteurs : aucune traduction
 * automatique non relue n'est publiée.
 */
export const locales = ["fr"] as const;
export type AppLocale = (typeof locales)[number];

export const PLANNED_LOCALES = [
  { code: "ar", label: "العربية", dir: "rtl" },
  { code: "kab", label: "Taqbaylit", dir: "ltr" },
  { code: "en", label: "English", dir: "ltr" },
] as const;

const RTL = new Set<string>(["ar"]);
export const isRtl = (locale: string) => RTL.has(locale);

/** Locale BCP 47 utilisée pour les formats (dates, nombres, devises). */
export const intlLocale = (locale: string) => ({ fr: "fr-FR", ar: "ar-DZ", kab: "kab-DZ", en: "en-GB" })[locale] ?? "fr-FR";

export const routing = defineRouting({
  locales,
  defaultLocale: "fr",
  // Français sans préfixe (/explorer) ; les autres langues seront préfixées (/ar/explorer).
  localePrefix: "as-needed",
  localeDetection: false,
  localeCookie: false,
});
