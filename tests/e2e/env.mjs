/**
 * Environnement E2E : build de production servi localement sur le port 3100, base
 * PostgreSQL dédiée (tamurt_market_e2e, recréée à chaque exécution), prestataires simulés
 * (E2E_TEST_MODE autorise les simulateurs dans un build de production), aucun envoi réel.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "../..");
export const PORT = Number(process.env.E2E_PORT ?? 3100);
export const BASE_URL = `http://localhost:${PORT}`;

export function e2eEnv() {
  const env = {};
  const file = [".env.test", ".env.test.example"].map((f) => path.join(ROOT, f)).find((f) => existsSync(f));
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !line.trim().startsWith("#")) env[m[1]] = m[2];
  }
  const db = new URL(process.env.E2E_DATABASE_URL ?? env.DATABASE_URL);
  if (!process.env.E2E_DATABASE_URL) db.pathname = "/tamurt_market_e2e";
  return {
    ...env,
    DATABASE_URL: db.toString(),
    APP_URL: BASE_URL,
    BETTER_AUTH_URL: BASE_URL,
    E2E_TEST_MODE: "true",
    ADMIN_REQUIRE_2FA: "false",
    RATE_LIMIT_RELAXED: "true",
    EMAIL_PROVIDER: "outbox",
    PAYMENT_PROVIDER: "sandbox",
    SHIPPING_PROVIDER: "sandbox",
    TRANSPORT_INTEGRATION: "simulator",
    STORAGE_DRIVER: "local",
    STORAGE_LOCAL_DIR: "./storage-e2e",
    NEXT_DIST_DIR: ".next-e2e",
    NEXT_TELEMETRY_DISABLED: "1",
    LOG_LEVEL: "warn",
  };
}
