import { listingSitemapCount, listingSitemapXml, xmlResponse } from "@/server/services/sitemaps";

export const dynamic = "force-dynamic";

/** /sitemaps/annonces/{n}.xml */
export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const m = (await ctx.params).file.match(/^(\d{1,4})\.xml$/);
  if (!m) return new Response(null, { status: 404 });
  const page = Number(m[1]);
  if (page >= (await listingSitemapCount())) return new Response(null, { status: 404 });
  return xmlResponse(await listingSitemapXml(page));
}
