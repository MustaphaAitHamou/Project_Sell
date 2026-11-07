import type { MetadataRoute } from "next";
import { env, isProduction, usesSimulators } from "@/lib/env";

/**
 * Hors production réelle (simulateurs, démonstration, préproduction), rien n'est indexable.
 * En production : pages privées, transactionnelles et API exclues ; sitemaps déclarés.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isProduction || usesSimulators) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/compte", "/admin", "/api/", "/commande/", "/commander/", "/vendre/", "/onboarding", "/connexion", "/inscription", "/recherche", "/dev/", "/*?*page="],
      },
    ],
    sitemap: [`${env.APP_URL}/sitemap.xml`, `${env.APP_URL}/sitemaps/annonces/sitemap/0.xml`],
    host: env.APP_URL,
  };
}
