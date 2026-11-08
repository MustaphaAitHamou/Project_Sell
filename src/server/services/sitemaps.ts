import "server-only";
import { env } from "@/lib/env";
import { listingPath } from "@/lib/domain/ids";
import { db } from "@/server/db/client";

export const LISTINGS_PER_SITEMAP = 40_000;
const WHERE = { status: "ACTIVE" as const, isDemo: false, seller: { status: "ACTIVE" as const } };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const xmlResponse = (xml: string) => new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=0, s-maxage=3600" } });

export async function listingSitemapCount() {
  return Math.max(1, Math.ceil((await db.listing.count({ where: WHERE })) / LISTINGS_PER_SITEMAP));
}

export async function sitemapIndexXml() {
  const n = await listingSitemapCount();
  const urls = [`${env.APP_URL}/sitemap.xml`, ...Array.from({ length: n }, (_, i) => `${env.APP_URL}/sitemaps/annonces/${i}.xml`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <sitemap><loc>${esc(u)}</loc></sitemap>`).join("\n")}\n</sitemapindex>\n`;
}

/** Annonces en ligne (hors démonstration), par tranches de 40 000 URL, avec leur photo principale. */
export async function listingSitemapXml(page: number) {
  const listings = await db.listing.findMany({
    where: WHERE,
    orderBy: { id: "asc" },
    skip: page * LISTINGS_PER_SITEMAP,
    take: LISTINGS_PER_SITEMAP,
    select: { slug: true, publicId: true, updatedAt: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { id: true } } },
  });
  const body = listings
    .map((l) => {
      const img = l.images[0] ? `<image:image><image:loc>${esc(`${env.APP_URL}/api/images/${l.images[0].id}/large`)}</image:loc></image:image>` : "";
      return `  <url><loc>${esc(`${env.APP_URL}${listingPath(l.slug, l.publicId)}`)}</loc><lastmod>${l.updatedAt.toISOString()}</lastmod>${img}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${body}\n</urlset>\n`;
}
