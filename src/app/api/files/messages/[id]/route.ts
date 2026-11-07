import { getCurrentUser } from "@/server/auth/session";
import { getAttachmentForViewer } from "@/server/services/messaging";
import { getObject } from "@/server/storage";

export const dynamic = "force-dynamic";

/** Pièce jointe de messagerie : réservée aux participants de la conversation. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || !/^[0-9a-f-]{36}$/.test(id)) return new Response(null, { status: 404 });
  const attachment = await getAttachmentForViewer(id, user);
  if (!attachment) return new Response(null, { status: 404 });
  const bytes = await getObject(attachment.storageKey);
  if (!bytes) return new Response(null, { status: 404 });
  return new Response(Buffer.from(bytes), { headers: { "content-type": attachment.mimeType, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox" } });
}
