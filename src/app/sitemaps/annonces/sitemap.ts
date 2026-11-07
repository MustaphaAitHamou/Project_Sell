import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { listingPath } from "@/lib/domain/ids";
import { db } from "@/server/db/client";

export const revalidate = 3600;

const PER_SITEMAP = 40_000;
const WHERE = { status: "ACTIVE" as const, isDemo: false, seller: { status: "ACTIVE" as const } };

/** Annonces en ligne (hors démonstration), découpées par tranches de 40 000 URL. */
export async function generateSitemaps() {
  const count = await db.listing.count({ where: WHERE });
  return Array.from({ length: Math.max(1, Math.ceil(count / PER_SITEMAP)) }, (_, id) => ({ id }));
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id) || 0;
  const listings = await db.listing.findMany({
    where: WHERE,
    orderBy: { id: "asc" },
    skip: id * PER_SITEMAP,
    take: PER_SITEMAP,
    select: { slug: true, publicId: true, updatedAt: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { id: true } } },
  });
  return listings.map((l) => ({
    url: `${env.APP_URL}${listingPath(l.slug, l.publicId)}`,
    lastModified: l.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.6,
    images: l.images.map((img) => `${env.APP_URL}/api/images/${img.id}/large`),
  }));
}
