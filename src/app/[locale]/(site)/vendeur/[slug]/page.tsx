import { BadgeCheck, CalendarDays, MapPin, Package, Star, Store } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ListingCard, ListingGrid } from "@/components/listings/listing-card";
import { ReportDialog } from "@/components/listings/report-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Badge, Card, EmptyState } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { Rating } from "@/components/ui/rating";
import { avatarUrl } from "@/lib/utils";
import { getCurrentUser } from "@/server/auth/session";
import { getFavoriteIds } from "@/server/services/favorites";
import { getSellerPublicListings } from "@/server/services/listings";
import { getPublicProfile } from "@/server/services/profiles";
import { getPublicReviews } from "@/server/services/reviews";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPublicProfile(slug);
  if (!p) return { title: "Profil introuvable", robots: { index: false } };
  return { title: `${p.displayName} — vendeur`, description: p.bio?.slice(0, 160) ?? `Les articles de ${p.displayName} sur Tamurt Market.`, alternates: { canonical: `/vendeur/${p.handle}` } };
}

export default async function SellerPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const page = Math.max(1, Number((await searchParams).page ?? 1) || 1);
  const profile = await getPublicProfile(slug);
  if (!profile) notFound();
  const [t, format, viewer] = await Promise.all([getTranslations("listing"), getFormatter(), getCurrentUser()]);
  const [{ items, total }, reviews] = await Promise.all([getSellerPublicListings(profile.userId, { limit: 24, offset: (page - 1) * 24 }), getPublicReviews(profile.userId, 10)]);
  const favs = viewer ? await getFavoriteIds(viewer.id, items.map((l) => l.id)) : new Set<string>();
  const finished = profile.salesCount + profile.sellerCancelledCount + profile.disputesLostCount;
  const successRate = finished > 0 ? Math.round((profile.salesCount / finished) * 100) : null;
  const business = profile.user.business;
  return (
    <div className="container-page grid gap-8 py-8">
      <Card className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:p-6">
        <Avatar name={profile.displayName} src={profile.avatarKey ? avatarUrl(profile.userId, profile.avatarKey) : null} size={88} />
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{profile.displayName}</h1>
            {profile.sellerType === "BUSINESS" ? (
              <Badge tone="info">
                <Store /> {t("proSeller")}
              </Badge>
            ) : null}
            {profile.identityVerified ? (
              <Badge tone="success">
                <BadgeCheck /> {t("verifiedSeller")}
              </Badge>
            ) : null}
          </div>
          {profile.ratingCount ? <Rating sum={profile.ratingSum} count={profile.ratingCount} label={`Note moyenne ${(profile.ratingSum / profile.ratingCount).toFixed(1)} sur 5`} /> : <p className="text-sm text-muted-foreground">{t("noReviews")}</p>}
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden /> {[profile.cityName, profile.region?.name, profile.country?.name].filter(Boolean).join(", ")}
            </li>
            <li className="flex items-center gap-1.5">
              <Package className="size-4" aria-hidden /> {t("salesCount", { count: profile.salesCount })}
            </li>
            {successRate !== null ? (
              <li className="flex items-center gap-1.5">
                <Star className="size-4" aria-hidden /> {successRate} % de ventes menées à terme
              </li>
            ) : null}
            <li className="flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden /> {t("memberSince", { date: format.dateTime(profile.user.createdAt, { month: "long", year: "numeric" }) })}
            </li>
          </ul>
          {profile.bio ? <p className="max-w-2xl text-sm leading-relaxed whitespace-pre-line">{profile.bio}</p> : null}
        </div>
      </Card>

      {business ? (
        <Card className="grid gap-1 p-4 text-sm">
          <p className="font-semibold">{t("traderInfo")}</p>
          <p className="text-muted-foreground">
            {business.legalName}
            {business.tradeName ? ` (${business.tradeName})` : ""} · immatriculation {business.registrationNumber}
            {business.vatNumber ? ` · TVA ${business.vatNumber}` : ""}
          </p>
          <p className="text-muted-foreground">
            {business.addressLine1}, {business.postalCode} {business.city} ({business.countryCode}) · {business.contactEmail}
          </p>
          <p className="text-xs text-muted-foreground">Vérification d&apos;entreprise : {business.verificationStatus === "VERIFIED" ? "effectuée" : "en attente"}. Les achats auprès d&apos;un professionnel ouvrent des droits spécifiques (garantie légale de conformité, rétractation selon les cas).</p>
        </Card>
      ) : null}

      <section className="grid gap-4" aria-labelledby="seller-listings">
        <h2 id="seller-listings" className="text-lg font-bold">
          Articles en vente ({total})
        </h2>
        {items.length ? (
          <ListingGrid>
            {items.map((l) => (
              <ListingCard key={l.id} listing={l} favorited={favs.has(l.id)} signedIn={!!viewer} />
            ))}
          </ListingGrid>
        ) : (
          <EmptyState title="Aucun article en vente pour le moment" />
        )}
        <Pagination page={page} pageCount={Math.ceil(total / 24)} hrefFor={(p) => `/vendeur/${profile.handle}?page=${p}`} />
      </section>

      <section className="grid gap-4" aria-labelledby="reviews">
        <h2 id="reviews" className="text-lg font-bold">
          Avis ({profile.ratingCount})
        </h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">Les avis apparaissent après des transactions réelles menées à terme sur Tamurt Market.</p>
        ) : (
          <ul className="grid gap-3">
            {reviews.map((r) => (
              <li key={r.id}>
                <Card className="grid gap-1.5 p-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Rating sum={r.rating} count={1} showCount={false} label={`${r.rating} sur 5`} />
                    <time className="text-xs text-muted-foreground">{format.dateTime(r.createdAt, { dateStyle: "medium" })}</time>
                  </div>
                  {r.comment ? <p className="leading-relaxed">{r.comment}</p> : null}
                  <p className="text-xs text-muted-foreground">
                    {r.author.profile?.displayName ?? "Membre"} · {r.authorRole === "BUYER" ? "acheteur" : "vendeur"} · transaction vérifiée
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
      {viewer && viewer.id !== profile.userId ? (
        <div className="flex justify-end">
          <ReportDialog targetType="USER" targetId={profile.userId} signedIn label="Signaler ce membre" />
        </div>
      ) : null}
    </div>
  );
}
