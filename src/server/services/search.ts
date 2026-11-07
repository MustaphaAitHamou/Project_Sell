import "server-only";
import { Prisma, type DeliveryMethod, type ItemCondition } from "@/generated/prisma/client";
import { parseAmountToMinor } from "@/lib/domain/money";
import { normalizeForSearch, sanitizeText } from "@/lib/domain/text";
import { track } from "@/server/analytics";
import { db } from "@/server/db/client";
import { getCategoryBySlug, getCategoryDescendantIds } from "./catalog";
import { cardSelect, type ListingCardData } from "./listings";

export const SEARCH_PAGE_SIZE = 24;
export const SEARCH_MAX_PAGES = 50;

export type SearchSort = "relevance" | "recent" | "price_asc" | "price_desc";

export interface SearchFilters {
  q: string | null;
  category: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  priceMin: string | null;
  priceMax: string | null;
  conditions: ItemCondition[];
  brand: string | null;
  delivery: boolean;
  verified: boolean;
  sellerType: "INDIVIDUAL" | "BUSINESS" | null;
  includeSold: boolean;
  sort: SearchSort;
  page: number;
}

const CONDITIONS: ItemCondition[] = ["NEW_WITH_TAGS", "NEW_WITHOUT_TAGS", "VERY_GOOD", "GOOD", "FAIR", "FOR_PARTS"];
const SORTS: Record<string, SearchSort> = { pertinence: "relevance", recent: "recent", prix_asc: "price_asc", prix_desc: "price_desc" };

/** Lecture des paramètres d'URL (noms français, valeurs validées : rien n'atteint le SQL sans contrôle). */
export function parseSearchParams(sp: Record<string, string | string[] | undefined>): SearchFilters {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || null;
  };
  const many = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v : v ? v.split(",") : []).map((x) => x.trim()).filter(Boolean);
  };
  const q = one("q");
  const page = Math.min(SEARCH_MAX_PAGES, Math.max(1, Number.parseInt(one("page") ?? "1", 10) || 1));
  const country = one("pays");
  return {
    q: q ? sanitizeText(q, { multiline: false }).slice(0, 120) : null,
    category: one("categorie")?.replace(/[^a-z0-9-]/g, "") || null,
    country: country && /^[A-Z]{2}$/.test(country) ? country : null,
    region: one("region")?.match(/^[0-9a-f-]{36}$/) ? one("region") : null,
    city: one("ville")?.match(/^[0-9a-f-]{36}$/) ? one("ville") : null,
    priceMin: one("prix_min"),
    priceMax: one("prix_max"),
    conditions: many("etat").filter((c): c is ItemCondition => (CONDITIONS as string[]).includes(c)),
    brand: one("marque")?.replace(/[^a-z0-9-]/g, "") || null,
    delivery: one("livraison") === "1",
    verified: one("verifie") === "1",
    sellerType: one("vendeur") === "pro" ? "BUSINESS" : one("vendeur") === "particulier" ? "INDIVIDUAL" : null,
    includeSold: one("vendus") === "1",
    sort: SORTS[one("tri") ?? ""] ?? (q ? "relevance" : "recent"),
    page,
  };
}

/** Nombre de filtres actifs hors recherche et tri (sert aussi à la non-indexation SEO). */
export function activeFilterCount(f: SearchFilters) {
  return [f.country, f.region, f.city, f.priceMin, f.priceMax, f.brand, f.sellerType].filter(Boolean).length + f.conditions.length + Number(f.delivery) + Number(f.verified) + Number(f.includeSold);
}

export interface SearchResult {
  items: ListingCardData[];
  total: number;
  page: number;
  pageCount: number;
  appliedCategory: { id: string; slug: string; name: string } | null;
  priceCurrency: string | null;
}

/**
 * Recherche plein texte PostgreSQL : vecteur pondéré (titre, marque, catégorie,
 * description ; configurations « french » et « simple », sans accents) et repli par
 * similarité trigramme sur le titre (fautes de frappe). Requêtes paramétrées
 * (Prisma.sql), pagination serveur bornée, index GIN.
 */
