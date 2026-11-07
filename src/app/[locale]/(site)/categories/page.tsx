import type { Metadata } from "next";
import { CategoryIcon } from "@/components/listings/category-icon";
import { Card, PageHeader } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";
import { getCategoryTree } from "@/server/services/catalog";

export const metadata: Metadata = { title: "Toutes les catégories", alternates: { canonical: "/categories" } };

export default async function CategoriesPage() {
  const tree = await getCategoryTree();
  return (
    <div className="container-page grid gap-8 py-8">
      <PageHeader title="Toutes les catégories" description="Mode, high-tech, maison, artisanat… Les véhicules, l'immobilier et les services ne sont pas encore ouverts." />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tree.map((c) => (
          <li key={c.id}>
            <Card className="grid h-full content-start gap-3 p-5">
              <Link href={`/categorie/${c.slug}`} className="flex items-center gap-3 font-semibold hover:underline">
                <span className="grid size-10 place-items-center rounded-full bg-primary-soft text-primary-soft-foreground">
                  <CategoryIcon name={c.icon} className="size-5" />
                </span>
                {c.name}
              </Link>
              {c.children.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {c.children.map((s) => (
                    <li key={s.id}>
                      <Link href={`/categorie/${s.slug}`} className="inline-block rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                        {s.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
