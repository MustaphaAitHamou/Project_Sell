import { AlertTriangle, Clock, Eye, Heart, MapPin, PencilLine, ShieldCheck, Truck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ContactSellerButton } from "@/components/listings/contact-seller";
import { FavoriteButton } from "@/components/listings/favorite-button";
import { Gallery } from "@/components/listings/gallery";
import { JsonLd } from "@/components/listings/json-ld";
import { ListingCard, ListingGrid } from "@/components/listings/listing-card";
import { Price } from "@/components/listings/price";
import { ReportDialog } from "@/components/listings/report-dialog";
import { SellerCard } from "@/components/listings/seller-card";
import { TransportQuotePanel } from "@/components/listings/transport-quote-panel";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { buttonVariants } from "@/components/ui/button";
import { Alert, Badge, Card } from "@/components/ui/misc";
import { Link, permanentRedirect } from "@/i18n/navigation";
import { listingPath, parseListingSegment } from "@/lib/domain/ids";
import { formatMoney } from "@/lib/domain/money";
import { computeOrderPricing } from "@/lib/domain/pricing";
import { env } from "@/lib/env";
import { cn, imageUrl } from "@/lib/utils";
import { getCurrentUser } from "@/server/auth/session";
import { getCategoryAncestry, getCategoryAttributes } from "@/server/services/catalog";
import { BLOCK_REASON_LABELS, getPurchaseEligibility } from "@/server/services/eligibility";
import { getFavoriteIds } from "@/server/services/favorites";
import { getActiveBuyerFeeRule } from "@/server/services/fees";
import { getListingByPublicId, getSellerPublicListings, getSimilarListings, recordListingView } from "@/server/services/listings";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseListingSegment(slug);
  if (!parsed) return {};
  const result = await getListingByPublicId(parsed.publicId, null);
  if (!result) return { title: "Annonce introuvable", robots: { index: false } };
  const { listing } = result;
  const description = `${formatMoney(listing.priceAmount, listing.currency)} · ${listing.description.slice(0, 150)}`;
  const image = listing.images[0];
  return {
    title: listing.title,
    description,
    alternates: { canonical: listingPath(listing.slug, listing.publicId) },
    robots: listing.isDemo || listing.status !== "ACTIVE" ? { index: false, follow: true } : undefined,
    openGraph: { title: listing.title, description, type: "website", images: image ? [{ url: imageUrl(image.id, "large"), width: image.width, height: image.height }] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug, locale } = await params;
  const parsed = parseListingSegment(slug);
  if (!parsed) notFound();
  const user = await getCurrentUser();
  const result = await getListingByPublicId(parsed.publicId, user);
  if (!result) notFound();
  const { listing, isOwner } = result;
  if (parsed.slug !== listing.slug) permanentRedirect({ href: listingPath(listing.slug, listing.publicId), locale: locale as "fr" });

  const [t, format, ancestry, attrDefs, feeRule] = await Promise.all([
    getTranslations(),
    getFormatter(),
    getCategoryAncestry(listing.categoryId),
    getCategoryAttributes(listing.categoryId),
    getActiveBuyerFeeRule(listing.currency),
  ]);
  if (!isOwner) await recordListingView(listing.id, user?.id ?? null);

  const eligibility = await getPurchaseEligibility(
    { ...listing, sellerStatus: listing.seller.status },
    user ? { id: user.id, countryCode: user.profile?.countryCode ?? null } : null,
  );
  const [similar, others, favs] = await Promise.all([
    getSimilarListings(listing, 5),
    getSellerPublicListings(listing.sellerId, { excludeId: listing.id, limit: 5 }),
    user ? getFavoriteIds(user.id, [listing.id]) : Promise.resolve(new Set<string>()),
  ]);
  const similarFavs = user ? await getFavoriteIds(user.id, [...similar, ...others.items].map((l) => l.id)) : new Set<string>();
  const preview = computeOrderPricing({ currency: listing.currency, unitPrice: listing.priceAmount, quantity: 1, buyerFeeRule: feeRule, shipping: null });
  const attributes = attrDefs
    .map((d) => {
      const v = (listing.attributes as Record<string, unknown>)[d.key];
      if (v === undefined || v === null || v === "") return null;
      const value = typeof v === "boolean" ? (v ? t("common.yes") : t("common.no")) : `${v}${d.unit ? ` ${d.unit}` : ""}`;
      return { label: d.label, value };
    })
    .filter(Boolean) as { label: string; value: string }[];
  const place = [listing.city?.name ?? listing.locality, listing.region.name, listing.country.name].filter(Boolean).join(", ");
  const unavailable = listing.status !== "ACTIVE";
  const transportOffered = listing.deliveryMethods.includes("TAMURT_TRANSPORT");
  const canBuy = eligibility.purchasable && !isOwner;

  return (
    <div className="container-page grid gap-8 py-6 md:py-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: listing.title,
          description: listing.description.slice(0, 500),
          image: listing.images.map((i) => new URL(imageUrl(i.id, "large"), env.APP_URL).toString()),
          category: listing.category.name,
          ...(listing.brandName ? { brand: { "@type": "Brand", name: listing.brandName } } : {}),
          offers: {
            "@type": "Offer",
            price: (listing.priceAmount / 100).toFixed(2),
            priceCurrency: listing.currency,
            availability: listing.status === "ACTIVE" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
            itemCondition: listing.condition?.startsWith("NEW") ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
            url: new URL(listingPath(listing.slug, listing.publicId), env.APP_URL).toString(),
          },
        }}
      />
      <Breadcrumb
        items={[
          { href: "/", label: t("nav.home") },
          ...[...ancestry].reverse().map((c) => ({ href: `/categorie/${c.slug}`, label: c.name })),
          { label: listing.title },
        ]}
      />

      {isOwner ? (
        <Alert tone={listing.status === "ACTIVE" ? "info" : "warning"} title={`${t("listing.yourListing")} — ${t(`listingStatus.${listing.status}`)}`}>
          {listing.moderationNote ? <p>{listing.moderationNote}</p> : null}
          <Link href={`/vendre/${listing.id}/modifier`} className="mt-1 inline-flex items-center gap-1">
            <PencilLine className="size-4" aria-hidden /> {t("listing.manage")}
          </Link>
        </Alert>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)]">
        <div className="grid content-start gap-8">
          <Gallery images={listing.images} title={listing.title} />

          <section className="grid gap-3" aria-labelledby="desc">
            <h2 id="desc" className="text-lg font-bold">
              {t("listing.description")}
            </h2>
            <p className="leading-relaxed whitespace-pre-line text-foreground/90">{listing.description}</p>
          </section>

          <section className="grid gap-3" aria-labelledby="details">
            <h2 id="details" className="text-lg font-bold">
              {t("listing.details")}
            </h2>
            <dl className="grid grid-cols-1 overflow-hidden rounded-xl border border-border sm:grid-cols-2">
              {[
                { label: t("listing.category"), value: listing.category.name },
                ...(listing.condition ? [{ label: t("listing.condition"), value: t(`conditions.${listing.condition}`) }] : []),
                ...(listing.brandName ? [{ label: t("listing.brand"), value: listing.brandName }] : []),
                ...attributes,
                ...(listing.quantity > 1 ? [{ label: "Quantité", value: t("listing.quantityAvailable", { count: listing.quantityAvailable }) }] : []),
              ].map((row) => (
                <div key={row.label} className="flex justify-between gap-4 border-b border-border bg-card px-4 py-3 text-sm sm:odd:border-e">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="text-end font-medium">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="grid gap-3" aria-labelledby="delivery">
            <h2 id="delivery" className="text-lg font-bold">
              {t("listing.delivery")}
            </h2>
            <ul className="grid gap-2">
              {eligibility.methods
                .filter((m) => listing.deliveryMethods.includes(m.method))
                .map((m) => (
                  <li key={m.method} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 text-sm">
                    <Truck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <div className="grid gap-0.5">
                      <p className="font-semibold">
                        {t(`delivery.${m.method}`)}
                        {m.method === "TAMURT_TRANSPORT" ? (
                          <Badge tone="warning" className="ms-2">
                            {t("common.comingSoon")}
                          </Badge>
                        ) : null}
                      </p>
                      <p className="text-muted-foreground">{t(`delivery.${m.method}_hint`)}</p>
                    </div>
                  </li>
                ))}
            </ul>
            {transportOffered || listing.acceptsCrossBorder ? (
              <TransportQuotePanel listingId={listing.id} originCountry={listing.countryCode} signedIn={!!user} />
            ) : null}
          </section>
        </div>

        <aside className="grid content-start gap-4 lg:sticky lg:top-36">
          <Card className="grid gap-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              {listing.isDemo ? (
                <Badge tone="warning" title={t("common.demoTitle")}>
                  {t("common.demo")} · {t("common.demoTitle")}
                </Badge>
              ) : null}
              {unavailable ? <Badge tone="neutral">{t(`listingStatus.${listing.status}`)}</Badge> : null}
            </div>
            <h1 className="text-xl leading-snug font-bold sm:text-2xl">{listing.title}</h1>
            <Price amount={listing.priceAmount} currency={listing.currency} className="text-3xl" />
            {listing.condition ? <p className="text-sm text-muted-foreground">{t(`conditions.${listing.condition}`)}</p> : null}
            <ul className="grid gap-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0" aria-hidden /> {place}
              </li>
              {listing.publishedAt ? (
                <li className="flex items-center gap-2">
                  <Clock className="size-4 shrink-0" aria-hidden /> {t("listing.published", { date: format.relativeTime(listing.publishedAt) })}
                </li>
              ) : null}
              <li className="flex items-center gap-4">
                <span className="flex items-center gap-2">
                  <Eye className="size-4" aria-hidden /> {t("listing.views", { count: listing.viewCount })}
                </span>
                <span className="flex items-center gap-2">
                  <Heart className="size-4" aria-hidden /> {t("listing.favorites", { count: listing.favoriteCount })}
                </span>
              </li>
            </ul>

            {canBuy ? (
              <div className="grid gap-3 rounded-xl bg-subtle p-3 text-sm">
                <div className="flex justify-between">
                  <span>{t("pricing.items")}</span>
                  <span className="tabular-nums">{formatMoney(preview.itemsSubtotal, listing.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t("pricing.buyerFee", { rate: `${preview.buyerFeeRateBps / 100} %` })}</span>
                  <span className="tabular-nums">{formatMoney(preview.buyerFee, listing.currency)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 font-semibold">
                  <span>Sous-total (hors livraison)</span>
                  <span className="tabular-nums">{formatMoney(preview.totalAmount, listing.currency)}</span>
                </div>
              </div>
            ) : null}

            <div className="grid gap-2">
              {!isOwner && !unavailable ? (
                canBuy ? (
                  <Link href={`/commander/${listing.id}`} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
                    {t("listing.buy")}
                  </Link>
                ) : null
              ) : null}
              {!isOwner && !unavailable ? <ContactSellerButton listingId={listing.id} signedIn={!!user} variant={canBuy ? "outline" : "primary"} className="w-full" /> : null}
              {!isOwner && !unavailable ? <FavoriteButton listingId={listing.id} initial={favs.has(listing.id)} signedIn={!!user} variant="button" className="w-full justify-center" /> : null}
              {unavailable && !isOwner ? <p className="text-sm text-muted-foreground">{t("listing.unavailable")}</p> : null}
            </div>

            {!isOwner && !unavailable ? (
              canBuy ? (
                <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary-soft/50 p-3 text-sm">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  <div>
                    <p className="font-semibold">{t("listing.protectionTitle")}</p>
                    <p className="text-muted-foreground">{t("listing.protectionText")}</p>
                    {eligibility.paymentProvider === "sandbox" ? <p className="mt-1 text-xs font-medium text-warning-soft-foreground">Paiement simulé : aucun débit réel dans cet environnement.</p> : null}
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning-soft/60 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
                  <div className="grid gap-1">
                    <p className="font-semibold">{t("listing.classifiedTitle")}</p>
                    <p className="text-muted-foreground">{t("listing.classifiedText")}</p>
                    <ul className="list-disc ps-4 text-xs text-muted-foreground">
                      {eligibility.reasons
                        .filter((r) => r !== "NOT_AVAILABLE")
                        .map((r) => (
                          <li key={r}>{BLOCK_REASON_LABELS[r]}</li>
                        ))}
                    </ul>
                  </div>
                </div>
              )
            ) : null}
          </Card>

          <SellerCard seller={listing.seller} />
          <div className="flex justify-end">{!isOwner ? <ReportDialog targetType="LISTING" targetId={listing.id} signedIn={!!user} label={t("listing.reportListing")} /> : null}</div>
        </aside>
      </div>

      {others.items.length > 0 ? (
        <section className="grid gap-4" aria-labelledby="others">
          <h2 id="others" className="text-lg font-bold">
            {t("listing.fromSeller")}
          </h2>
          <ListingGrid>
            {others.items.map((l) => (
              <ListingCard key={l.id} listing={l} favorited={similarFavs.has(l.id)} signedIn={!!user} />
            ))}
          </ListingGrid>
        </section>
      ) : null}
      {similar.length > 0 ? (
        <section className="grid gap-4" aria-labelledby="similar">
          <h2 id="similar" className="text-lg font-bold">
            {t("listing.similar")}
          </h2>
          <ListingGrid>
            {similar.map((l) => (
              <ListingCard key={l.id} listing={l} favorited={similarFavs.has(l.id)} signedIn={!!user} />
            ))}
          </ListingGrid>
        </section>
      ) : null}
    </div>
  );
}
