import type { Metadata } from "next";
import { SearchView } from "@/features/search/search-view";
import { parseSearchParams } from "@/server/services/search";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export const metadata: Metadata = { title: "Recherche", robots: { index: false, follow: true }, alternates: { canonical: "/explorer" } };

export default async function SearchPage({ searchParams }: Props) {
  const filters = parseSearchParams(await searchParams);
  return <SearchView filters={filters} basePath="/recherche" title={filters.q ? `Résultats pour « ${filters.q} »` : "Rechercher"} />;
}
