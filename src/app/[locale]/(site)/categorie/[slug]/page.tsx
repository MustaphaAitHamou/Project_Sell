import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryIcon } from "@/components/listings/category-icon";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { SearchView } from "@/features/search/search-view";
import { Link } from "@/i18n/navigation";
import { getCategoryAncestry, getCategoryBySlug } from "@/server/services/catalog";
import { activeFilterCount, parseSearchParams } from "@/server/services/search";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat || !cat.isActive || cat.isProhibited) return { title: "Catégorie introuvable", robots: { index: false } };
  const f = parseSearchParams(await searchParams);
  return {
    title: `${cat.name} d'occasion et neufs`,
    description: `Achetez et vendez ${cat.name.toLowerCase()} entre particuliers et professionnels en France et en Algérie sur Tamurt Market.`,
    alternates: { canonical: `/categorie/${cat.slug}` },
    robots: activeFilterCount(f) > 0 || f.q || f.page > 1 ? { index: false, follow: true } : undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat || !cat.isActive || cat.isProhibited) notFound();
  const ancestry = await getCategoryAncestry(cat.id);
  const filters = { ...parseSearchParams(await searchParams), category: cat.slug };
  const children = cat.children.filter((c) => c.isActive && !c.isProhibited);
  return (
    <>
      <div className="container-page pt-6">
        <Breadcrumb items={[{ href: "/", label: "Accueil" }, { href: "/categories", label: "Catégories" }, ...[...ancestry].reverse().map((c) => ({ href: `/categorie/${c.slug}`, label: c.name }))]} />
      </div>
      <SearchView
        filters={filters}
        basePath={`/categorie/${cat.slug}`}
        title={cat.name}
        lockCategory
        intro={
          <>
            {cat.description ? <p className="text-muted-foreground">{cat.description}</p> : null}
            {children.length ? (
              <ul className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
                {children.map((c) => (
                  <li key={c.id} className="shrink-0">
                    <Link href={`/categorie/${c.slug}`} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted">
                      <CategoryIcon name={c.icon} className="size-4 text-primary" /> {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        }
      />
    </>
  );
}
