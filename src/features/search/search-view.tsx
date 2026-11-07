import { SearchX, X } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ListingCard, ListingGrid } from "@/components/listings/listing-card";
import { EmptyState } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { getActiveCountries, getBrands, getCategoryTree, getRegions, type CategoryNode } from "@/server/services/catalog";
import { getFavoriteIds } from "@/server/services/favorites";
import { activeFilterCount, filtersToQuery, searchListings, type SearchFilters } from "@/server/services/search";
import { MobileFilters, SaveSearchButton, SearchSidebar, SortSelect, type FilterState } from "./search-controls";

const CONDITIONS = ["NEW_WITH_TAGS", "NEW_WITHOUT_TAGS", "VERY_GOOD", "GOOD", "FAIR", "FOR_PARTS"] as const;

function flatten(nodes: CategoryNode[], out: { slug: string; name: string; depth: number }[] = []) {
  for (const n of nodes) {
    out.push({ slug: n.slug, name: n.name, depth: n.depth });
    flatten(n.children, out);
  }
  return out;
}

export async function SearchView({ filters, basePath, title, intro, lockCategory = false }: { filters: SearchFilters; basePath: string; title: string; intro?: React.ReactNode; lockCategory?: boolean }) {
  const [t, user, tree, countries, brands] = await Promise.all([getTranslations(), getCurrentUser(), getCategoryTree(), getActiveCountries(), getBrands()]);
  const result = await searchListings(filters, { viewerId: user?.id ?? null });
  const favs = user ? await getFavoriteIds(user.id, result.items.map((l) => l.id)) : new Set<string>();
  const regionsByCountry = Object.fromEntries(await Promise.all(countries.map(async (c) => [c.code, await getRegions(c.code)] as const)));
  const sortKey = { relevance: "pertinence", recent: "recent", price_asc: "prix_asc", price_desc: "prix_desc" }[filters.sort];
  const initial: FilterState = {
    q: filters.q ?? "",
    category: filters.category ?? "",
    country: filters.country ?? "",
    region: filters.region ?? "",
    priceMin: filters.priceMin ?? "",
    priceMax: filters.priceMax ?? "",
    conditions: filters.conditions,
    brand: filters.brand ?? "",
    delivery: filters.delivery,
    verified: filters.verified,
    sellerType: filters.sellerType === "BUSINESS" ? "pro" : filters.sellerType === "INDIVIDUAL" ? "particulier" : "",
    includeSold: filters.includeSold,
    sort: sortKey,
  };
  const options = {
    categories: flatten(tree),
    countries: countries.map((c) => ({ code: c.code, name: c.name, currency: c.currency })),
    regionsByCountry,
    brands: brands.map((b) => ({ slug: b.slug, name: b.name })),
    conditions: CONDITIONS.map((c) => ({ value: c, label: t(`conditions.${c}`) })),
  };
  const baseFilters = lockCategory ? { ...filters, category: null } : filters;
  const hrefFor = (page: number) => {
    const qs = filtersToQuery({ ...baseFilters, page });
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const without = (patch: Partial<SearchFilters>) => {
    const qs = filtersToQuery({ ...baseFilters, ...patch, page: 1 });
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const chips: { label: string; href: string }[] = [];
  if (filters.country) chips.push({ label: countries.find((c) => c.code === filters.country)?.name ?? filters.country, href: without({ country: null, region: null, priceMin: null, priceMax: null }) });
  if (filters.region) chips.push({ label: regionsByCountry[filters.country ?? ""]?.find((r) => r.id === filters.region)?.name ?? "Région", href: without({ region: null }) });
  if (filters.priceMin || filters.priceMax) chips.push({ label: `Prix ${filters.priceMin ?? "0"} – ${filters.priceMax ?? "∞"} ${result.priceCurrency ?? ""}`.trim(), href: without({ priceMin: null, priceMax: null }) });
  for (const c of filters.conditions) chips.push({ label: t(`conditions.${c}`), href: without({ conditions: filters.conditions.filter((x) => x !== c) }) });
  if (filters.brand) chips.push({ label: brands.find((b) => b.slug === filters.brand)?.name ?? filters.brand, href: without({ brand: null }) });
  if (filters.delivery) chips.push({ label: t("search.delivery"), href: without({ delivery: false }) });
  if (filters.verified) chips.push({ label: t("search.verified"), href: without({ verified: false }) });
  if (filters.sellerType) chips.push({ label: filters.sellerType === "BUSINESS" ? t("search.sellerBusiness") : t("search.sellerIndividual"), href: without({ sellerType: null }) });
  if (filters.includeSold) chips.push({ label: t("search.includeSold"), href: without({ includeSold: false }) });
  if (!lockCategory && result.appliedCategory) chips.push({ label: result.appliedCategory.name, href: without({ category: null }) });

  return (
    <div className="container-page grid gap-6 py-6 md:py-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {intro}
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("common.results", { count: result.total })}
        </p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden lg:block" aria-label="Filtres">
          <div className="sticky top-36 rounded-xl border border-border bg-card p-4">
            <SearchSidebar initial={initial} options={options} basePath={basePath} lockCategory={lockCategory} />
          </div>
        </aside>
        <div className="grid content-start gap-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MobileFilters initial={initial} options={options} basePath={basePath} activeCount={activeFilterCount(filters)} lockCategory={lockCategory} />
              <SaveSearchButton query={filtersToQuery(filters)} defaultName={filters.q ?? result.appliedCategory?.name ?? title} signedIn={!!user} />
            </div>
            <SortSelect initial={initial} basePath={basePath} />
          </div>
          {chips.length ? (
            <ul className="flex flex-wrap gap-2" aria-label={t("search.activeFilters")}>
              {chips.map((c) => (
                <li key={c.label}>
                  <Link href={c.href} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-3 py-1 text-xs font-medium text-primary-soft-foreground hover:bg-primary-soft/70">
                    {c.label} <X className="size-3" aria-label="Retirer" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {result.items.length === 0 ? (
            <EmptyState icon={SearchX} title={t("search.noResultsTitle")} description={t("search.noResultsText")} />
          ) : (
            <ListingGrid className="xl:grid-cols-4">
              {result.items.map((l, i) => (
                <ListingCard key={l.id} listing={l} favorited={favs.has(l.id)} signedIn={!!user} priority={i < 4} />
              ))}
            </ListingGrid>
          )}
          <Pagination page={result.page} pageCount={result.pageCount} hrefFor={hrefFor} />
        </div>
      </div>
    </div>
  );
}
