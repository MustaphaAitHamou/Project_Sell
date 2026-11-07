import "server-only";
import { env } from "@/lib/env";
import { listingPath } from "@/lib/domain/ids";
import { formatMoney } from "@/lib/domain/money";
import type { ListingCardData } from "@/server/services/listings";

export const abs = (path: string) => `${env.APP_URL}${path}`;
export const money = (amount: number, currency: string) => ({ amount, currency, formatted: formatMoney(amount, currency) });

export function toCard(l: ListingCardData) {
  return {
    id: l.publicId,
    title: l.title,
    price: money(l.priceAmount, l.currency),
    condition: l.condition,
    brand: l.brandName,
    country: l.countryCode,
    location: l.city?.name ?? l.locality ?? l.region?.name ?? null,
    deliveryMethods: l.deliveryMethods,
    status: l.status,
    image: l.images[0] ? abs(`/api/images/${l.images[0].id}/thumb`) : null,
    publishedAt: l.publishedAt?.toISOString() ?? null,
    isDemo: l.isDemo,
    url: abs(listingPath(l.slug, l.publicId)),
  };
}

export function ratingOf(sum: number, count: number) {
  return { average: count ? Math.round((sum / count) * 10) / 10 : null, count };
}
