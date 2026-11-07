/** Normalisation de texte pour la recherche et les slugs : minuscules, sans accents. */
export function normalizeForSearch(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Slug ASCII stable. Les écritures non latines (arabe, tifinagh) produisent un repli. */
export function slugify(input: string, maxLength = 80): string {
  const base = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ɛƐ]/g, "e")
    .replace(/[ɣƔ]/g, "g")
    .replace(/[œ]/g, "oe")
    .replace(/[æ]/g, "ae")
    .replace(/[ß]/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return base || "annonce";
}

/**
 * Nettoyage des textes saisis : suppression des caractères de contrôle et des
 * caractères invisibles de direction (utilisés pour masquer des liens ou usurper un affichage),
 * normalisation Unicode NFC, espaces superflus.
 */
export function sanitizeText(input: string, { multiline = true }: { multiline?: boolean } = {}): string {
  let s = input.normalize("NFC");
  // Contrôles C0/C1 (hors tabulation et retour à la ligne) et marques bidirectionnelles.
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩﻿]/g, "");
  if (!multiline) s = s.replace(/[\r\n\t]+/g, " ");
  s = s.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

export function truncate(input: string, max: number): string {
  return input.length <= max ? input : `${input.slice(0, max - 1).trimEnd()}…`;
}
