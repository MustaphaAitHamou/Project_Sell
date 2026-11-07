/**
 * Montants monétaires. Tous les montants sont des entiers en unités mineures
 * (exposant ISO 4217) accompagnés de leur devise. Aucune arithmétique flottante
 * n'est appliquée sur un montant : seules l'addition, la soustraction et la
 * multiplication entières, plus un arrondi explicite pour les taux.
 */

export interface CurrencyInfo {
  code: string;
  /** Exposant ISO 4217 : nombre de décimales des unités mineures. */
  exponent: number;
  /** Locale de formatage préférée pour l'affichage en français. */
  frLocale: string;
}

/** Devises prises en charge. Le DZD a un exposant ISO 4217 de 2 (centimes non utilisés en pratique). */
export const CURRENCIES: Record<string, CurrencyInfo> = {
  EUR: { code: "EUR", exponent: 2, frLocale: "fr-FR" },
  DZD: { code: "DZD", exponent: 2, frLocale: "fr-DZ" },
  USD: { code: "USD", exponent: 2, frLocale: "fr-FR" },
  CAD: { code: "CAD", exponent: 2, frLocale: "fr-CA" },
  GBP: { code: "GBP", exponent: 2, frLocale: "fr-FR" },
  CHF: { code: "CHF", exponent: 2, frLocale: "fr-CH" },
};

/** Plafond de sécurité d'un montant unitaire (10 000 000,00) : bien en deçà de Number.MAX_SAFE_INTEGER. */
export const MAX_AMOUNT_MINOR = 1_000_000_000;
export const BPS_DENOMINATOR = 10_000;
/** Garde-fou contre une erreur de configuration d'un taux (50 %). */
export const MAX_RATE_BPS = 5_000;

export class MoneyError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

export function currencyInfo(code: string): CurrencyInfo {
  const info = CURRENCIES[code];
  if (!info) throw new MoneyError(`Devise non prise en charge : ${code}`);
  return info;
}

export function isSupportedCurrency(code: string): boolean {
  return code in CURRENCIES;
}

/** Vérifie qu'une valeur est un montant entier positif ou nul, sûr en arithmétique JS. */
export function assertMinor(amount: number, label = "montant"): void {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw new MoneyError(`${label} doit être un entier positif en unités mineures (reçu : ${amount})`);
}

/** Somme de montants entiers avec contrôle de dépassement. */
export function sumMinor(...amounts: number[]): number {
  let total = 0;
  for (const a of amounts) {
    assertMinor(a);
    total += a;
    if (!Number.isSafeInteger(total)) throw new MoneyError("Dépassement de capacité");
  }
  return total;
}

/** Produit montant × quantité avec contrôle de dépassement. */
export function multiplyMinor(amount: number, quantity: number): number {
  assertMinor(amount);
  if (!Number.isSafeInteger(quantity) || quantity < 0) throw new MoneyError("Quantité invalide");
  const result = amount * quantity;
  if (!Number.isSafeInteger(result)) throw new MoneyError("Dépassement de capacité");
  return result;
}

/**
 * Application d'un taux exprimé en points de base (1 000 = 10 %), arrondi au plus
 * proche, la demi-unité vers le haut, en arithmétique entière exclusivement.
 * Ex. 5 000 (50,00 €) × 1 000 bps = 500 (5,00 €) ; 1 005 × 1 000 bps = 101 (100,5 → 101).
 */
export function applyRateBps(amount: number, rateBps: number): number {
  assertMinor(amount);
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > MAX_RATE_BPS)
    throw new MoneyError(`Taux invalide : ${rateBps} bps`);
  const numerator = amount * rateBps;
  if (!Number.isSafeInteger(numerator)) throw new MoneyError("Dépassement de capacité");
  return Math.floor((numerator + BPS_DENOMINATOR / 2) / BPS_DENOMINATOR);
}

/**
 * Conversion d'une saisie utilisateur (« 12,50 », « 12.5 », « 1 200 ») en unités mineures,
 * sans passer par un flottant. Retourne null si la saisie est invalide.
 */
export function parseAmountToMinor(input: string, currency: string): number | null {
  const { exponent } = currencyInfo(currency);
  const s = input.trim().replace(/[\s  ]/g, "").replace(",", ".");
  const pattern = exponent > 0 ? new RegExp(`^(\\d{1,10})(?:\\.(\\d{1,${exponent}}))?$`) : /^(\d{1,12})$/;
  const m = pattern.exec(s);
  if (!m) return null;
  const units = Number(m[1]);
  const fraction = Number((m[2] ?? "").padEnd(exponent, "0") || "0");
  const minor = units * 10 ** exponent + fraction;
  if (!Number.isSafeInteger(minor) || minor > MAX_AMOUNT_MINOR) return null;
  return minor;
}

/** Représentation décimale exacte (chaîne) d'un montant, pour les formulaires et exports. */
export function minorToDecimalString(minor: number, currency: string): string {
  assertMinor(minor);
  const { exponent } = currencyInfo(currency);
  if (exponent === 0) return String(minor);
  const s = String(minor).padStart(exponent + 1, "0");
  return `${s.slice(0, -exponent)}.${s.slice(-exponent)}`;
}

/**
 * Formatage localisé. Les décimales ne sont affichées que si le montant n'est pas rond
 * (« 50 € », « 12,50 € », « 15 000 DA »). Le calcul se fait sur la chaîne décimale exacte.
 */
export function formatMoney(minor: number, currency: string, locale?: string): string {
  const info = currencyInfo(currency);
  const loc = locale && !locale.startsWith("fr") ? locale : info.frLocale;
  const divisor = 10 ** info.exponent;
  const hasFraction = minor % divisor !== 0;
  const formatter = new Intl.NumberFormat(loc, {
    style: "currency",
    currency,
    minimumFractionDigits: hasFraction ? info.exponent : 0,
    maximumFractionDigits: info.exponent,
  });
  // Intl accepte une chaîne décimale exacte : aucun arrondi binaire n'intervient.
  return formatter.format(minorToDecimalString(Math.abs(minor), currency) as unknown as number).replace(/^/, minor < 0 ? "−" : "");
}
