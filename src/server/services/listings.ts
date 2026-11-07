import "server-only";
import { Prisma, type ListingStatus } from "@/generated/prisma/client";
import { REVIEW_KEYWORDS } from "@/lib/config/moderation";
import { listingInputSchema, type ListingInput, type ListingInputParsed } from "@/features/listings/schemas";
import { generatePublicId, listingPath, listingSlug } from "@/lib/domain/ids";
import { assertListingTransition, EDITABLE_LISTING_STATES, publicationTarget, PUBLIC_LISTING_STATES } from "@/lib/domain/listing-state";
import { parseAmountToMinor } from "@/lib/domain/money";
import { normalizeForSearch, sanitizeText } from "@/lib/domain/text";
import { track } from "@/server/analytics";
import type { CurrentUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { db, type Tx } from "@/server/db/client";
import { processImage } from "@/server/images";
import { logger } from "@/server/logger";
import { conflict, forbidden, invalid, notFound, precondition } from "@/server/security/errors";
import { rateLimit } from "@/server/security/rate-limit";
import { getNumberSetting, isEnabled } from "@/server/settings";
import { deleteObject, newStorageKey, putObject } from "@/server/storage";
import { getCategoryAncestry, getCategoryAttributes, getCategoryById, type CategoryAttributeDef } from "./catalog";

// ─────────────────────────────── Lecture publique ───────────────────────────────

export const publicListingInclude = {
  images: { orderBy: { sortOrder: "asc" }, select: { id: true, width: true, height: true, blurDataUrl: true } },
  category: { select: { id: true, slug: true, name: true, parentId: true, isTransactional: true } },
  region: { select: { id: true, name: true, code: true } },
  city: { select: { id: true, name: true } },
  country: { select: { code: true, name: true, checkoutMode: true, currency: true } },
  seller: {
    select: {
      id: true,
      createdAt: true,
      status: true,
      profile: {
        select: {
          handle: true,
          displayName: true,
          avatarKey: true,
          countryCode: true,
          cityName: true,
          sellerType: true,
          ratingSum: true,
          ratingCount: true,
          salesCount: true,
          identityVerified: true,
          sellerCancelledCount: true,
          disputesLostCount: true,
        },
      },
    },
  },
} satisfies Prisma.ListingInclude;

export type PublicListing = Prisma.ListingGetPayload<{ include: typeof publicListingInclude }>;

export const cardSelect = {
  id: true,
  publicId: true,
  slug: true,
  title: true,
  priceAmount: true,
  currency: true,
  condition: true,
  status: true,
  brandName: true,
  countryCode: true,
  isDemo: true,
  favoriteCount: true,
  deliveryMethods: true,
  publishedAt: true,
  region: { select: { name: true } },
  city: { select: { name: true } },
  locality: true,
  images: { orderBy: { sortOrder: "asc" }, take: 1, select: { id: true, blurDataUrl: true, width: true, height: true } },
  seller: { select: { profile: { select: { sellerType: true, identityVerified: true, displayName: true } } } },
} satisfies Prisma.ListingSelect;

export type ListingCardData = Prisma.ListingGetPayload<{ select: typeof cardSelect }>;

/** Fiche visible publiquement (en ligne, réservée ou vendue), vendeur actif. */
export async function getListingByPublicId(publicId: string, viewer?: Pick<CurrentUser, "id" | "isStaff"> | null) {
  const listing = await db.listing.findUnique({ where: { publicId }, include: publicListingInclude });
  if (!listing || listing.status === "DELETED") return null;
  const isOwner = viewer?.id === listing.sellerId;
  const isPublic = (PUBLIC_LISTING_STATES as readonly string[]).includes(listing.status) && listing.seller.status === "ACTIVE";
  if (!isPublic && !isOwner && !viewer?.isStaff) return null;
  return { listing, isOwner, isPublic };
}

export async function recordListingView(listingId: string, viewerId: string | null) {
  await db.listing.update({ where: { id: listingId }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);
  await track("listing.viewed", { userId: viewerId, properties: { listingId } });
}

export async function getLatestListings(opts: { countryCode?: string; limit?: number; categoryIds?: string[] } = {}) {
  return db.listing.findMany({
    where: {
      status: "ACTIVE",
      seller: { status: "ACTIVE" },
      ...(opts.countryCode ? { countryCode: opts.countryCode } : {}),
      ...(opts.categoryIds ? { categoryId: { in: opts.categoryIds } } : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: opts.limit ?? 12,
    select: cardSelect,
  });
}

export async function getSimilarListings(listing: { id: string; categoryId: string; countryCode: string }, limit = 8) {
  const ancestry = await getCategoryAncestry(listing.categoryId);
  const sameCategory = await db.listing.findMany({
    where: { status: "ACTIVE", categoryId: listing.categoryId, id: { not: listing.id }, seller: { status: "ACTIVE" } },
    orderBy: [{ publishedAt: "desc" }],
    take: limit,
    select: cardSelect,
  });
  if (sameCategory.length >= limit || !ancestry[1]) return sameCategory;
  const siblings = await db.listing.findMany({
    where: {
      status: "ACTIVE",
      category: { parentId: ancestry[1].id },
      id: { notIn: [listing.id, ...sameCategory.map((l) => l.id)] },
      seller: { status: "ACTIVE" },
    },
    orderBy: { publishedAt: "desc" },
    take: limit - sameCategory.length,
    select: cardSelect,
  });
  return [...sameCategory, ...siblings];
}

export async function getSellerPublicListings(sellerId: string, opts: { excludeId?: string; limit?: number; offset?: number } = {}) {
  const where: Prisma.ListingWhereInput = { sellerId, status: "ACTIVE", ...(opts.excludeId ? { id: { not: opts.excludeId } } : {}) };
  const [items, total] = await Promise.all([
    db.listing.findMany({ where, orderBy: { publishedAt: "desc" }, take: opts.limit ?? 24, skip: opts.offset ?? 0, select: cardSelect }),
    db.listing.count({ where }),
  ]);
  return { items, total };
}

export { listingPath };

// ─────────────────────────────── Espace vendeur ───────────────────────────────

export async function getOwnerListings(user: Pick<CurrentUser, "id">, status?: ListingStatus | "ALL") {
  return db.listing.findMany({
    where: { sellerId: user.id, status: status && status !== "ALL" ? status : { not: "DELETED" } },
    orderBy: { updatedAt: "desc" },
    select: { ...cardSelect, viewCount: true, quantity: true, quantityAvailable: true, moderationNote: true, updatedAt: true },
  });
}

/** Annonce modifiable par son propriétaire. Une annonce d'autrui renvoie « introuvable » (anti-IDOR). */
export async function getListingForEdit(user: Pick<CurrentUser, "id">, listingId: string) {
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    include: { images: { orderBy: { sortOrder: "asc" }, select: { id: true, width: true, height: true, blurDataUrl: true } } },
  });
  if (!listing || listing.sellerId !== user.id || listing.status === "DELETED") throw notFound("Annonce introuvable.");
  return listing;
}

type ValidatedListing = {
  data: Omit<Prisma.ListingUncheckedCreateInput, "publicId" | "slug" | "sellerId" | "status">;
  imageIds: string[];
  requiresReview: boolean;
};

const REVIEW_KEYWORDS_NORMALIZED = REVIEW_KEYWORDS.map((k) => normalizeForSearch(k));

export function detectSensitiveKeywords(text: string): string[] {
  const normalized = ` ${normalizeForSearch(text)} `;
  return REVIEW_KEYWORDS_NORMALIZED.filter((k) => normalized.includes(` ${k} `) || normalized.includes(` ${k}s `));
}

function validateAttributes(defs: CategoryAttributeDef[], raw: Record<string, string | number | boolean>) {
  const out: Record<string, string | number | boolean> = {};
  const errors: Record<string, string[]> = {};
  for (const def of defs) {
    const value = raw[def.key];
    const empty = value === undefined || value === "" || value === null;
    if (empty) {
      if (def.isRequired) errors[`attributes.${def.key}`] = [`${def.label} : champ requis.`];
      continue;
    }
    switch (def.type) {
      case "SELECT":
        if (typeof value !== "string" || !def.options.includes(value)) errors[`attributes.${def.key}`] = [`${def.label} : valeur non proposée.`];
        else out[def.key] = value;
        break;
      case "NUMBER": {
        const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
        if (!Number.isFinite(n) || n < 0 || n > 1_000_000) errors[`attributes.${def.key}`] = [`${def.label} : nombre invalide.`];
        else out[def.key] = Math.round(n * 100) / 100;
        break;
      }
      case "BOOLEAN":
        out[def.key] = value === true || value === "true";
        break;
      default:
        out[def.key] = sanitizeText(String(value), { multiline: false }).slice(0, 120);
    }
  }
  if (Object.keys(errors).length) throw invalid("Certaines caractéristiques sont invalides.", errors);
  return out;
}

/** Validation serveur complète : référentiels, devise du pays, cohérence des modes de remise. */
async function validateListingInput(user: CurrentUser, raw: ListingInput, tx: Tx | typeof db = db): Promise<ValidatedListing> {
  const parsed = listingInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const i of parsed.error.issues) (fieldErrors[i.path.join(".") || "_"] ??= []).push(i.message);
    throw invalid("Certains champs sont invalides.", fieldErrors);
  }
  const input: ListingInputParsed = parsed.data;

  const country = await tx.country.findUnique({ where: { code: input.countryCode } });
  if (!country || !country.isActive) throw invalid("Ce pays n'est pas encore ouvert sur Tamurt Market.", { countryCode: ["Pays non disponible."] });
  const region = await tx.region.findUnique({ where: { id: input.regionId } });
  if (!region || region.countryCode !== country.code || !region.isActive) throw invalid("Région invalide.", { regionId: ["Région invalide pour ce pays."] });
  if (input.cityId) {
    const city = await tx.city.findUnique({ where: { id: input.cityId } });
    if (!city || city.regionId !== region.id) throw invalid("Ville invalide.", { cityId: ["Ville invalide pour cette région."] });
  }

  const category = await getCategoryById(input.categoryId);
  if (!category || !category.isActive || category.children.length > 0) throw invalid("Catégorie invalide.", { categoryId: ["Choisissez une sous-catégorie."] });
  const ancestry = await getCategoryAncestry(category.id);
  if (ancestry.some((c) => c.isProhibited)) throw invalid("Cette catégorie d'objets est interdite sur Tamurt Market.", { categoryId: ["Catégorie interdite."] });
  if (category.conditionRequired && !input.condition) throw invalid("Indiquez l'état de l'article.", { condition: ["État requis."] });

  const price = parseAmountToMinor(input.price, country.currency);
  if (price === null || price <= 0) throw invalid("Prix invalide.", { price: ["Saisissez un montant valide, par exemple 49,90."] });

  const isBusiness = user.profile?.sellerType === "BUSINESS";
  if (input.quantity > 1 && !isBusiness) throw invalid("La vente en plusieurs exemplaires est réservée aux vendeurs professionnels.", { quantity: ["Quantité limitée à 1."] });

  const methods = [...new Set(input.deliveryMethods)];
  if (methods.includes("NATIONAL_SHIPPING")) {
    const carrier = await tx.shippingProvider.findFirst({ where: { kind: "NATIONAL_CARRIER", isEnabled: true, supportedCountries: { has: country.code } } });
    if (!carrier) throw invalid("La livraison nationale n'est pas encore disponible dans ce pays.", { deliveryMethods: ["Livraison nationale indisponible pour ce pays."] });
    if (!input.parcelSize) throw invalid("Indiquez le format du colis.", { parcelSize: ["Format requis pour la livraison."] });
  }
  if (methods.includes("TAMURT_TRANSPORT") && (!input.parcelSize || !input.weightGrams))
    throw invalid("Indiquez le format et le poids du colis pour Tamurt Transport.", { weightGrams: ["Poids requis pour un devis Transport."] });

  const attributes = validateAttributes(await getCategoryAttributes(category.id), input.attributes);
  const title = sanitizeText(input.title, { multiline: false });
  const description = sanitizeText(input.description);
  const brandName = input.brandName ? sanitizeText(input.brandName, { multiline: false }) : null;
  const brand = brandName ? await tx.brand.findUnique({ where: { normalizedName: normalizeForSearch(brandName) } }) : null;
  const keywords = detectSensitiveKeywords(`${title} ${description} ${brandName ?? ""}`);

  return {
    data: {
      title,
      description,
      categoryId: category.id,
      brandId: brand?.id ?? null,
      brandName: brand?.name ?? brandName,
      condition: input.condition ?? null,
      attributes,
      priceAmount: price,
      currency: country.currency,
      quantity: input.quantity,
      quantityAvailable: input.quantity,
      countryCode: country.code,
      regionId: region.id,
      cityId: input.cityId ?? null,
      locality: input.cityId ? null : input.locality,
      deliveryMethods: methods,
      parcelSize: input.parcelSize ?? null,
      weightGrams: input.weightGrams ?? null,
      acceptsCrossBorder: methods.includes("TAMURT_TRANSPORT") ? input.acceptsCrossBorder : false,
    },
    imageIds: input.imageIds,
    requiresReview: category.requiresReview || keywords.length > 0,
  };
}

