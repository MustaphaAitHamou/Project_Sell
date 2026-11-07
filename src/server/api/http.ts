import "server-only";
import { logger } from "@/server/logger";
import { AppError } from "@/server/security/errors";
import { hashIp } from "@/server/security/crypto";
import { checkRateLimit } from "@/server/security/rate-limit";
import { ipFromRequest } from "@/server/security/request";

/** Format d'erreur unique des API : { error: { code, message } } (aucun détail interne). */
export function apiError(code: string, message: string, status = 500, headers?: HeadersInit) {
  return Response.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store", ...headers } });
}

const PUBLIC_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "x-content-type-options": "nosniff",
  "x-api-version": "v1",
};

/**
 * Enveloppe des routes publiques en lecture : limitation par adresse IP (empreinte), CORS
 * ouvert en lecture seule (aucun cookie lu : les réponses ne dépendent jamais de la
 * session), cache partagé court, traduction des erreurs métier.
 */
export function publicGet<P>(handler: (request: Request, params: P) => Promise<unknown>, opts: { limit?: number; cacheSeconds?: number } = {}) {
  return async (request: Request, ctx: { params: Promise<P> }) => {
    const ip = hashIp(ipFromRequest(request));
    if (!(await checkRateLimit(`api.v1:${ip}`, opts.limit ?? 120, 60))) return apiError("RATE_LIMITED", "Trop de requêtes. Réessayez dans une minute.", 429, { ...PUBLIC_HEADERS, "retry-after": "60" });
    try {
      const data = await handler(request, await ctx.params);
      return Response.json(data, { headers: { ...PUBLIC_HEADERS, "cache-control": `public, max-age=0, s-maxage=${opts.cacheSeconds ?? 60}, stale-while-revalidate=300` } });
    } catch (e) {
      if (e instanceof AppError) return apiError(e.code, e.message, e.httpStatus, PUBLIC_HEADERS);
      logger.error("api.v1.unexpected", { error: e, path: new URL(request.url).pathname });
      return apiError("INTERNAL", "Erreur interne.", 500, PUBLIC_HEADERS);
    }
  };
}

export function preflight() {
  return new Response(null, { status: 204, headers: { ...PUBLIC_HEADERS, "access-control-max-age": "86400" } });
}
