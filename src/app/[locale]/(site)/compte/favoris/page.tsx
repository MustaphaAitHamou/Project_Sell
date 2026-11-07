import { Heart } from "lucide-react";
import type { Metadata } from "next";
import { ListingCard, ListingGrid } from "@/components/listings/listing-card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";
import { requireUserPage } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { getFavorites } from "@/server/services/favorites";

export const metadata: Metadata = { title: "Mes favoris" };

export default async function FavoritesPage() {
  const user = await requireUserPage("/compte/favoris");
  const [items, searches] = await Promise.all([getFavorites(user.id), db.savedSearch.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } })]);
  return (
    <>
      <PageHeader title="Mes favoris" description={`${items.length} article(s) suivi(s)`} />
      {items.length === 0 ? (
        <EmptyState icon={Heart} title="Aucun favori" description="Touchez le cœur d'une annonce pour la retrouver ici." action={<Link href="/explorer" className={buttonVariants()}>Explorer</Link>} />
      ) : (
        <ListingGrid className="xl:grid-cols-4">
          {items.map((l) => (
            <ListingCard key={l.id} listing={l} favorited signedIn />
          ))}
        </ListingGrid>
      )}
      {searches.length ? (
        <section className="grid gap-3">
          <h2 className="text-lg font-bold">Recherches sauvegardées</h2>
          <ul className="flex flex-wrap gap-2">
            {searches.map((s) => (
              <li key={s.id}>
                <Link href={`/explorer?${new URLSearchParams(s.query as Record<string, string>).toString()}`} className="inline-block rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted">
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
