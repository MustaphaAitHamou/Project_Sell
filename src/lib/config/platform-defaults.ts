/**
 * Configuration initiale de la plateforme. Toutes ces valeurs sont modifiables dans
 * /admin/configuration (journalisé) ; le seed ne les écrase jamais une fois créées.
 */

/** Indicateurs de fonctionnalités. Un indicateur actif ne suffit pas : chaque fonction
 *  vérifie aussi ses prérequis techniques (prestataire configuré, corridor validé…). */
export const FEATURE_FLAGS = [
  { key: "checkout.enabled", enabled: true, description: "Achat intégré (exige un prestataire de paiement configuré et un pays en mode INTEGRATED)." },
  { key: "checkout.crossBorder", enabled: false, description: "Achats transfrontaliers. Ne pas activer sans validation juridique documentée (registre de conformité)." },
  { key: "transport.quotes", enabled: true, description: "Devis Tamurt Transport sur les fiches produit (exige TRANSPORT_INTEGRATION ≠ disabled)." },
  { key: "transport.reservations", enabled: true, description: "Réservation de capacité Tamurt Transport lors d'une commande éligible." },
  { key: "listings.autoApprove", enabled: true, description: "Publication directe des annonces hors catégories réglementées et hors mots-clés sensibles." },
  { key: "messaging.attachments", enabled: true, description: "Pièces jointes (images) dans la messagerie." },
  { key: "reviews.enabled", enabled: true, description: "Avis après transaction." },
  { key: "savedSearches.enabled", enabled: true, description: "Recherches sauvegardées." },
  { key: "ai.titleSuggestion", enabled: false, description: "Suggestion de titre par IA (non implémentée, fournisseur à choisir)." },
  { key: "ai.categorySuggestion", enabled: false, description: "Suggestion de catégorie (non implémentée)." },
  { key: "ai.priceRecommendation", enabled: false, description: "Recommandation de prix (non implémentée)." },
  { key: "ai.moderationAssist", enabled: false, description: "Aide à la modération (non implémentée ; aucune sanction automatique)." },
  { key: "ai.semanticSearch", enabled: false, description: "Recherche sémantique (non implémentée)." },
] as const;

export const PLATFORM_SETTINGS = [
  { key: "orders.reservationTtlMinutes", value: 30 },
  { key: "orders.shipWithinDays", value: 5 },
  { key: "orders.handoverWithinDays", value: 10 },
  { key: "protection.disputeWindowHours", value: 48 },
  { key: "protection.notReceivedAfterDays", value: 10 },
  { key: "protection.sellerResponseHours", value: 72 },
  { key: "orders.handoverMaxAttempts", value: 5 },
  { key: "payouts.delayHours", value: 0 },
  // Plafond de remboursement décidé par le support sans la permission finance (unités mineures par devise).
  { key: "support.maxRefundMinor", value: { EUR: 10000, DZD: 1500000 } },
  { key: "listings.maxImages", value: 10 },
  { key: "listings.maxActivePerIndividual", value: 300 },
  { key: "messaging.maxNewConversationsPerDay", value: 30 },
  { key: "messaging.maxMessagesPerMinute", value: 20 },
] as const;

