import { getCurrentUser } from "@/server/auth/session";
import { getEvidenceForViewer } from "@/server/services/disputes";
import { getObject } from "@/server/storage";

export const dynamic = "force-dynamic";

/** Preuve de litige : réservée aux parties et au personnel habilité (consultation journalisée). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || !/^[0-9a-f-]{36}$/.test(id)) return new Response(null, { status: 404 });
  const ev = await getEvidenceForViewer(user, id);
  if (!ev) return new Response(null, { status: 404 });
  const bytes = await getObject(ev.storageKey);
  if (!bytes) return new Response(null, { status: 404 });
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": ev.mimeType,
      "content-disposition": `${ev.mimeType === "application/pdf" ? "attachment" : "inline"}; filename="preuve-${ev.id.slice(0, 8)}.${ev.mimeType === "application/pdf" ? "pdf" : "webp"}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
