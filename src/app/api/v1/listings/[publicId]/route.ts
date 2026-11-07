import { preflight, publicGet } from "@/server/api/http";
import { abs, money, ratingOf, toCard } from "@/server/api/v1/mappers";
import { listingDetailSchema } from "@/server/api/v1/schemas";
import { isPublicId } from "@/lib/domain/ids";
import { notFound } from "@/server/security/errors";
import { getListingByPublicId } from "@/server/services/listings";

export const dynamic = "force-dynamic";

/** GET /api/v1/listings/{id} — fiche publique (en ligne, réservée ou vendue). */
export const GET = publicGet<{ publicId: string }>(async (_request, { publicId }) => {
  if (!isPublicId(publicId)) throw notFound("Annonce introuvable.");
  const result = await getListingByPublicId(publicId, null);
  if (!result?.isPublic) throw notFound("Annonce introuvable.");
  const l = result.listing;
  const p = l.seller.profile;
  if (!p) throw notFound("Annonce introuvable.");
  return listingDetailSchema.parse({
    ...toCard({ ...l, images: l.images.slice(0, 1) }),
    price: money(l.priceAmount, l.currency),
    description: l.description,
    category: { slug: l.category.slug, name: l.category.name },
    attributes: (l.attributes ?? {}) as Record<string, string>,
    images: l.images.map((img) => ({ thumb: abs(`/api/images/${img.id}/thumb`), large: abs(`/api/images/${img.id}/large`), width: img.width, height: img.height })),
    quantityAvailable: l.quantityAvailable,
    parcelSize: l.parcelSize,
    acceptsCrossBorder: l.acceptsCrossBorder,
    seller: { handle: p.handle, displayName: p.displayName, type: p.sellerType, identityVerified: p.identityVerified, rating: ratingOf(p.ratingSum, p.ratingCount), salesCount: p.salesCount, url: abs(`/vendeur/${p.handle}`) },
  });
});

export const OPTIONS = preflight;
