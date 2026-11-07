import "server-only";
import { z } from "zod";
import { displayNameSchema } from "@/features/auth/schemas";
import { isValidHandle, RESERVED_HANDLES } from "@/lib/domain/ids";
import { sanitizeText } from "@/lib/domain/text";
import { track } from "@/server/analytics";
import type { CurrentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { processImage } from "@/server/images";
import { conflict, invalid, notFound } from "@/server/security/errors";
import { rateLimit } from "@/server/security/rate-limit";
import { deleteObject, newStorageKey, putObject } from "@/server/storage";

export const profileInputSchema = z.object({
  displayName: displayNameSchema,
  handle: z.string().trim().toLowerCase().min(3, "3 caractères minimum.").max(40),
  bio: z.string().trim().max(1000).optional().nullable(),
  countryCode: z.string().length(2),
  regionId: z.uuid("Choisissez votre département ou wilaya."),
  cityName: z.string().trim().max(120).optional().nullable(),
});

async function validateProfile(userId: string, raw: z.input<typeof profileInputSchema>) {
  const input = profileInputSchema.parse(raw);
  if (!isValidHandle(input.handle) || RESERVED_HANDLES.has(input.handle)) throw invalid("Adresse de profil indisponible.", { handle: ["Lettres minuscules, chiffres et tirets ; certains noms sont réservés."] });
  const taken = await db.userProfile.findUnique({ where: { handle: input.handle }, select: { userId: true } });
  if (taken && taken.userId !== userId) throw conflict("Cette adresse de profil est déjà utilisée.");
  const country = await db.country.findUnique({ where: { code: input.countryCode } });
  if (!country?.isActive) throw invalid("Pays non disponible.", { countryCode: ["Pays non disponible."] });
  const region = await db.region.findUnique({ where: { id: input.regionId } });
  if (!region || region.countryCode !== country.code) throw invalid("Région invalide.", { regionId: ["Région invalide pour ce pays."] });
  return {
    displayName: sanitizeText(input.displayName, { multiline: false }),
    handle: input.handle,
    bio: input.bio ? sanitizeText(input.bio).slice(0, 1000) : null,
    countryCode: country.code,
    regionId: region.id,
    cityName: input.cityName ? sanitizeText(input.cityName, { multiline: false }) : null,
  };
}

/** Dernière étape de l'inscription : profil public minimal et acceptation des conditions. */
export async function completeOnboarding(user: CurrentUser, raw: z.input<typeof profileInputSchema> & { acceptTerms?: boolean }) {
  if (!user.termsAccepted && raw.acceptTerms !== true) throw invalid("Acceptez les conditions générales pour continuer.", { acceptTerms: ["Acceptation requise."] });
  const data = await validateProfile(user.id, raw);
  await db.$transaction(async (tx) => {
    await tx.userProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
    await tx.user.update({ where: { id: user.id }, data: { name: data.displayName, onboardedAt: new Date(), ...(user.termsAccepted ? {} : { termsAcceptedAt: new Date() }) } });
    await tx.userContact.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
  });
  if (!user.onboarded) await track("user.signed_up", { userId: user.id, properties: { country: data.countryCode } });
}

export async function updateProfile(user: CurrentUser, raw: z.input<typeof profileInputSchema>) {
  const data = await validateProfile(user.id, raw);
  await db.$transaction([db.userProfile.update({ where: { userId: user.id }, data }), db.user.update({ where: { id: user.id }, data: { name: data.displayName } })]);
}

export async function uploadAvatar(user: Pick<CurrentUser, "id">, bytes: Uint8Array) {
  await rateLimit(`avatar:${user.id}`, 10, 3600);
  const processed = await processImage(bytes, { largeMax: 512, thumbMax: 256 });
  const key = newStorageKey("avatars", crypto.randomUUID(), "webp");
  await putObject(key, processed.thumb, "image/webp");
  const previous = await db.userProfile.findUnique({ where: { userId: user.id }, select: { avatarKey: true } });
  await db.userProfile.update({ where: { userId: user.id }, data: { avatarKey: key } });
  if (previous?.avatarKey) await deleteObject(previous.avatarKey).catch(() => undefined);
}

/** Profil vendeur public : uniquement des informations publiques (aucune coordonnée). */
export async function getPublicProfile(handle: string) {
  const profile = await db.userProfile.findUnique({
    where: { handle },
    include: {
      user: { select: { id: true, createdAt: true, status: true, business: { select: { legalName: true, tradeName: true, registrationNumber: true, registrationCountry: true, vatNumber: true, addressLine1: true, postalCode: true, city: true, countryCode: true, contactEmail: true, verificationStatus: true } } } },
      region: { select: { name: true } },
      country: { select: { name: true } },
    },
  });
  if (!profile || profile.user.status !== "ACTIVE") return null;
  return profile;
}

export const businessInputSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  tradeName: z.string().trim().max(200).optional().nullable(),
  legalForm: z.string().trim().max(80).optional().nullable(),
  registrationNumber: z.string().trim().min(5, "Numéro d'immatriculation requis.").max(64),
  vatNumber: z.string().trim().max(32).optional().nullable(),
  addressLine1: z.string().trim().min(3).max(200),
  postalCode: z.string().trim().max(16).optional().nullable(),
  city: z.string().trim().min(2).max(120),
  contactEmail: z.email(),
  contactPhone: z.string().trim().max(32).optional().nullable(),
  traderDeclaration: z.literal(true, { error: "Vous devez vous engager à ne proposer que des produits conformes." }),
});

/**
 * Déclaration de vendeur professionnel (informations de traçabilité exigées par le DSA,
 * art. 30). La vérification réelle (registre officiel) reste à brancher : statut « en attente ».
 */
export async function declareBusiness(user: CurrentUser, raw: z.input<typeof businessInputSchema>) {
  const input = businessInputSchema.parse(raw);
  const country = user.profile?.countryCode ?? "FR";
  const data = {
    legalName: sanitizeText(input.legalName, { multiline: false }),
    tradeName: input.tradeName ? sanitizeText(input.tradeName, { multiline: false }) : null,
    legalForm: input.legalForm ?? null,
    registrationCountry: country,
    registrationNumber: input.registrationNumber.replace(/\s+/g, ""),
    vatNumber: input.vatNumber?.replace(/\s+/g, "") || null,
    addressLine1: sanitizeText(input.addressLine1, { multiline: false }),
    postalCode: input.postalCode ?? null,
    city: sanitizeText(input.city, { multiline: false }),
    countryCode: country,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone ?? null,
    traderDeclarationAt: new Date(),
  };
  try {
    await db.$transaction([
      db.businessProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data, verificationStatus: "PENDING" }, update: { ...data, verificationStatus: "PENDING" } }),
      db.userProfile.update({ where: { userId: user.id }, data: { sellerType: "BUSINESS" } }),
      db.userVerification.upsert({ where: { userId_type: { userId: user.id, type: "BUSINESS" } }, create: { userId: user.id, type: "BUSINESS", status: "PENDING", provider: "manual" }, update: { status: "PENDING" } }),
    ]);
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") throw conflict("Ce numéro d'immatriculation est déjà déclaré sur un autre compte.");
    throw e;
  }
}

export async function getOwnProfile(userId: string) {
  const p = await db.userProfile.findUnique({ where: { userId } });
  if (!p) throw notFound();
  return p;
}
