import "server-only";
import { env } from "@/lib/env";
import { safeEqual } from "./crypto";

/** Appels planifiés : jeton porteur CRON_SECRET (comparaison à temps constant). */
export function isAuthorizedCron(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  return token.length > 0 && safeEqual(token, env.CRON_SECRET);
}
