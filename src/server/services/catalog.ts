import "server-only";
import type { AttributeType } from "@/generated/prisma/client";
import { normalizeForSearch } from "@/lib/domain/text";
import { db } from "@/server/db/client";

export interface CategoryNode {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  icon: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  isTransactional: boolean;
  requiresReview: boolean;
  isProhibited: boolean;
  conditionRequired: boolean;
  children: CategoryNode[];
  depth: number;
}

export interface CategoryAttributeDef {
  key: string;
  label: string;
  type: AttributeType;
  options: string[];
  unit: string | null;
  isRequired: boolean;
  isFilterable: boolean;
}

interface CatalogCache {
  at: number;
  byId: Map<string, CategoryNode>;
  bySlug: Map<string, CategoryNode>;
  roots: CategoryNode[];
  attributes: Map<string, CategoryAttributeDef[]>;
}

let cache: CatalogCache | null = null;
const TTL_MS = 60_000;

/** Catalogue en mémoire (petite table, lue très souvent), rafraîchi chaque minute ou après modification. */
async function load(): Promise<CatalogCache> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  const [rows, attrs] = await Promise.all([
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.categoryAttribute.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const byId = new Map<string, CategoryNode>();
  for (const r of rows)
    byId.set(r.id, {
      id: r.id,
      parentId: r.parentId,
      slug: r.slug,
      name: r.name,
      icon: r.icon,
      description: r.description,
      sortOrder: r.sortOrder,
      isActive: r.isActive,
      isTransactional: r.isTransactional,
      requiresReview: r.requiresReview,
      isProhibited: r.isProhibited,
      conditionRequired: r.conditionRequired,
      children: [],
      depth: 0,
    });
  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const setDepth = (n: CategoryNode, d: number) => {
    n.depth = d;
    n.children.sort((a, b) => a.sortOrder - b.sortOrder);
    n.children.forEach((c) => setDepth(c, d + 1));
  };
  roots.sort((a, b) => a.sortOrder - b.sortOrder).forEach((r) => setDepth(r, 0));
  const attributes = new Map<string, CategoryAttributeDef[]>();
  for (const a of attrs) {
    const list = attributes.get(a.categoryId) ?? [];
    list.push({
      key: a.key,
      label: a.label,
      type: a.type,
      options: Array.isArray(a.options) ? (a.options as string[]) : [],
      unit: a.unit,
      isRequired: a.isRequired,
      isFilterable: a.isFilterable,
    });
    attributes.set(a.categoryId, list);
  }
  cache = { at: Date.now(), byId, bySlug: new Map([...byId.values()].map((n) => [n.slug, n])), roots, attributes };
  return cache;
}

export function invalidateCatalogCache() {
  cache = null;
}

/** Arbre des catégories actives (publiques). */
export async function getCategoryTree(): Promise<CategoryNode[]> {
  const c = await load();
  const filter = (nodes: CategoryNode[]): CategoryNode[] =>
    nodes.filter((n) => n.isActive && !n.isProhibited).map((n) => ({ ...n, children: filter(n.children) }));
  return filter(c.roots);
}

export async function getAllCategories(): Promise<CategoryNode[]> {
  return [...(await load()).byId.values()];
}

export async function getCategoryBySlug(slug: string) {
  return (await load()).bySlug.get(slug) ?? null;
}

export async function getCategoryById(id: string) {
  return (await load()).byId.get(id) ?? null;
}

/** Chaîne de la catégorie vers la racine (index 0 = la catégorie elle-même). */
export async function getCategoryAncestry(id: string): Promise<CategoryNode[]> {
  const c = await load();
  const chain: CategoryNode[] = [];
  let node = c.byId.get(id);
  const seen = new Set<string>();
  while (node && !seen.has(node.id)) {
    chain.push(node);
    seen.add(node.id);
    node = node.parentId ? c.byId.get(node.parentId) : undefined;
  }
  return chain;
}

/** Identifiants de la catégorie et de toutes ses descendantes (filtre de recherche). */
export async function getCategoryDescendantIds(id: string): Promise<string[]> {
  const c = await load();
  const out: string[] = [];
  const walk = (n: CategoryNode | undefined) => {
    if (!n) return;
    out.push(n.id);
    n.children.forEach(walk);
  };
  walk(c.byId.get(id));
  return out;
}

/** Attributs applicables : ceux de la catégorie et de ses ancêtres (les plus spécifiques priment). */
export async function getCategoryAttributes(categoryId: string): Promise<CategoryAttributeDef[]> {
  const c = await load();
  const chain = await getCategoryAncestry(categoryId);
  const byKey = new Map<string, CategoryAttributeDef>();
  for (const node of [...chain].reverse()) for (const a of c.attributes.get(node.id) ?? []) byKey.set(a.key, a);
  return [...byKey.values()];
}

/** Catégories « feuilles » sélectionnables à la publication. */
export async function getSelectableCategories() {
  const tree = await getCategoryTree();
  const out: { id: string; name: string; parentName: string | null; slug: string; requiresReview: boolean; conditionRequired: boolean }[] = [];
  const walk = (n: CategoryNode, parent: CategoryNode | null) => {
    if (n.children.length === 0) out.push({ id: n.id, name: n.name, parentName: parent?.name ?? null, slug: n.slug, requiresReview: n.requiresReview, conditionRequired: n.conditionRequired });
    else n.children.forEach((c) => walk(c, n));
  };
  tree.forEach((r) => walk(r, null));
  return out;
}

export async function getActiveCountries() {
  return db.country.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
}

export async function getRegions(countryCode: string) {
  return db.region.findMany({ where: { countryCode, isActive: true }, orderBy: [{ sortOrder: "asc" }], select: { id: true, code: true, name: true, slug: true } });
}

export async function getCities(regionId: string) {
  return db.city.findMany({ where: { regionId }, orderBy: [{ isPopular: "desc" }, { name: "asc" }], select: { id: true, name: true, slug: true } });
}

/** Recherche de villes tolérante (accents, variantes kabyles : « bgayet » → Béjaïa). */
export async function searchCities(query: string, countryCode?: string) {
  const q = normalizeForSearch(query);
  if (q.length < 2) return [];
  return db.$queryRaw<{ id: string; name: string; regionId: string; regionName: string; countryCode: string }[]>`
    SELECT c."id", c."name", c."regionId", r."name" AS "regionName", c."countryCode"
    FROM "city" c JOIN "region" r ON r."id" = c."regionId"
    WHERE (${countryCode ?? null}::text IS NULL OR c."countryCode" = ${countryCode ?? null})
      AND EXISTS (SELECT 1 FROM unnest(c."searchNames") n WHERE n LIKE ${q + "%"} OR n LIKE ${"% " + q + "%"})
    ORDER BY c."isPopular" DESC, c."name" ASC LIMIT 10`;
}

export async function getBrands() {
  return db.brand.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } });
}
