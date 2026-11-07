import { z } from "zod";
import { preflight, publicGet } from "@/server/api/http";
import { categorySchema } from "@/server/api/v1/schemas";
import { getAllCategories } from "@/server/services/catalog";

export const dynamic = "force-dynamic";

/** GET /api/v1/categories — catégories publiques (actives, non interdites), à plat. */
export const GET = publicGet(async () => {
  const all = await getAllCategories();
  const bySlug = new Map(all.map((c) => [c.id, c.slug]));
  const visible = all.filter((c) => c.isActive && !c.isProhibited).sort((a, b) => a.depth - b.depth || a.sortOrder - b.sortOrder);
  return {
    items: z.array(categorySchema).parse(
      visible.map((c) => ({ slug: c.slug, name: c.name, parentSlug: c.parentId ? (bySlug.get(c.parentId) ?? null) : null, transactional: c.isTransactional, reviewedBeforePublication: c.requiresReview })),
    ),
  };
}, { cacheSeconds: 600 });

export const OPTIONS = preflight;
