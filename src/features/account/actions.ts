"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { action } from "@/server/security/action";
import { deleteOwnAccount, setEmailPreference } from "@/server/services/account-settings";
import { enablePayoutAccount } from "@/server/services/payments";

export const enablePayoutsAction = action(z.object({}), async () => {
  const user = await requireUser();
  await enablePayoutAccount(user);
  revalidatePath("/compte/paiements");
  return { done: true };
});

export const emailPreferenceAction = action(z.object({ category: z.string().max(32), enabled: z.boolean() }), async ({ category, enabled }) => {
  const user = await requireUser();
  await setEmailPreference(user, category, enabled);
  return { done: true };
});

export const contactAction = action(
  z.object({ firstName: z.string().trim().max(80).optional(), lastName: z.string().trim().max(80).optional(), phone: z.string().trim().max(32).regex(/^[+0-9 ().-]*$/, "Numéro invalide.").optional() }),
  async (input) => {
    const user = await requireUser();
    await db.userContact.upsert({ where: { userId: user.id }, create: { userId: user.id, ...input, phone: input.phone || null }, update: { ...input, phone: input.phone || null, phoneVerifiedAt: null } });
    revalidatePath("/compte/coordonnees");
    return { done: true };
  },
);

export const deleteAccountAction = action(z.object({ confirm: z.literal("SUPPRIMER") }), async () => {
  const user = await requireUser();
  await deleteOwnAccount(user);
  return { done: true };
});