export async function searchListings(f: SearchFilters, opts: { viewerId?: string | null; track?: boolean } = {}): Promise<SearchResult> {
  const where: Prisma.Sql[] = [
    f.includeSold ? Prisma.sql`l."status" IN ('ACTIVE', 'RESERVED', 'SOLD')` : Prisma.sql`l."status" = 'ACTIVE'`,
    Prisma.sql`u."status" = 'ACTIVE'`,
  ];

  let appliedCategory: SearchResult["appliedCategory"] = null;
  if (f.category) {
    const cat = await getCategoryBySlug(f.category);
    if (cat && cat.isActive) {
      appliedCategory = { id: cat.id, slug: cat.slug, name: cat.name };
      const ids = await getCategoryDescendantIds(cat.id);
      where.push(Prisma.sql`l."categoryId" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})`);
    }
  }
  if (f.country) where.push(Prisma.sql`l."countryCode" = ${f.country}`);
  if (f.region) where.push(Prisma.sql`l."regionId" = ${f.region}::uuid`);
  if (f.city) where.push(Prisma.sql`l."cityId" = ${f.city}::uuid`);
  if (f.conditions.length) where.push(Prisma.sql`l."condition" IN (${Prisma.join(f.conditions.map((c) => Prisma.sql`${c}::"ItemCondition"`))})`);
  if (f.brand) where.push(Prisma.sql`l."brandId" = (SELECT b."id" FROM "brand" b WHERE b."slug" = ${f.brand})`);
  if (f.delivery) where.push(Prisma.sql`l."deliveryMethods" && ARRAY['NATIONAL_SHIPPING', 'TAMURT_TRANSPORT']::"DeliveryMethod"[]`);
  if (f.verified) where.push(Prisma.sql`p."identityVerified" = true`);
  if (f.sellerType) where.push(Prisma.sql`p."sellerType" = ${f.sellerType}::"SellerType"`);

  // Le prix n'a de sens que dans une devise : il s'applique dans la devise du pays choisi.
  let priceCurrency: string | null = null;
  if (f.country && (f.priceMin || f.priceMax)) {
    const country = await db.country.findUnique({ where: { code: f.country }, select: { currency: true } });
    priceCurrency = country?.currency ?? null;
    if (priceCurrency) {
      const min = f.priceMin ? parseAmountToMinor(f.priceMin, priceCurrency) : null;
      const max = f.priceMax ? parseAmountToMinor(f.priceMax, priceCurrency) : null;
      if (min !== null) where.push(Prisma.sql`l."priceAmount" >= ${min}`);
      if (max !== null) where.push(Prisma.sql`l."priceAmount" <= ${max}`);
    }
  }

  const normalizedQ = f.q ? normalizeForSearch(f.q) : "";
  let rankSql = Prisma.sql`0`;
  if (normalizedQ) {
    // Chaque mot est cherché sous sa forme racinisée (français) OU exacte (noms propres,
    // kabyle en graphie latine, marques) ; les mots sont combinés en ET.
    const words = normalizedQ.split(" ").filter(Boolean).slice(0, 8);
    const tsq = Prisma.sql`(${Prisma.join(
      words.map((w) => Prisma.sql`(plainto_tsquery('french', ${w}) || plainto_tsquery('simple', ${w}))`),
      " && ",
    )})`;
    where.push(Prisma.sql`(l."searchVector" @@ ${tsq} OR ${normalizedQ} <% tm_unaccent(lower(l."title")))`);
    rankSql = Prisma.sql`(ts_rank_cd(l."searchVector", ${tsq}, 32) * 2 + word_similarity(${normalizedQ}, tm_unaccent(lower(l."title"))))`;
  }

  const whereSql = Prisma.join(where, " AND ");
  const order =
    f.sort === "price_asc"
      ? Prisma.sql`l."priceAmount" ASC, l."publishedAt" DESC`
      : f.sort === "price_desc"
        ? Prisma.sql`l."priceAmount" DESC, l."publishedAt" DESC`
        : f.sort === "relevance" && normalizedQ
          ? Prisma.sql`rank DESC, l."publishedAt" DESC`
          : Prisma.sql`l."publishedAt" DESC NULLS LAST`;
  const offset = (f.page - 1) * SEARCH_PAGE_SIZE;

  const [rows, countRows] = await Promise.all([
    db.$queryRaw<{ id: string; rank: number }[]>`
      SELECT l."id", ${rankSql} AS rank
      FROM "listing" l
      JOIN "user" u ON u."id" = l."sellerId"
      JOIN "user_profile" p ON p."userId" = l."sellerId"
      WHERE ${whereSql}
      ORDER BY ${order}
      LIMIT ${SEARCH_PAGE_SIZE} OFFSET ${offset}`,
    db.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM "listing" l
      JOIN "user" u ON u."id" = l."sellerId"
      JOIN "user_profile" p ON p."userId" = l."sellerId"
      WHERE ${whereSql}`,
  ]);
  const total = Number(countRows[0]?.count ?? 0);
  const cards = rows.length ? await db.listing.findMany({ where: { id: { in: rows.map((r) => r.id) } }, select: cardSelect }) : [];
  const byId = new Map(cards.map((c) => [c.id, c]));
  const items = rows.map((r) => byId.get(r.id)).filter((x): x is ListingCardData => !!x);

  if (opts.track !== false && f.page === 1) {
    if (normalizedQ && total === 0) await track("search.no_results", { userId: opts.viewerId, properties: { q: normalizedQ.slice(0, 60), filters: activeFilterCount(f) } });
    else await track("search.performed", { userId: opts.viewerId, properties: { hasQuery: !!normalizedQ, filters: activeFilterCount(f), results: Math.min(total, 1000) } });
  }
  return { items, total, page: f.page, pageCount: Math.min(SEARCH_MAX_PAGES, Math.ceil(total / SEARCH_PAGE_SIZE)), appliedCategory, priceCurrency };
}

/** Sérialisation inverse : URL partageable et canonique des filtres. */
export function filtersToQuery(f: Partial<SearchFilters>): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.category) p.set("categorie", f.category);
  if (f.country) p.set("pays", f.country);
  if (f.region) p.set("region", f.region);
  if (f.city) p.set("ville", f.city);
  if (f.priceMin) p.set("prix_min", f.priceMin);
  if (f.priceMax) p.set("prix_max", f.priceMax);
  if (f.conditions?.length) p.set("etat", f.conditions.join(","));
  if (f.brand) p.set("marque", f.brand);
  if (f.delivery) p.set("livraison", "1");
  if (f.verified) p.set("verifie", "1");
  if (f.sellerType) p.set("vendeur", f.sellerType === "BUSINESS" ? "pro" : "particulier");
  if (f.includeSold) p.set("vendus", "1");
  if (f.sort && f.sort !== (f.q ? "relevance" : "recent")) p.set("tri", { relevance: "pertinence", recent: "recent", price_asc: "prix_asc", price_desc: "prix_desc" }[f.sort]);
  if (f.page && f.page > 1) p.set("page", String(f.page));
  return p.toString();
}

export type { DeliveryMethod };
