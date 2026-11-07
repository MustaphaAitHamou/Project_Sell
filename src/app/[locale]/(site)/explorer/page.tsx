import type { Metadata } from "next";
import { SearchView } from "@/features/search/search-view";
import { activeFilterCount, parseSearchParams } from "@/server/services/search";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const f = parseSearchParams(await searchParams);
  // Pages filtrées non indexées (contenu dupliqué) ; canonique sans paramètres.
  return { title: "Explorer les articles", alternates: { canonical: "/explorer" }, robots: activeFilterCount(f) > 0 || f.q || f.page > 1 ? { index: false, follow: true } : undefined };
}

export default async function ExplorePage({ searchParams }: Props) {
  const filters = parseSearchParams(await searchParams);
  return <SearchView filters={filters} basePath="/explorer" title={filters.q ? `Résultats pour « ${filters.q} »` : "Explorer les articles"} />;
}
