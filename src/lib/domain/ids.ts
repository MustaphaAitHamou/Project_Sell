import { slugify } from "./text";

/**
 * Identifiants publics. Alphabet Crockford base32 sans caractères ambigus (pas de I, L, O, U),
 * en minuscules pour les URL. 10 caractères = 50 bits d'entropie : non énumérables.
 */
const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

function randomString(length: number, randomBytes: (n: number) => Uint8Array): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! & 31];
  return out;
}

const defaultRandom = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export function generatePublicId(randomBytes: (n: number) => Uint8Array = defaultRandom): string {
  return randomString(10, randomBytes);
}

/** Référence de commande lisible au téléphone : TM-XXXX-XXXX (majuscules). */
export function generateOrderReference(randomBytes: (n: number) => Uint8Array = defaultRandom): string {
  const s = randomString(8, randomBytes).toUpperCase();
  return `TM-${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Segment d'URL d'une annonce : « <slug-du-titre>-<publicId> ». */
export function listingPath(slug: string, publicId: string): string {
  return `/produit/${slug}-${publicId}`;
}

export function listingSlug(title: string): string {
  return slugify(title, 80);
}

const PUBLIC_ID_RE = /^[0-9a-hjkmnp-tv-z]{10}$/;

/** Extrait l'identifiant public d'un segment d'URL ; le slug peut avoir changé (redirection 301). */
export function parseListingSegment(segment: string): { publicId: string; slug: string } | null {
  const decoded = decodeURIComponent(segment).toLowerCase();
  const idx = decoded.lastIndexOf("-");
  const publicId = idx === -1 ? decoded : decoded.slice(idx + 1);
  if (!PUBLIC_ID_RE.test(publicId)) return null;
  return { publicId, slug: idx === -1 ? "" : decoded.slice(0, idx) };
}

export function isPublicId(value: string): boolean {
  return PUBLIC_ID_RE.test(value);
}

/** Pseudonyme public → identifiant d'URL de profil (« Amazigh Shop » → « amazigh-shop »). */
export function handleFromName(name: string): string {
  const s = slugify(name, 30);
  return s === "annonce" ? "membre" : s;
}

const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
export function isValidHandle(handle: string): boolean {
  return HANDLE_RE.test(handle) && !handle.includes("--");
}

/** Identifiants réservés (routes, marques, rôles) refusés comme pseudonymes publics. */
export const RESERVED_HANDLES = new Set([
  "admin", "administrateur", "support", "moderation", "moderateur", "tamurt", "tamurt-market", "tamurt-transport",
  "tamurt-services", "officiel", "official", "securite", "aide", "api", "compte", "vendre", "commande", "connexion",
  "inscription", "staff", "systeme", "system", "root", "null", "undefined",
]);
