import { execSync } from "node:child_process";
import pg from "pg";
import { loadTestEnv } from "./load-env";

/** Une fois par exécution : création de la base de test si besoin, migrations, référentiels. */
export default async function globalSetup() {
  loadTestEnv();
  const url = new URL(process.env.DATABASE_URL!);
  const dbName = url.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = "/postgres";
  admin.search = "";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (!exists.rowCount) await client.query(`CREATE DATABASE "${dbName.replace(/"/g, "")}"`);
  await client.end();
  const env = { ...process.env, SEED_DEMO: "false" };
  execSync("npx prisma migrate deploy", { stdio: "pipe", env });
  execSync("npx tsx --conditions=react-server prisma/seed.ts", { stdio: "pipe", env });
}
