import { z } from "zod";

export const CONDITIONS = ["NEW_WITH_TAGS", "NEW_WITHOUT_TAGS", "VERY_GOOD", "GOOD", "FAIR", "FOR_PARTS"] as const;
export const DELIVERY_METHODS = ["HAND_DELIVERY", "NATIONAL_SHIPPING", "TAMURT_TRANSPORT"] as const;
export const PARCEL_SIZES = ["XS", "S", "M", "L", "XL"] as const;
export const MAX_LISTING_IMAGES = 10;

/** Poids maximal indicatif par format de colis (grammes). */
export const PARCEL_SIZE_MAX_GRAMS: Record<(typeof PARCEL_SIZES)[number], number> = { XS: 500, S: 2000, M: 5000, L: 10000, XL: 20000 };

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

/**
 * Données d'annonce saisies par le vendeur. Le prix est une chaîne (« 49,90 ») convertie
 * côté serveur en unités mineures dans la devise DU PAYS de l'annonce : la devise n'est
 * jamais choisie par le client.
 */
export const listingInputSchema = z.object({
  title: z.string().trim().min(5, "5 caractères minimum.").max(100, "100 caractères maximum."),
  description: z.string().trim().min(20, "Décrivez l'article en 20 caractères minimum.").max(5000, "5 000 caractères maximum."),
  categoryId: z.uuid("Choisissez une catégorie."),
  brandName: optionalText(60),
  condition: z.enum(CONDITIONS).nullable().optional(),
  attributes: z.record(z.string().max(40), z.union([z.string().trim().max(120), z.number().finite(), z.boolean()])).default({}),
  price: z.string().trim().min(1, "Indiquez un prix.").max(16),
  quantity: z.coerce.number().int().min(1).max(10000).default(1),
  countryCode: z.string().length(2),
  regionId: z.uuid("Choisissez un département ou une wilaya."),
  cityId: z.uuid().nullable().optional(),
  locality: optionalText(120),
  deliveryMethods: z.array(z.enum(DELIVERY_METHODS)).min(1, "Choisissez au moins un mode de remise.").max(3),
  parcelSize: z.enum(PARCEL_SIZES).nullable().optional(),
  weightGrams: z.coerce.number().int().min(1).max(100_000).nullable().optional(),
  acceptsCrossBorder: z.boolean().default(false),
  imageIds: z.array(z.uuid()).max(MAX_LISTING_IMAGES, `${MAX_LISTING_IMAGES} photos maximum.`).default([]),
});
export type ListingInput = z.input<typeof listingInputSchema>;
export type ListingInputParsed = z.output<typeof listingInputSchema>;

export const listingIdSchema = z.object({ listingId: z.uuid() });