async function attachImages(tx: Tx, user: Pick<CurrentUser, "id">, listingId: string, imageIds: string[]) {
  const unique = [...new Set(imageIds)];
  if (unique.length) {
    const owned = await tx.listingImage.findMany({ where: { id: { in: unique }, ownerId: user.id, OR: [{ listingId: null }, { listingId }] }, select: { id: true } });
    if (owned.length !== unique.length) throw invalid("Une ou plusieurs photos sont invalides ou expirées. Rechargez-les.");
  }
  const removed = await tx.listingImage.findMany({ where: { listingId, id: { notIn: unique } }, select: { id: true, thumbKey: true, largeKey: true } });
  if (removed.length) await tx.listingImage.deleteMany({ where: { id: { in: removed.map((r) => r.id) } } });
  for (const [index, id] of unique.entries()) await tx.listingImage.update({ where: { id }, data: { listingId, sortOrder: index } });
  return removed;
}

const SNAPSHOT_FIELDS = ["title", "description", "categoryId", "brandName", "condition", "attributes", "priceAmount", "quantity", "regionId", "cityId", "locality", "deliveryMethods", "parcelSize", "weightGrams", "acceptsCrossBorder"] as const;

function changedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  return SNAPSHOT_FIELDS.filter((f) => JSON.stringify(before[f] ?? null) !== JSON.stringify(after[f] ?? null));
}

