import { isAuthorizedCron } from "@/server/security/cron";
import { runMaintenance } from "@/server/services/maintenance";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Maintenance périodique : expirations, clôtures, compensations, relances, purges. */
export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const report = await runMaintenance();
  return Response.json(report, { headers: { "cache-control": "no-store" } });
}
export const GET = POST;
