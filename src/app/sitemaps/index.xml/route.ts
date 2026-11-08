import { sitemapIndexXml, xmlResponse } from "@/server/services/sitemaps";

export const dynamic = "force-dynamic";

/** Index des sitemaps (pages + tranches d'annonces), calculé à la demande. */
export async function GET() {
  return xmlResponse(await sitemapIndexXml());
}
