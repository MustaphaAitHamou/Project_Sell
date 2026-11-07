import { db } from "@/server/db/client";
import { getObject } from "@/server/storage";

/** Avatars : publics pour les comptes actifs (cache court, clé versionnée dans l'URL). */
export async function GET(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const { userId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(userId)) return new Response(null, { status: 404 });
  const p = await db.userProfile.findUnique({ where: { userId }, select: { avatarKey: true, user: { select: { status: true } } } });
  if (!p?.avatarKey || p.user.status !== "ACTIVE") return new Response(null, { status: 404 });
  const bytes = await getObject(p.avatarKey);
  if (!bytes) return new Response(null, { status: 404 });
  return new Response(Buffer.from(bytes), { headers: { "content-type": "image/webp", "cache-control": "public, max-age=3600", "x-content-type-options": "nosniff" } });
}