/** Création d'un brouillon. */
export async function createListingDraft(user: CurrentUser, raw: ListingInput) {
  await rateLimit(`listing.create:${user.id}`, 30, 3600);
  const v = await validateListingInput(user, raw);
  const listing = await db.$transaction(async (tx) => {
    const created = await tx.listing.create({
      data: { ...v.data, publicId: generatePublicId(), slug: listingSlug(v.data.title), sellerId: user.id, status: "DRAFT" },
    });
    await attachImages(tx, user, created.id, v.imageIds);
    return created;
  });
  return listing;
}

/**
 * Modification par le propriétaire (verrou optimiste sur `version`). Une révision est
 * conservée. Une annonce en ligne dont un champ sensible change repasse en vérification
 * si sa catégorie ou son contenu l'exige.
 */
export async function updateListing(user: CurrentUser, listingId: string, raw: ListingInput, expectedVersion?: number) {
  const current = await getListingForEdit(user, listingId);
  if (!(EDITABLE_LISTING_STATES as readonly string[]).includes(current.status)) throw conflict("Cette annonce ne peut plus être modifiée.");
  if (expectedVersion !== undefined && expectedVersion !== current.version)
    throw conflict("L'annonce a été modifiée entre-temps. Rechargez la page avant d'enregistrer.");
  const v = await validateListingInput(user, raw);
  // La quantité disponible suit la nouvelle quantité, sans jamais descendre sous les exemplaires réservés.
  const reserved = current.quantity - current.quantityAvailable;
  if (v.data.quantity! < reserved) throw invalid("Quantité inférieure aux exemplaires déjà réservés.", { quantity: [`Minimum : ${reserved}`] });
  const changed = changedFields(current as unknown as Record<string, unknown>, v.data as Record<string, unknown>);
  const imagesChanged = JSON.stringify(current.images.map((i) => i.id)) !== JSON.stringify(v.imageIds);
  const sensitive = changed.some((f) => f === "title" || f === "description" || f === "categoryId") || imagesChanged;

  let nextStatus: ListingStatus = current.status;
  if (current.status === "ACTIVE" && sensitive && v.requiresReview) nextStatus = "PENDING_REVIEW";
  if (current.status === "REJECTED") nextStatus = "DRAFT";

  const removed = await db.$transaction(async (tx) => {
    const res = await tx.listing.updateMany({
      where: { id: listingId, version: current.version },
      data: {
        ...v.data,
        quantityAvailable: v.data.quantity! - reserved,
        slug: listingSlug(v.data.title),
        status: nextStatus,
        version: { increment: 1 },
        ...(nextStatus === "PENDING_REVIEW" ? { publishedAt: current.publishedAt } : {}),
      },
    });
    if (res.count !== 1) throw conflict("L'annonce a été modifiée entre-temps. Rechargez la page.");
    const removedImages = await attachImages(tx, user, listingId, v.imageIds);
    if (changed.length || imagesChanged)
      await tx.listingRevision.create({
        data: {
          listingId,
          version: current.version + 1,
          editorId: user.id,
          snapshot: Object.fromEntries(SNAPSHOT_FIELDS.map((f) => [f, (current as unknown as Record<string, unknown>)[f] ?? null])) as Prisma.InputJsonValue,
          changedFields: imagesChanged ? [...changed, "images"] : [...changed],
        },
      });
    return removedImages;
  });
  await removeStoredImages(removed);
  return { status: nextStatus };
}

