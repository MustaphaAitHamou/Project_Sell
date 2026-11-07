"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { action, toActionError, type ActionResult } from "@/server/security/action";
import { invalid } from "@/server/security/errors";
import { sendMessage, setBlock, startConversation } from "@/server/services/messaging";

const bodySchema = z.string().trim().min(1, "Écrivez un message.").max(2000, "2 000 caractères maximum.");

export const startConversationAction = action(z.object({ listingId: z.uuid(), body: bodySchema }), async ({ listingId, body }) => {
  const user = await requireUser();
  const c = await startConversation(user, listingId, body);
  return { conversationId: c.id };
});

/** Envoi avec photo facultative (FormData) : l'image est ré-encodée côté serveur. */
export async function sendMessageAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    const conversationId = z.uuid().parse(formData.get("conversationId"));
    const body = String(formData.get("body") ?? "").slice(0, 2100);
    const file = formData.get("image");
    let image: Uint8Array | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > 4 * 1024 * 1024) throw invalid("Image trop volumineuse (4 Mo maximum après compression).");
      image = new Uint8Array(await file.arrayBuffer());
    }
    if (!body.trim() && !image) throw invalid("Le message est vide.");
    const m = await sendMessage(user, conversationId, body, image);
    revalidatePath(`/compte/messages/${conversationId}`);
    return { ok: true, data: { id: m.id } };
  } catch (e) {
    return toActionError(e);
  }
}

export const setBlockAction = action(z.object({ userId: z.string().min(1).max(64), blocked: z.boolean(), conversationId: z.uuid().optional() }), async ({ userId, blocked, conversationId }) => {
  const user = await requireUser();
  await setBlock(user, userId, blocked);
  if (conversationId) revalidatePath(`/compte/messages/${conversationId}`);
  return { blocked };
});
