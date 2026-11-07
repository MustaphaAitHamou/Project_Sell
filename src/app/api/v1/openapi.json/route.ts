import { env } from "@/lib/env";
import { buildPublicOpenApi } from "@/lib/openapi/build";

export const dynamic = "force-static";

/** GET /api/v1/openapi.json — spécification OpenAPI 3.1 de l'API publique. */
export function GET() {
  return Response.json(buildPublicOpenApi(env.APP_URL), { headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=3600" } });
}
