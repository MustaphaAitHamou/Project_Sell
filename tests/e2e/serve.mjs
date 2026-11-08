/**
 * Commande « webServer » de Playwright : base E2E recréée, migrations, référentiels et
 * jeu de démonstration fictif, build de production puis démarrage. Exécuté avant tout test
 * (l'ordre est ainsi garanti : la base est prête quand le serveur répond).
 */
import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { e2eEnv, PORT, ROOT } from "./env.mjs";

const env = { ...process.env, ...e2eEnv() };
const url = new URL(env.DATABASE_URL);
const dbName = url.pathname.slice(1);
if (!/e2e|test/.test(dbName)) throw new Error(`Refus : « ${dbName} » n'est pas une base de test.`);

const admin = new URL(url);
admin.pathname = "/postgres";
admin.search = "";
const client = new pg.Client({ connectionString: admin.toString() });
await client.connect();
await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
await client.query(`CREATE DATABASE "${dbName}"`);
await client.end();
rmSync(path.join(ROOT, "storage-e2e"), { recursive: true, force: true });

const run = (cmd, extra = {}) => execSync(cmd, { cwd: ROOT, stdio: "inherit", env: { ...env, ...extra } });
run("npx prisma migrate deploy");
run("npx tsx --conditions=react-server prisma/seed.ts", { SEED_DEMO: "true" });
if (process.env.E2E_SKIP_BUILD !== "true") run("npx next build", { NODE_ENV: "production" });

const server = spawn("npx", ["next", "start", "-p", String(PORT)], { cwd: ROOT, stdio: "inherit", env: { ...env, NODE_ENV: "production" } });
const stop = () => server.kill("SIGTERM");
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
server.on("exit", (code) => process.exit(code ?? 0));
