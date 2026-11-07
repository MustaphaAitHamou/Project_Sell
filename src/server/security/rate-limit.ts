import "server-only";
import { db } from "@/server/db/client";
import { rateLimited } from "./errors";

/** Assouplissement réservé aux tests automatisés : jamais effectif en production réelle. */
const relaxed = () =>
  process.env.RATE_LIMIT_RELAXED === "true" && (process.env.NODE_ENV !== "production" || process.env.E2E_TEST_MODE === "true");

/**
 * Limiteur à fenêtre fixe stocké dans PostgreSQL : cohérent entre instances, sans
 * dépendance supplémentaire (Redis à envisager au-delà de quelques centaines de req/s).
 * Retourne vrai si la requête est acceptée.
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const effectiveLimit = relaxed() ? limit * 50 : limit;
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "rate_limit_bucket" ("key", "windowStart", "count") VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "rate_limit_bucket"."count" + 1
    RETURNING "count"`;
  return (rows[0]?.count ?? 0) <= effectiveLimit;
}

/** Variante qui lève une erreur métier RATE_LIMITED. */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  if (!(await checkRateLimit(key, limit, windowSeconds))) throw rateLimited();
}

export async function purgeRateLimitBuckets(olderThanHours = 24) {
  await db.rateLimitBucket.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - olderThanHours * 3600_000) } } });
}
