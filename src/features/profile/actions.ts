"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { action, toActionError, type ActionResult } from "@/server/security/action";
import { invalid } from "@/server/security/errors";
import { businessInputSchema, completeOnboarding, declareBusiness, profileInputSchema, updateProfile, uploadAvatar } from "@/server/services/profiles";

export const completeOnboardingAction = action(profileInputSchema.extend({ acceptTerms: z.boolean().optional() }), async (input) => {
  const user = await requireUser({ onboarded: false });
  await completeOnboarding(user, input);
  return { done: true };
});

export const updateProfileAction = action(profileInputSchema, async (input) => {
  const user = await requireUser();
  await updateProfile(user, input);
  revalidatePath("/compte/profil");
  return { done: true };
});

export async function uploadAvatarAction(formData: FormData): Promise<ActionResult<{ done: true }>> {
  try {
    const user = await requireUser();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw invalid("Aucun fichier reçu.");
    if (file.size > 4 * 1024 * 1024) throw invalid("Image trop volumineuse (4 Mo maximum après compression).");
    await uploadAvatar(user, new Uint8Array(await file.arrayBuffer()));
    revalidatePath("/compte/profil");
    return { ok: true, data: { done: true } };
  } catch (e) {
    return toActionError(e);
  }
}

export const declareBusinessAction = action(businessInputSchema, async (input) => {
  const user = await requireUser();
  await declareBusiness(user, input);
  revalidatePath("/compte/verification");
  return { done: true };
});
