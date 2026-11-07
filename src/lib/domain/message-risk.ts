/**
 * Détection des signaux de risque dans les messages entre membres. L'objectif n'est
 * pas de censurer silencieusement mais de rendre visible le risque : le message est
 * remis, accompagné d'un avertissement à son destinataire, et le signal est conservé
 * pour la modération (contournement du paiement protégé, hameçonnage).
 */
export type MessageRiskFlag =
  | "external_link"
  | "suspicious_link"
  | "email_address"
  | "phone_number"
  | "off_platform_payment"
  | "credential_request";

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+|\b[a-z0-9-]{2,}\.(?:com|net|org|fr|dz|io|me|ly|link|app|xyz|top|shop|site|info|biz|co)\b(?:\/[^\s<>"']*)?/gi;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/i;
// Numéros français (+33 / 0X) et algériens (+213 / 05, 06, 07), espaces, points ou tirets tolérés.
const PHONE_RE = /(?:\+|00)\s?(?:33|213)[\s.-]?\d(?:[\s.-]?\d{2}){4}|\b0[1-9](?:[\s.-]?\d{2}){4}\b|\b0[567](?:[\s.-]?\d{2}){4}\b/;
const LINK_SHORTENERS = /\b(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|cutt\.ly|is\.gd|rb\.gy|shorturl\.at|wa\.me|t\.me)\b/i;
const OFF_PLATFORM = [
  /\bwestern\s*union\b/i,
  /\bmoney\s*gram\b/i,
  /\bpaypal\b.{0,20}\b(?:ami|amis|proche|friends?)\b/i,
  /\b(?:virement|iban|rib)\b/i,
  /\bbaridi\s*mob\b/i,
  /\b(?:ccp|edahabia)\b.{0,30}\b(?:num[eé]ro|n°|compte)\b/i,
  /\bpayer?\s+(?:hors|en dehors)\s+(?:du\s+)?site\b/i,
  /\bmandat\s*cash\b/i,
  /\bcrypto|bitcoin|usdt\b/i,
];
const CREDENTIALS = [/\bmot\s+de\s+passe\b/i, /\bcode\s+(?:de\s+)?(?:confirmation|v[ée]rification|sms|otp)\b/i, /\bcode\s+(?:de\s+)?remise\b/i];

/** Domaines de confiance pour lesquels un lien n'est pas signalé (ex. le site lui-même). */
export function analyzeMessage(body: string, trustedHosts: readonly string[] = []): MessageRiskFlag[] {
  const flags = new Set<MessageRiskFlag>();
  const urls = body.match(URL_RE) ?? [];
  for (const raw of urls) {
    const host = raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#:]/)[0]!.toLowerCase();
    if (trustedHosts.some((t) => host === t || host.endsWith(`.${t}`))) continue;
    flags.add("external_link");
    if (LINK_SHORTENERS.test(raw) || /xn--/.test(host) || /\d{1,3}(?:\.\d{1,3}){3}/.test(host)) flags.add("suspicious_link");
  }
  if (EMAIL_RE.test(body)) flags.add("email_address");
  if (PHONE_RE.test(body)) flags.add("phone_number");
  if (OFF_PLATFORM.some((re) => re.test(body))) flags.add("off_platform_payment");
  if (CREDENTIALS.some((re) => re.test(body))) flags.add("credential_request");
  return [...flags];
}

/** Signaux justifiant un avertissement visible du destinataire. */
export function requiresRecipientWarning(flags: readonly string[]): boolean {
  return flags.some((f) => f === "suspicious_link" || f === "off_platform_payment" || f === "credential_request" || f === "external_link");
}
