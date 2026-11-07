"use server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { action } from "@/server/security/action";
import { invalid } from "@/server/security/errors";
import { isEnabled } from "@/server/settings";

/** Recherche sauvegardée : filtres normalisés (chaîne de requête), sans doublon par utilisateur. */
export const saveSearchAction = action(z.object({ query: z.string().max(1000), name: z.string().trim().min(2).max(80) }), async ({ query, name }) => {
  const user = await requireUser();
  if (!(await isEnabled("savedSearches.enabled"))) throw invalid("Fonction désactivée.");
  const params = new URLSearchParams(query);
  params.delete("page");
  params.sort();
  const normalized = params.toString();
  const count = await db.savedSearch.count({ where: { userId: user.id } });
  if (count >= 30) throw invalid("30 recherches sauvegardées maximum.");
  const queryHash = createHash("sha256").update(normalized).digest("hex");
  await db.savedSearch.upsert({
    where: { userId_queryHash: { userId: user.id, queryHash } },
    create: { userId: user.id, name, query: Object.fromEntries(params), queryHash },
    update: { name },
  });
  return { saved: true };
});

export const deleteSavedSearchAction = action(z.object({ id: z.uuid() }), async ({ id }) => {
  const user = await requireUser();
  await db.savedSearch.deleteMany({ where: { id, userId: user.id } });
  return { deleted: true };
});
