import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { ListingStatusBadge } from "@/components/ui/status-badge";
import { ListingModeration } from "@/features/admin/client";
import { AdminTable } from "@/features/admin/table";
import type { ListingStatus, Prisma } from "@/generated/prisma/client";
import { Link } from "@/i18n/navigation";
import { listingPath } from "@/lib/domain/ids";
import { formatMoney } from "@/lib/domain/money";
import { can, requirePermissionPage } from "@/server/auth/session";
import { db } from "@/server/db/client";

export const metadata = { title: "Annonces" };

const PAGE = 30;
const STATUSES: ListingStatus[] = ["DRAFT", "PENDING_REVIEW", "ACTIVE", "RESERVED", "SOLD", "SUSPENDED", "REJECTED", "ARCHIVED", "DELETED"];
const LABELS: Record<string, string> = { DRAFT: "Brouillon", PENDING_REVIEW: "En vérification", ACTIVE: "En ligne", RESERVED: "Réservée", SOLD: "Vendue", SUSPENDED: "Suspendue", REJECTED: "Refusée", ARCHIVED: "Archivée", DELETED: "Supprimée" };
const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" });

export default async function AdminListingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requirePermissionPage("listings.read_all");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const status = STATUSES.includes(sp.statut as ListingStatus) ? (sp.statut as ListingStatus) : undefined;
  const demo = sp.demo === "1" ? true : sp.demo === "0" ? false : undefined;
  const page = Math.max(1, Math.min(200, Number.parseInt(sp.page ?? "1", 10) || 1));
  const where: Prisma.ListingWhereInput = {
    ...(status ? { status } : { status: { not: "DELETED" } }),
    ...(demo !== undefined ? { isDemo: demo } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { publicId: q.toUpperCase() }, { seller: { profile: { handle: { contains: q.toLowerCase().replace(/^@/, "") } } } }] } : {}),
  };
  const [listings, total, counts] = await Promise.all([
    db.listing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: { id: true, title: true, slug: true, publicId: true, status: true, priceAmount: true, currency: true, countryCode: true, createdAt: true, viewCount: true, isDemo: true, sellerId: true, category: { select: { name: true } }, seller: { select: { profile: { select: { displayName: true } } } }, _count: { select: { favorites: true } } },
    }),
    db.listing.count({ where }),
    db.listing.groupBy({ by: ["status"], _count: true }),
  ]);
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (status) u.set("statut", status);
    if (demo !== undefined) u.set("demo", demo ? "1" : "0");
    if (p > 1) u.set("page", String(p));
    return `/admin/annonces${u.size ? `?${u}` : ""}`;
  };
  const canModerate = can(staff, "listings.moderate");
  return (
    <>
      <PageHeader title="Annonces" description={counts.map((c) => `${LABELS[c.status]} : ${c._count}`).join(" · ")} />
      <form className="flex flex-wrap items-end gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Titre, référence ou @vendeur" aria-label="Rechercher une annonce" className="w-72" />
        <Select name="statut" defaultValue={status ?? ""} aria-label="Statut" className="w-44">
          <option value="">Tous (hors supprimées)</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {LABELS[s]}
            </option>
          ))}
        </Select>
        <Select name="demo" defaultValue={sp.demo ?? ""} aria-label="Démonstration" className="w-44">
          <option value="">Démo et réelles</option>
          <option value="1">Démonstration</option>
          <option value="0">Réelles</option>
        </Select>
        <Button type="submit" variant="outline">
          <Search /> Filtrer
        </Button>
      </form>
      <AdminTable
        head={["Annonce", "Vendeur", "Statut", "Prix", "Catégorie", "Vues / favoris", "Créée", canModerate ? "Modération" : ""]}
        empty="Aucune annonce."
        rows={await Promise.all(
          listings.map(async (l) => [
            <div key="t" className="grid max-w-xs gap-0.5">
              <Link href={listingPath(l.slug, l.publicId)} className="font-medium hover:underline">
                {l.title}
              </Link>
              <span className="text-xs text-muted-foreground">
                {l.publicId} · {l.countryCode}
                {l.isDemo ? " · démonstration" : ""}
              </span>
            </div>,
            <Link key="s" href={`/admin/utilisateurs?u=${l.sellerId}`} className="text-primary hover:underline">
              {l.seller.profile?.displayName ?? "—"}
            </Link>,
            <ListingStatusBadge key="b" status={l.status} />,
            formatMoney(l.priceAmount, l.currency),
            l.category.name,
            `${l.viewCount} / ${l._count.favorites}`,
            dateFmt.format(l.createdAt),
            canModerate ? <ListingModeration key="m" listingId={l.id} status={l.status} /> : null,
          ]),
        )}
      />
      <Pagination page={page} pageCount={Math.ceil(total / PAGE)} hrefFor={qs} />
    </>
  );
}
