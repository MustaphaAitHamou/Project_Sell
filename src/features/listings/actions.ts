"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { listingPath } from "@/lib/domain/ids";
import { requireUser } from "@/server/auth/session";
import { action } from "@/server/security/action";
import { changeListingStatusBySeller, createListingDraft, deleteListing, publishListing, updateListing } from "@/server/services/listings";
import { db } from "@/server/db/client";
import { listingInputSchema } from "./schemas";

/** Enregistrement (création ou modification) puis publication facultative. */
export const saveListingAction = action(
  z.object({ listingId: z.uuid().nullable(), version: z.number().int().nonnegative().optional(), input: listingInputSchema, publish: z.boolean() }),
  async ({ listingId, version, input, publish }) => {
    const user = await requireUser();
    let id = listingId;
    let status: string;
    if (!id) {
      const created = await createListingDraft(user, input);
      id = created.id;
      status = created.status;
    } else {
      status = (await updateListing(user, id, input, version)).status;
    }
    let keywords: string[] = [];
    if (publish && (status === "DRAFT" || status === "ARCHIVED")) {
      const r = await publishListing(user, id);
      status = r.status;
      keywords = r.keywords;
    }
    const listing = await db.listing.findUniqueOrThrow({ where: { id }, select: { slug: true, publicId: true } });
    revalidatePath("/compte/annonces");
    return { listingId: id, status, keywords, path: listingPath(listing.slug, listing.publicId) };
  },
);

export const listingStatusAction = action(z.object({ listingId: z.uuid(), op: z.enum(["publish", "archive", "reactivate", "markSold", "withdraw", "delete"]) }), async ({ listingId, op }) => {
  const user = await requireUser();
  if (op === "delete") await deleteListing(user, listingId);
  else if (op === "publish") await publishListing(user, listingId);
  else await changeListingStatusBySeller(user, listingId, op);
  revalidatePath("/compte/annonces");
  return { done: true };
});
