"use server";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { action } from "@/server/security/action";
import { toggleFavorite } from "@/server/services/favorites";

export const toggleFavoriteAction = action(z.object({ listingId: z.uuid() }), async ({ listingId }) => {
  const user = await requireUser();
  return toggleFavorite(user, listingId);
});
