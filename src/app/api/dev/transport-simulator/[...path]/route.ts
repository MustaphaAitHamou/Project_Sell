import { devToolsEnabled, env } from "@/lib/env";
import { simulatorFetch } from "@/integrations/tamurt-transport/simulator";

export const dynamic = "force-dynamic";

/**
 * Exposition HTTP du simulateur Tamurt Transport (contrat v1) pour les essais manuels
 * (curl, Postman). Indisponible en production et si le simulateur n'est pas sélectionné.
 */
async function handler(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (!devToolsEnabled || env.TRANSPORT_INTEGRATION !== "simulator") return new Response(null, { status: 404 });
  const { path } = await ctx.params;
  const url = new URL(request.url);
  const target = `https://transport-simulator.local/api/partner/v1/${path.map(encodeURIComponent).join("/")}${url.search}`;
  const body = request.method === "GET" ? undefined : await request.text();
  return simulatorFetch(new Request(target, { method: request.method, headers: request.headers, body }));
}
export { handler as GET, handler as POST };
