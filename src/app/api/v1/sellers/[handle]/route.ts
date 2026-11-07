import { isValidHandle } from "@/lib/domain/ids";
import { preflight, publicGet } from "@/server/api/http";
import { abs, ratingOf, toCard } from "@/server/api/v1/mappers";
import { sellerProfileSchema } from "@/server/api/v1/schemas";
import { db } from "@/server/db/client";
import { notFound } from "@/server/security/errors";
import { cardSelect } from "@/server/services/listings";
import { getPublicProfile } from "@/server/services/profiles";

export const dynamic = "force-dynamic";

/** GET /api/v1/sellers/{handle} — profil public et dernières annonces en ligne. */
export const GET = publicGet<{ handle: string }>(async (_request, { handle }) => {
  if (!isValidHandle(handle)) throw notFound("Profil introuvable.");
  const p = await getPublicProfile(handle);
  if (!p) throw notFound("Profil introuvable.");
  const listings = await db.listing.findMany({ where: { sellerId: p.userId, status: "ACTIVE" }, orderBy: { publishedAt: "desc" }, take: 24, select: cardSelect });
  const b = p.sellerType === "BUSINESS" ? p.user.business : null;
  return sellerProfileSchema.parse({
    handle: p.handle,
    displayName: p.displayName,
    type: p.sellerType,
    identityVerified: p.identityVerified,
    rating: ratingOf(p.ratingSum, p.ratingCount),
    salesCount: p.salesCount,
    url: abs(`/vendeur/${p.handle}`),
    bio: p.bio,
    location: [p.cityName, p.region?.name, p.country?.name].filter(Boolean).join(", ") || null,
    memberSince: p.user.createdAt.toISOString(),
    business: b ? { legalName: b.legalName, tradeName: b.tradeName, registrationCountry: b.registrationCountry } : null,
    listings: listings.map(toCard),
  });
});

export const OPTIONS = preflight;
