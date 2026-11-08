import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { db } from "@/server/db/client";

// Calculé à la demande (aucun accès à la base pendant le build).
export const dynamic = "force-dynamic";

const STATIC_PAGES = ["", "/explorer", "/categories", "/vendre", "/comment-ca-marche", "/protection-acheteur", "/centre-aide", "/objets-interdits", "/conditions", "/confidentialite", "/mentions-legales", "/contact"];

/** Pages éditoriales, catégories et profils vendeurs ayant au moins une annonce réelle en ligne. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.APP_URL;
  const [categories, sellers] = await Promise.all([
    db.category.findMany({ where: { isActive: true, isProhibited: false }, select: { slug: true, updatedAt: true } }),
    db.userProfile.findMany({
      where: { user: { status: "ACTIVE", listings: { some: { status: "ACTIVE", isDemo: false } } } },
      select: { handle: true, updatedAt: true },
      take: 45_000,
    }),
  ]);
  return [
    ...STATIC_PAGES.map((p) => ({ url: `${base}${p}`, changeFrequency: p === "" || p === "/explorer" ? ("daily" as const) : ("monthly" as const), priority: p === "" ? 1 : 0.5 })),
    ...categories.map((c) => ({ url: `${base}/categorie/${c.slug}`, lastModified: c.updatedAt, changeFrequency: "daily" as const, priority: 0.7 })),
    ...sellers.map((s) => ({ url: `${base}/vendeur/${s.handle}`, lastModified: s.updatedAt, changeFrequency: "weekly" as const, priority: 0.4 })),
  ];
}
