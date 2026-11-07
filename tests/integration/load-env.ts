/**
 * Environnement des tests d'intégration : base PostgreSQL DÉDIÉE (jamais celle du
 * développement), prestataires simulés, aucun envoi réel. Chargé avant tout module
 * applicatif (src/lib/env.ts lit process.env à l'import).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function loadTestEnv() {
  const root = path.resolve(import.meta.dirname, "../..");
  const file = [".env.test", ".env.test.example"].map((f) => path.join(root, f)).find((f) => existsSync(f));
  if (!file) throw new Error(".env.test(.example) introuvable");
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !line.trim().startsWith("#")) process.env[m[1]!] = m[2]!;
  }
  if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  const dbName = new URL(process.env.DATABASE_URL!).pathname.slice(1);
  if (!/test/.test(dbName)) throw new Error(`Refus : la base « ${dbName} » ne semble pas être une base de test.`);
  process.env.RATE_LIMIT_RELAXED = "true";
  process.env.EMAIL_PROVIDER = "outbox";
  process.env.PAYMENT_PROVIDER = "sandbox";
  process.env.TRANSPORT_INTEGRATION = "simulator";
  process.env.LOG_LEVEL = process.env.LOG_LEVEL_TEST ?? "error";
}

loadTestEnv();