/** Demande de publication : contrôle de complétude et de conformité, puis en ligne ou en vérification. */
export async function publishListing(user: CurrentUser, listingId: string) {
  const listing = await getListingForEdit(user, listingId);
  if (!["DRAFT", "ARCHIVED", "REJECTED"].includes(listing.status)) throw conflict("Cette annonce est déjà publiée ou en cours de vérification.");
  if (listing.images.length === 0) throw precondition("Ajoutez au moins une photo avant de publier.");
  const category = await getCategoryById(listing.categoryId);
  const ancestry = await getCategoryAncestry(listing.categoryId);
  if (!category?.isActive || ancestry.some((c) => c.isProhibited)) throw invalid("Cette catégorie n'est pas publiable.");
  const country = await db.country.findUnique({ where: { code: listing.countryCode } });
  if (!country?.isActive) throw precondition("Ce pays n'est pas ouvert à la publication.");

  const maxActive = await getNumberSetting("listings.maxActivePerIndividual");
  if (user.profile?.sellerType !== "BUSINESS") {
    const active = await db.listing.count({ where: { sellerId: user.id, status: { in: ["ACTIVE", "PENDING_REVIEW", "RESERVED"] } } });
    if (active >= maxActive) throw precondition(`Limite de ${maxActive} annonces actives atteinte pour un compte particulier.`);
  }

  const keywords = detectSensitiveKeywords(`${listing.title} ${listing.description} ${listing.brandName ?? ""}`);
  const autoApprove = await isEnabled("listings.autoApprove");
  // Une annonce refusée repasse toujours par la vérification humaine.
  const target: ListingStatus =
    listing.status === "REJECTED"
      ? "PENDING_REVIEW"
      : publicationTarget({ categoryRequiresReview: !!category.requiresReview || keywords.length > 0, sellerRequiresReview: !autoApprove });
  assertListingTransition(listing.status, target, "SELLER");

  await db.$transaction(async (tx) => {
    const res = await tx.listing.updateMany({
      where: { id: listing.id, version: listing.version, status: listing.status },
      data: { status: target, publishedAt: target === "ACTIVE" ? new Date() : listing.publishedAt, archivedAt: null, moderationNote: null, version: { increment: 1 } },
    });
    if (res.count !== 1) throw conflict("L'annonce a été modifiée entre-temps. Rechargez la page.");
    if (keywords.length) await audit({ actorId: user.id, action: "listing.flagged_keywords", targetType: "listing", targetId: listing.id, metadata: { keywords } }, tx);
  });
  if (target === "ACTIVE") await track("listing.published", { userId: user.id, properties: { categoryId: listing.categoryId, country: listing.countryCode } });
  return { status: target, keywords };
}

