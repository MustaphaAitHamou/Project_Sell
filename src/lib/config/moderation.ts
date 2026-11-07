/**
 * Mots-clés déclenchant une vérification manuelle avant publication (jamais un refus
 * automatique : « pistolet à colle » ou « réplique de maillot » doivent pouvoir être
 * examinés par un humain). Liste prudente, non exhaustive, administrable.
 */
export const REVIEW_KEYWORDS = [
  "arme", "pistolet", "fusil", "munition", "couteau papillon", "taser", "matraque", "cannabis", "cbd", "drogue",
  "medicament", "ordonnance", "antibiotique", "contrefacon", "replique", "copie conforme", "faux billet", "tabac",
  "cigarette", "alcool", "ivoire", "animal vivant", "chiot", "chaton", "carte grise", "passeport", "permis de conduire",
] as const;
