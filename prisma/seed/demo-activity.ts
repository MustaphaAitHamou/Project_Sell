import type { PrismaClient } from "@/generated/prisma/client";

/** Activité de démonstration (conversations, commandes simulées) : complétée une fois les services disponibles. */
export async function seedDemoActivity(_db: PrismaClient) {
  return { summary: "aucune (à venir)" };
}