/** Transitions demandées par le vendeur : désactivation, remise en ligne, vente hors plateforme, retrait de vérification. */
export async function changeListingStatusBySeller(user: CurrentUser, listingId: string, action: "archive" | "reactivate" | "markSold" | "withdraw") {
  const listing = await getListingForEdit(user, listingId);
  const target: ListingStatus = { archive: "ARCHIVED", reactivate: "ACTIVE", markSold: "SOLD", withdraw: "DRAFT" }[action] as ListingStatus;
  if (action === "reactivate") return publishListing(user, listingId);
  assertListingTransition(listing.status, target, "SELLER");
  if (action === "archive" || action === "markSold") {
    const pending = await db.order.count({ where: { listingId, status: { in: ["CREATED", "PAYMENT_PENDING"] } } });
    if (pending > 0) throw conflict("Une commande est en cours de paiement sur cette annonce. Réessayez dans quelques minutes.");
  }
  const res = await db.listing.updateMany({
    where: { id: listingId, version: listing.version, status: listing.status },
    data: {
      status: target,
      version: { increment: 1 },
      ...(target === "ARCHIVED" ? { archivedAt: new Date() } : {}),
      ...(target === "SOLD" ? { soldAt: new Date(), quantityAvailable: 0 } : {}),
    },
  });
  if (res.count !== 1) throw conflict("L'annonce a été modifiée entre-temps. Rechargez la page.");
  return { status: target };
}

