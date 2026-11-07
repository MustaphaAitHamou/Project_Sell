import { apiError } from "@/server/api/http";
import { authenticateServiceClient } from "@/server/api/hq/auth";
import { logger } from "@/server/logger";
import { getHqMetrics } from "@/server/services/hq-metrics";

export const dynamic = "force-dynamic";

/** GET /api/internal/hq/v1/metrics?jours=30 — indicateurs agrégés pour Tamurt HQ (jeton de service). */
export async function GET(request: Request) {
  const auth = await authenticateServiceClient(request, "metrics:read");
  if (!auth.ok) return apiError(auth.code, auth.message, auth.status, auth.status === 401 ? { "www-authenticate": 'Bearer realm="tamurt-hq"' } : undefined);
  const days = Math.min(365, Math.max(1, Number.parseInt(new URL(request.url).searchParams.get("jours") ?? "30", 10) || 30));
  try {
    const metrics = await getHqMetrics(days);
    logger.info("hq.metrics_read", { client: auth.clientId, days });
    return Response.json(metrics, { headers: { "cache-control": "no-store", "x-api-version": "v1" } });
  } catch (e) {
    logger.error("hq.metrics_failed", { error: e });
    return apiError("INTERNAL", "Erreur interne.", 500);
  }
}
