import { db } from "@/server/db/client";

export const dynamic = "force-dynamic";

/** Sonde de disponibilité (sans information sensible). */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", service: "tamurt-market" }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ status: "degraded", service: "tamurt-market" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
