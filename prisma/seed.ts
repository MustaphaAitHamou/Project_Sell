/**
 * Seed Tamurt Market.
 *   pnpm db:seed                 → référentiels et configuration initiale (idempotent)
 *   SEED_DEMO=true pnpm db:seed  → + jeu de démonstration ENTIÈREMENT FICTIF
 * Exécuté avec la condition « react-server » pour réutiliser les modules serveur
 * (traitement d'images, stockage) sans dupliquer leur logique.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { seedReference } from "./seed/reference";

async function main() {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const t0 = Date.now();
    await seedReference(db);
    console.log(`✔ Référentiels et configuration (${Date.now() - t0} ms)`);
    if (process.env.SEED_DEMO === "true") {
      if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED_IN_PRODUCTION !== "true")
        throw new Error("Refus : données de démonstration en production.");
      const { seedDemo } = await import("./seed/demo");
      const r = await seedDemo(db);
      console.log(`✔ Démonstration fictive : ${r.users} comptes, ${r.listingsCreated} annonces créées`);
      const { seedDemoActivity } = await import("./seed/demo-activity");
      const a = await seedDemoActivity(db);
      console.log(`✔ Activité de démonstration : ${a.summary}`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
