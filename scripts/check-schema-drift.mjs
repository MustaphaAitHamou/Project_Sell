/**
 * Vérifie que la base migrée (DATABASE_URL) correspond au schéma Prisma. Les objets SQL
 * écrits à la main dans les migrations et non représentables par Prisma (index GIN et
 * trigrammes, index d'unicité NULLS NOT DISTINCT, vecteur plein texte) sont attendus.
 *   pnpm db:drift
 */
import { execSync } from "node:child_process";

const EXPECTED = new Set(["brand_name_trgm_idx", "compliance_rule_unique_combination", "listing_attributes_gin", "listing_search_vector_idx"]);
const script = execSync("npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script", { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
const statements = script
  .split("\n")
  .filter((l) => l.trim() && !l.startsWith("--"))
  .filter((l) => {
    const m = l.match(/^DROP INDEX "([^"]+)";$/);
    return !(m && EXPECTED.has(m[1]));
  });
if (statements.length) {
  console.error("Écart entre la base migrée et prisma/schema.prisma :\n" + statements.join("\n"));
  console.error("Créez une migration (pnpm db:migrate --create-only) ou mettez le schéma à jour.");
  process.exit(1);
}
console.log("✔ Schéma Prisma et migrations cohérents (hors objets SQL manuels attendus).");
