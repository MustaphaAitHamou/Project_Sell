import { drainJobs } from "@/server/jobs/runner";
import { isAuthorizedCron } from "@/server/security/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Traitement de la file de tâches (à appeler chaque minute par un ordonnanceur externe). */
export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const processed = await drainJobs(200);
  return Response.json({ processed }, { headers: { "cache-control": "no-store" } });
}
export const GET = POST;