/** Suppression logique : conservée pour l'historique des commandes et la modération. */
export async function deleteListing(user: CurrentUser, listingId: string) {
  const listing = await getListingForEdit(user, listingId);
  assertListingTransition(listing.status, "DELETED", "SELLER");
  const activeOrders = await db.order.count({ where: { listingId, status: { notIn: ["COMPLETED", "CANCELLED", "REFUNDED"] } } });
  if (activeOrders > 0) throw conflict("Une commande est en cours sur cette annonce : suppression impossible pour le moment.");
  await db.listing.update({ where: { id: listingId }, data: { status: "DELETED", deletedAt: new Date(), version: { increment: 1 } } });
}

// ─────────────────────────────── Photos ───────────────────────────────

/** Envoi d'une photo avant enregistrement de l'annonce : ré-encodage WebP, métadonnées supprimées. */
export async function uploadListingImage(user: CurrentUser, bytes: Uint8Array) {
  await rateLimit(`listing.image:${user.id}`, 120, 3600);
  const pending = await db.listingImage.count({ where: { ownerId: user.id, listingId: null } });
  if (pending >= 40) throw precondition("Trop de photos en attente. Enregistrez votre annonce ou patientez avant d'en ajouter.");
  const processed = await processImage(bytes);
  const id = crypto.randomUUID();
  const thumbKey = newStorageKey("listings", id, "webp", "thumb");
  const largeKey = newStorageKey("listings", id, "webp", "large");
  await putObject(thumbKey, processed.thumb, "image/webp");
  await putObject(largeKey, processed.large, "image/webp");
  const image = await db.listingImage.create({
    data: { id, ownerId: user.id, thumbKey, largeKey, width: processed.width, height: processed.height, sizeBytes: processed.sizeBytes, blurDataUrl: processed.blurDataUrl },
    select: { id: true, width: true, height: true, blurDataUrl: true },
  });
  return image;
}

async function removeStoredImages(images: { thumbKey: string; largeKey: string }[]) {
  for (const img of images) {
    await deleteObject(img.thumbKey).catch((e) => logger.warn("storage.delete_failed", { error: e }));
    await deleteObject(img.largeKey).catch((e) => logger.warn("storage.delete_failed", { error: e }));
  }
}

/** Nettoyage des photos jamais rattachées (tâche de maintenance). */
export async function cleanupOrphanImages(olderThanHours = 24) {
  const orphans = await db.listingImage.findMany({
    where: { listingId: null, createdAt: { lt: new Date(Date.now() - olderThanHours * 3600_000) } },
    select: { id: true, thumbKey: true, largeKey: true },
    take: 500,
  });
  if (!orphans.length) return 0;
  await db.listingImage.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } });
  await removeStoredImages(orphans);
  return orphans.length;
}

/** Contrôle d'accès à une photo : publique si l'annonce est visible, sinon propriétaire ou personnel. */
export async function getImageForViewer(imageId: string, viewer: Pick<CurrentUser, "id" | "isStaff"> | null) {
  const image = await db.listingImage.findUnique({
    where: { id: imageId },
    select: { thumbKey: true, largeKey: true, ownerId: true, listing: { select: { status: true, seller: { select: { status: true } } } } },
  });
  if (!image) return null;
  const isPublic = !!image.listing && (PUBLIC_LISTING_STATES as readonly string[]).includes(image.listing.status) && image.listing.seller.status === "ACTIVE";
  if (isPublic) return { image, cache: "public" as const };
  if (viewer && (viewer.id === image.ownerId || viewer.isStaff)) return { image, cache: "private" as const };
  return null;
}

export function assertOwner(listing: { sellerId: string }, user: Pick<CurrentUser, "id">) {
  if (listing.sellerId !== user.id) throw forbidden();
}
