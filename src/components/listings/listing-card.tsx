import { BadgeCheck, ImageOff, MapPin, Store } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";
import { listingPath } from "@/lib/domain/ids";
import { imageUrl } from "@/lib/utils";
import type { ListingCardData } from "@/server/services/listings";
import { FavoriteButton } from "./favorite-button";
import { Price } from "./price";

export async function ListingCard({
  listing,
  favorited = false,
  signedIn = false,
  priority = false,
}: {
  listing: ListingCardData;
  favorited?: boolean;
  signedIn?: boolean;
  priority?: boolean;
}) {
  const [t, format] = await Promise.all([getTranslations(), getFormatter()]);
  const image = listing.images[0];
  const place = listing.city?.name ?? listing.locality ?? listing.region.name;
  const profile = listing.seller.profile;
  const unavailable = listing.status === "SOLD" || listing.status === "RESERVED";
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-lift)]">
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        {image ? (
          <img
            src={imageUrl(image.id, "thumb")}
            alt=""
            width={image.width}
            height={image.height}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            style={image.blurDataUrl ? { backgroundImage: `url(${image.blurDataUrl})`, backgroundSize: "cover" } : undefined}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <ImageOff className="size-8" aria-hidden />
            <span className="sr-only">{t("listing.noPhoto")}</span>
          </div>
        )}
        <div className="absolute start-2 top-2 flex flex-wrap gap-1">
          {listing.isDemo ? (
            <Badge tone="warning" title={t("common.demoTitle")}>
              {t("common.demo")}
            </Badge>
          ) : null}
          {unavailable ? <Badge tone="neutral">{listing.status === "SOLD" ? t("listing.sold") : t("listing.reserved")}</Badge> : null}
        </div>
        {!unavailable ? (
          <div className="absolute end-2 top-2 z-10">
            <FavoriteButton listingId={listing.id} initial={favorited} signedIn={signedIn} />
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <Price amount={listing.priceAmount} currency={listing.currency} className="text-base" />
        <h3 className="line-clamp-2 text-sm leading-snug font-medium">
          <Link href={listingPath(listing.slug, listing.publicId)} className="after:absolute after:inset-0 focus-visible:outline-none">
            {listing.title}
          </Link>
        </h3>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {[listing.condition ? t(`conditions.${listing.condition}`) : null, listing.brandName].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1.5 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{place}</span>
          </span>
          {listing.publishedAt ? <time dateTime={listing.publishedAt.toISOString()} className="shrink-0">{format.relativeTime(listing.publishedAt)}</time> : null}
        </div>
        {profile?.sellerType === "BUSINESS" || profile?.identityVerified ? (
          <div className="flex flex-wrap gap-1 pt-1">
            {profile.sellerType === "BUSINESS" ? (
              <Badge tone="info">
                <Store aria-hidden /> {t("listing.proSeller")}
              </Badge>
            ) : null}
            {profile.identityVerified ? (
              <Badge tone="success">
                <BadgeCheck aria-hidden /> {t("listing.verifiedSeller")}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function ListingGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5 ${className ?? ""}`}>{children}</div>;
}

export function ListingGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <ListingGrid>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="skeleton aspect-[4/5] rounded-none" />
          <div className="grid gap-2 p-3">
            <div className="skeleton h-4 w-1/3" />
            <div className="skeleton h-3 w-4/5" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        </div>
      ))}
    </ListingGrid>
  );
}
