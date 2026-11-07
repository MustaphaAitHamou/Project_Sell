import { preflight, publicGet } from "@/server/api/http";
import { toCard } from "@/server/api/v1/mappers";
import { listingPageSchema } from "@/server/api/v1/schemas";
import { parseSearchParams, SEARCH_PAGE_SIZE, searchListings } from "@/server/services/search";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/listings — recherche d'annonces (mêmes paramètres que la page de recherche :
 * q, categorie, pays, region, ville, prix_min, prix_max, etat, marque, livraison, verifie,
 * vendeur, vendus, tri, page). Requêtes paramétrées, pagination bornée.
 */
export const GET = publicGet(async (request) => {
  const sp = Object.fromEntries(new URL(request.url).searchParams.entries());
  const result = await searchListings(parseSearchParams(sp), { track: false });
  return listingPageSchema.parse({ items: result.items.map(toCard), page: result.page, pageCount: result.pageCount, total: result.total, pageSize: SEARCH_PAGE_SIZE });
});

export const OPTIONS = preflight;