export const SHIPPING_PROVIDERS = [
  {
    code: "hand_delivery",
    name: "Remise en main propre",
    kind: "HAND_DELIVERY",
    isEnabled: true,
    isSandbox: false,
    supportedCountries: ["FR", "DZ"],
    supportsCrossBorder: false,
    capabilities: { handoverCode: true },
    notes: "Remise confirmée par un code à usage unique communiqué par l'acheteur.",
  },
  {
    code: "sandbox_national",
    name: "Livraison nationale (simulation)",
    kind: "NATIONAL_CARRIER",
    isEnabled: true,
    isSandbox: true,
    supportedCountries: ["FR"],
    supportsCrossBorder: false,
    capabilities: { quote: true, label: true, tracking: true, cancel: true, pickupPoints: false, returns: false, incidents: true },
    notes: "Simulateur local : aucune expédition réelle. Tarifs fictifs par format de colis. Refusé en production.",
  },
  {
    code: "tamurt_transport",
    name: "Tamurt Transport",
    kind: "CROWDSHIPPING",
    isEnabled: true,
    isSandbox: false,
    supportedCountries: ["FR", "DZ"],
    supportsCrossBorder: true,
    capabilities: { quote: true, reservation: true, tracking: true, cancel: true, incidents: true },
    notes: "Intégration par API versionnée (contrat v1 proposé, non encore exposé par Tamurt Transport). Simulateur en développement.",
  },
  { code: "colissimo", name: "Colissimo", kind: "NATIONAL_CARRIER", isEnabled: false, isSandbox: false, supportedCountries: ["FR"], supportsCrossBorder: false, capabilities: {}, notes: "À étudier : contrat entreprise et accès API requis. Non intégré." },
  { code: "mondial_relay", name: "Mondial Relay", kind: "NATIONAL_CARRIER", isEnabled: false, isSandbox: false, supportedCountries: ["FR"], supportsCrossBorder: false, capabilities: {}, notes: "À étudier : points relais, contrat et API. Non intégré." },
  { code: "chronopost", name: "Chronopost", kind: "NATIONAL_CARRIER", isEnabled: false, isSandbox: false, supportedCountries: ["FR"], supportsCrossBorder: false, capabilities: {}, notes: "À étudier. Non intégré." },
  { code: "dz_national_carrier", name: "Transporteur national Algérie", kind: "NATIONAL_CARRIER", isEnabled: false, isSandbox: false, supportedCountries: ["DZ"], supportsCrossBorder: false, capabilities: {}, notes: "Prestataire à sélectionner (API et contrat adaptés à une marketplace, paiement à la livraison à étudier). Non intégré." },
] as const;

/**
 * Matrice de conformité initiale. Aucun flux transfrontalier n'est présumé autorisé :
 * FR⇄DZ est « À vérifier » (donc bloqué) tant qu'une validation juridique n'est pas
 * enregistrée et la règle mise à jour par un super-administrateur.
 */
export const COMPLIANCE_RULES = [
  { originCountry: "FR", destinationCountry: "FR", categorySlug: null, status: "ALLOWED", notes: "Ventes nationales France (sous réserve des catégories interdites et réglementées)." },
  { originCountry: "DZ", destinationCountry: "DZ", categorySlug: null, status: "ALLOWED", notes: "Annonces nationales Algérie. Achat intégré indisponible tant qu'aucun prestataire de paiement conforme n'est contractualisé (mode petites annonces)." },
  {
    originCountry: "FR",
    destinationCountry: "DZ",
    categorySlug: null,
    status: "TO_VERIFY",
    notes: "Corridor non validé : réglementation douanière (déclaration, franchises, produits soumis à autorisation), cadre du transport par particuliers, assurance, moyens de paiement et contrôle des changes. Voir docs/COMPLIANCE.md.",
  },
  {
    originCountry: "DZ",
    destinationCountry: "FR",
    categorySlug: null,
    status: "TO_VERIFY",
    notes: "Corridor non validé : exportation depuis l'Algérie (biens culturels, artisanat ancien), importation UE (TVA, droits, sécurité des produits), paiement et versement au vendeur résidant en Algérie.",
  },
  {
    originCountry: "DZ",
    destinationCountry: null,
    categorySlug: "art-oeuvres",
    status: "TO_VERIFY",
    notes: "Biens culturels : l'exportation peut être soumise à autorisation. À instruire avec un juriste avant toute ouverture.",
  },
] as const;

/** Règle de frais initiale : protection acheteur de 10 % ajoutée au prix des articles. */
export const INITIAL_FEE_RULES = [
  { kind: "BUYER_PROTECTION", currency: null, countryCode: null, sellerType: null, rateBps: 1000, fixedAmount: 0, minAmount: 0, maxAmount: null, note: "Valeur initiale fixée à 10 % (cahier des charges)." },
] as const;
