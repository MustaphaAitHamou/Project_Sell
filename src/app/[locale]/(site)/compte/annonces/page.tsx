import { ImageOff, Plus, Tag } from "lucide-react";
import type { Metadata } from "next";
import { Price } from "@/components/listings/price";
import { buttonVariants } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import { ListingOwnerActions } from "@/features/listings/owner-actions";
import { Link } from "@/i18n/navigation";
import { listingPath } from "@/lib/domain/ids";
import { cn, imageUrl } from "@/lib/utils";
import { requireUserPage } from "@/server/auth/session";
import { getOwnerListings } from "@/server/services/listings";

export const metadata: Metadata = { title: "Mes annonces" };

const TABS = [
  { key: "ALL", label: "Toutes" },
  { key: "ACTIVE", label: "En ligne" },
  { key: "PENDING_REVIEW", label: "En vérification" },
  { key: "DRAFT", label: "Brouillons" },
  { key: "SOLD", label: "Vendues" },
  { key: "ARCHIVED", label: "Désactivées" },
] as const;

export default async function MyListingsPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const { statut = "ALL" } = await searchParams;
  const user = await requireUserPage("/compte/annonces");
  const all = await getOwnerListings(user);
  const listings = statut === "ALL" ? all : all.filter((l) => l.status === statut);
  return (
    <>
      <PageHeader
        title="Mes annonces"
        description={`${all.length} annonce(s)`}
        actions={
          <Link href="/vendre/nouvelle-annonce" className={buttonVariants()}>
            <Plus /> Nouvelle annonce
          </Link>
        }
      />
      <nav className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4" aria-label="Filtrer par statut">
        {TABS.map((tab) => {
          const count = tab.key === "ALL" ? all.length : all.filter((l) => l.status === tab.key).length;
          return (
            <Link key={tab.key} href={`/compte/annonces?statut=${tab.key}`} aria-current={statut === tab.key ? "page" : undefined} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium", statut === tab.key ? "border-primary-text bg-primary-soft text-primary-soft-foreground" : "border-border text-muted-foreground hover:bg-muted")}>
              {tab.label} <span className="tabular-nums">({count})</span>
            </Link>
          );
        })}
      </nav>
      {listings.length === 0 ? (
        <EmptyState icon={Tag} title="Aucune annonce ici" description="Publiez votre premier article : c'est gratuit." action={<Link href="/vendre/nouvelle-annonce" className={buttonVariants()}>Vendre un article</Link>} />
      ) : (
        <ul className="grid gap-3">
          {listings.map((l) => (
            <li key={l.id}>
              <Card className="flex items-center gap-3 p-3 sm:gap-4">
                <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-20">
                  {l.images[0] ? <img src={imageUrl(l.images[0].id, "thumb")} alt="" className="size-full object-cover" loading="lazy" /> : <ImageOff className="m-auto mt-5 size-6 text-muted-foreground" aria-hidden />}
                </div>
                <div className="grid min-w-0 flex-1 gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ListingStatusBadge status={l.status} />
                    {l.quantity > 1 ? <span className="text-xs text-muted-foreground">{l.quantityAvailable}/{l.quantity} disponibles</span> : null}
                  </div>
                  {["ACTIVE", "RESERVED", "SOLD"].includes(l.status) ? (
                    <Link href={listingPath(l.slug, l.publicId)} className="truncate font-semibold hover:underline">
                      {l.title}
                    </Link>
                  ) : (
                    <Link href={`/vendre/${l.id}/modifier`} className="truncate font-semibold hover:underline">
                      {l.title}
                    </Link>
                  )}
                  <p className="text-xs text-muted-foreground">
                    <Price amount={l.priceAmount} currency={l.currency} className="text-sm text-foreground" /> · {l.viewCount} vues · {l.favoriteCount} favoris
                  </p>
                  {l.moderationNote ? <p className="text-xs text-destructive">{l.moderationNote}</p> : null}
                </div>
                <ListingOwnerActions listingId={l.id} status={l.status} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
