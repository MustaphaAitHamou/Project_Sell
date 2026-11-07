import "server-only";
import { z } from "zod";
import { sanitizeText } from "@/lib/domain/text";
import type { CurrentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { invalid, notFound } from "@/server/security/errors";

export const addressInputSchema = z.object({
  label: z.string().trim().max(60).optional().nullable(),
  fullName: z.string().trim().min(2, "Nom du destinataire requis.").max(120),
  line1: z.string().trim().min(3, "Adresse requise.").max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  postalCode: z.string().trim().max(16).optional().nullable(),
  city: z.string().trim().min(2, "Ville requise.").max(120),
  regionId: z.uuid().optional().nullable(),
  countryCode: z.string().length(2),
  phone: z
    .string()
    .trim()
    .max(32)
    .regex(/^[+0-9 ().-]{6,32}$/, "Numéro de téléphone invalide.")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  isDefault: z.boolean().default(false),
});
export type AddressInput = z.input<typeof addressInputSchema>;

/** Adresses PRIVÉES : jamais visibles publiquement ; transmises au vendeur uniquement après paiement. */
export async function listAddresses(user: Pick<CurrentUser, "id">) {
  return db.address.findMany({ where: { userId: user.id, deletedAt: null }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }], include: { region: { select: { name: true } }, country: { select: { name: true } } } });
}

export async function saveAddress(user: Pick<CurrentUser, "id">, raw: AddressInput, addressId?: string) {
  const input = addressInputSchema.parse(raw);
  const country = await db.country.findUnique({ where: { code: input.countryCode } });
  if (!country?.isActive) throw invalid("Pays non desservi.", { countryCode: ["Pays non disponible."] });
  if (input.regionId) {
    const region = await db.region.findUnique({ where: { id: input.regionId } });
    if (!region || region.countryCode !== country.code) throw invalid("Région invalide.", { regionId: ["Région invalide pour ce pays."] });
  }
  if (country.code === "FR" && input.postalCode && !/^\d{5}$/.test(input.postalCode)) throw invalid("Code postal invalide.", { postalCode: ["5 chiffres attendus."] });
  const data = {
    label: input.label ? sanitizeText(input.label, { multiline: false }) : null,
    fullName: sanitizeText(input.fullName, { multiline: false }),
    line1: sanitizeText(input.line1, { multiline: false }),
    line2: input.line2 ? sanitizeText(input.line2, { multiline: false }) : null,
    postalCode: input.postalCode || null,
    city: sanitizeText(input.city, { multiline: false }),
    regionId: input.regionId ?? null,
    countryCode: country.code,
    phone: input.phone || null,
  };
  return db.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId: user.id, deletedAt: null } });
    if (!addressId && count >= 10) throw invalid("10 adresses maximum.");
    const makeDefault = input.isDefault || count === 0;
    if (makeDefault) await tx.address.updateMany({ where: { userId: user.id, isDefault: true }, data: { isDefault: false } });
    if (addressId) {
      const existing = await tx.address.findUnique({ where: { id: addressId } });
      if (!existing || existing.userId !== user.id || existing.deletedAt) throw notFound("Adresse introuvable.");
      return tx.address.update({ where: { id: addressId }, data: { ...data, isDefault: makeDefault || existing.isDefault } });
    }
    return tx.address.create({ data: { ...data, userId: user.id, isDefault: makeDefault } });
  });
}

export async function deleteAddress(user: Pick<CurrentUser, "id">, addressId: string) {
  const existing = await db.address.findUnique({ where: { id: addressId } });
  if (!existing || existing.userId !== user.id || existing.deletedAt) throw notFound("Adresse introuvable.");
  // Suppression logique : les commandes conservent leur propre instantané d'adresse.
  await db.address.update({ where: { id: addressId }, data: { deletedAt: new Date(), isDefault: false } });
}

export async function getOwnedAddress(user: Pick<CurrentUser, "id">, addressId: string) {
  const a = await db.address.findUnique({ where: { id: addressId }, include: { region: { select: { name: true } } } });
  if (!a || a.userId !== user.id || a.deletedAt) throw notFound("Adresse introuvable.");
  return a;
}
