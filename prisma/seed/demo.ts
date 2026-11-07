import { hashPassword } from "better-auth/crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { generatePublicId, listingSlug } from "@/lib/domain/ids";
import { normalizeForSearch, slugify } from "@/lib/domain/text";
import { processImage } from "@/server/images";
import { newStorageKey, putObject } from "@/server/storage";
import { DEMO_LISTINGS, DEMO_PASSWORD, DEMO_USERS, type DemoListing } from "./demo-data";
import { demoImage } from "./demo-images";

/**
 * Données de démonstration explicitement fictives (isDemo = true). Idempotent : un
 * compte ou une annonce déjà présents ne sont pas dupliqués.
 */
export async function seedDemo(db: PrismaClient) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const userIds = new Map<string, string>();

  for (const u of DEMO_USERS) {
    const region = await db.region.findUniqueOrThrow({ where: { countryCode_code: { countryCode: u.country, code: u.region } } });
    const existing = await db.user.findUnique({ where: { email: u.email } });
    const id = existing?.id ?? crypto.randomUUID();
    userIds.set(u.key, id);
    if (existing) continue;
    const now = new Date();
    await db.user.create({
      data: {
        id,
        name: u.name,
        email: u.email,
        emailVerified: true,
        termsAcceptedAt: now,
        onboardedAt: now,
        accounts: { create: { id: crypto.randomUUID(), accountId: id, providerId: "credential", password: passwordHash } },
        profile: {
          create: {
            handle: u.handle,
            displayName: u.name,
            bio: u.bio ?? null,
            countryCode: u.country,
            regionId: region.id,
            cityName: u.city,
            sellerType: u.sellerType ?? "INDIVIDUAL",
            identityVerified: !!u.identityVerified,
          },
        },
        contact: { create: {} },
        verifications: {
          create: [
            { type: "EMAIL", status: "VERIFIED", provider: "email", verifiedAt: now },
            ...(u.identityVerified ? [{ type: "IDENTITY" as const, status: "VERIFIED" as const, provider: "demo", providerRef: `demo-${u.handle}`, verifiedAt: now }] : []),
          ],
        },
        roles: u.roles ? { create: u.roles.map((role) => ({ role })) } : undefined,
        business: u.business
          ? {
              create: {
                legalName: u.business.legalName,
                registrationCountry: u.country,
                registrationNumber: u.business.registrationNumber,
                vatNumber: u.business.vatNumber ?? null,
                addressLine1: u.business.address,
                postalCode: u.business.postalCode,
                city: u.city,
                countryCode: u.country,
                contactEmail: u.email,
                verificationStatus: "VERIFIED",
                verifiedAt: now,
                traderDeclarationAt: now,
              },
            }
          : undefined,
      },
    });
  }

  const categories = new Map((await db.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]));
  const brands = new Map((await db.brand.findMany({ select: { id: true, normalizedName: true } })).map((b) => [b.normalizedName, b.id]));

  let created = 0;
  for (const l of DEMO_LISTINGS) {
    const sellerId = userIds.get(l.seller);
    if (!sellerId) throw new Error(`Vendeur inconnu ${l.seller}`);
    const exists = await db.listing.findFirst({ where: { sellerId, title: l.title, isDemo: true }, include: { _count: { select: { images: true } } } });
    if (exists && exists._count.images > 0) continue;
    if (exists) {
      // Réparation d'une annonce créée lors d'une exécution interrompue.
      await attachDemoImages(db, exists.id, sellerId, l);
      continue;
    }
    const country = l.currency === "EUR" ? "FR" : "DZ";
    const region = await db.region.findUniqueOrThrow({ where: { countryCode_code: { countryCode: country, code: l.region } } });
    const city = await db.city.findUnique({ where: { countryCode_slug: { countryCode: country, slug: slugify(l.city) } } });
    const categoryId = categories.get(l.category);
    if (!categoryId) throw new Error(`Catégorie inconnue ${l.category}`);
    const publishedAt = new Date(Date.now() - l.ageDays * 86_400_000 - Math.floor(Math.random() * 6) * 3_600_000);
    const quantity = l.quantity ?? 1;
    const status = l.status ?? "ACTIVE";
    const listing = await db.listing.create({
      data: {
        publicId: generatePublicId(),
        slug: listingSlug(l.title),
        sellerId,
        status,
        title: l.title,
        description: l.description,
        categoryId,
        brandId: l.brand ? (brands.get(normalizeForSearch(l.brand)) ?? null) : null,
        brandName: l.brand ?? null,
        condition: l.condition,
        attributes: l.attributes ?? {},
        priceAmount: l.price * 100,
        currency: l.currency,
        quantity,
        quantityAvailable: status === "SOLD" ? 0 : quantity,
        countryCode: country,
        regionId: region.id,
        cityId: city?.id ?? null,
        locality: city ? null : l.city,
        deliveryMethods: l.delivery,
        parcelSize: l.size ?? null,
        weightGrams: l.weight ?? null,
        acceptsCrossBorder: !!l.crossBorder,
        isDemo: true,
        viewCount: Math.floor(Math.random() * 180) + 5,
        publishedAt: status === "PENDING_REVIEW" ? null : publishedAt,
        soldAt: status === "SOLD" ? new Date(publishedAt.getTime() + 2 * 86_400_000) : null,
        createdAt: publishedAt,
      },
    });
    await attachDemoImages(db, listing.id, sellerId, l);
    created++;
  }

  // Quelques favoris pour peupler les compteurs.
  const kamel = userIds.get("kamel")!;
  const sonia = userIds.get("sonia")!;
  const favCandidates = await db.listing.findMany({ where: { isDemo: true, status: "ACTIVE" }, take: 8, orderBy: { publishedAt: "desc" } });
  for (const [i, listing] of favCandidates.entries()) {
    const userId = i % 2 === 0 ? kamel : sonia;
    if (listing.sellerId === userId) continue;
    const existing = await db.favorite.findUnique({ where: { userId_listingId: { userId, listingId: listing.id } } });
    if (existing) continue;
    await db.$transaction([
      db.favorite.create({ data: { userId, listingId: listing.id } }),
      db.listing.update({ where: { id: listing.id }, data: { favoriteCount: { increment: 1 } } }),
    ]);
  }

  return { users: DEMO_USERS.length, listingsCreated: created };
}

async function attachDemoImages(db: PrismaClient, listingId: string, ownerId: string, l: DemoListing) {
  for (let i = 0; i < (l.images ?? 1); i++) {
    const raw = await demoImage(l.icon, (l.hue + i * 18) % 360, i);
    const processed = await processImage(raw);
    const id = crypto.randomUUID();
    const thumbKey = newStorageKey("listings", id, "webp", "thumb");
    const largeKey = newStorageKey("listings", id, "webp", "large");
    await putObject(thumbKey, processed.thumb, "image/webp");
    await putObject(largeKey, processed.large, "image/webp");
    await db.listingImage.create({
      data: { id, listingId, ownerId, thumbKey, largeKey, width: processed.width, height: processed.height, sizeBytes: processed.sizeBytes, blurDataUrl: processed.blurDataUrl, sortOrder: i },
    });
  }
}
