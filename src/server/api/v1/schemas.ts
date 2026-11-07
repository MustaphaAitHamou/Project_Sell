import { z } from "zod";

/**
 * Schémas des réponses de l'API publique v1. Chaque réponse est passée dans `.parse()` :
 * les objets Zod retirent toute clé non déclarée, ce qui garantit qu'aucun champ privé
 * (coordonnées, identifiants internes, statut de modération…) ne peut fuiter par erreur.
 * Les mêmes schémas alimentent la spécification OpenAPI.
 */
export const moneySchema = z.object({ amount: z.int().meta({ description: "Montant en unités minimales (centimes)." }), currency: z.string().length(3), formatted: z.string() }).meta({ id: "Money" });

export const categorySchema = z
  .object({
    slug: z.string(),
    name: z.string(),
    parentSlug: z.string().nullable(),
    transactional: z.boolean().meta({ description: "Achat intégré possible dans cette catégorie." }),
    reviewedBeforePublication: z.boolean(),
  })
  .meta({ id: "Category" });

export const sellerSummarySchema = z
  .object({
    handle: z.string(),
    displayName: z.string(),
    type: z.enum(["INDIVIDUAL", "BUSINESS"]),
    identityVerified: z.boolean(),
    rating: z.object({ average: z.number().nullable(), count: z.int() }),
    salesCount: z.int(),
    url: z.string(),
  })
  .meta({ id: "SellerSummary" });

export const listingCardSchema = z
  .object({
    id: z.string().meta({ description: "Identifiant public de l'annonce." }),
    title: z.string(),
    price: moneySchema,
    condition: z.string(),
    brand: z.string().nullable(),
    country: z.string().length(2),
    location: z.string().nullable(),
    deliveryMethods: z.array(z.enum(["HAND_DELIVERY", "NATIONAL_SHIPPING", "TAMURT_TRANSPORT"])),
    status: z.enum(["ACTIVE", "RESERVED", "SOLD"]),
    image: z.string().nullable(),
    publishedAt: z.iso.datetime().nullable(),
    isDemo: z.boolean().meta({ description: "Annonce fictive de démonstration." }),
    url: z.string(),
  })
  .meta({ id: "ListingCard" });

export const listingDetailSchema = listingCardSchema
  .extend({
    description: z.string(),
    category: z.object({ slug: z.string(), name: z.string() }),
    attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
    images: z.array(z.object({ thumb: z.string(), large: z.string(), width: z.int().nullable(), height: z.int().nullable() })),
    quantityAvailable: z.int(),
    parcelSize: z.string().nullable(),
    acceptsCrossBorder: z.boolean(),
    seller: sellerSummarySchema,
  })
  .meta({ id: "ListingDetail" });

export const listingPageSchema = z
  .object({ items: z.array(listingCardSchema), page: z.int(), pageCount: z.int(), total: z.int(), pageSize: z.int() })
  .meta({ id: "ListingPage" });

export const sellerProfileSchema = sellerSummarySchema
  .extend({
    bio: z.string().nullable(),
    location: z.string().nullable(),
    memberSince: z.iso.datetime(),
    business: z.object({ legalName: z.string(), tradeName: z.string().nullable(), registrationCountry: z.string() }).nullable().meta({ description: "Identité du vendeur professionnel (obligation d'information)." }),
    listings: z.array(listingCardSchema),
  })
  .meta({ id: "SellerProfile" });

export const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) }).meta({ id: "Error" });
