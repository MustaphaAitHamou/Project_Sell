import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
  // `prisma generate` (lancé à l'installation) n'a pas besoin de base : l'URL n'est exigée
  // que par les commandes qui s'y connectent (migrate, seed, studio), qui échouent clairement sans elle.
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://non-configure@localhost:5432/definir-DATABASE_URL-dans-.env",
  },
});
