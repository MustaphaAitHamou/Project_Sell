"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { action, toActionError, type ActionResult } from "@/server/security/action";
import { invalid } from "@/server/security/errors";
import { addressInputSchema, deleteAddress, saveAddress } from "@/server/services/addresses";
import { addDisputeEvidence, addDisputeMessage, openDispute, withdrawDispute } from "@/server/services/disputes";
import { cancelUnpaidOrderByBuyer, createOrder, retryPayment } from "@/server/services/orders/checkout";
import { cancelPaidOrderBySeller, confirmHandover, confirmReceipt, createShipmentLabel } from "@/server/services/orders/fulfillment";
import { createReview } from "@/server/services/reviews";

const orderId = z.object({ orderId: z.uuid() });

/** Création de commande : AUCUN montant n'est accepté du navigateur. */
export const createOrderAction = action(
  z.object({
    listingId: z.uuid(),
    deliveryMethod: z.enum(["HAND_DELIVERY", "NATIONAL_SHIPPING", "TAMURT_TRANSPORT"]),
    addressId: z.uuid().nullable().optional(),
    transportQuoteId: z.uuid().nullable().optional(),
    idempotencyKey: z.uuid(),
  }),
  async (input) => {
    const user = await requireUser();
    return createOrder(user, input);
  },
);

export const retryPaymentAction = action(orderId, async ({ orderId }) => {
  const user = await requireUser();
  return { redirectUrl: await retryPayment(user, orderId) };
});

export const cancelUnpaidOrderAction = action(orderId, async ({ orderId }) => {
  const user = await requireUser();
  await cancelUnpaidOrderByBuyer(user, orderId);
  revalidatePath(`/commande/${orderId}`);
  return { done: true };
});

export const confirmHandoverAction = action(z.object({ orderId: z.uuid(), code: z.string().trim().regex(/^\d{6}$/, "Code à 6 chiffres.") }), async ({ orderId, code }) => {
  const user = await requireUser();
  await confirmHandover(user, orderId, code);
  revalidatePath(`/commande/${orderId}`);
  return { done: true };
});

export const createLabelAction = action(orderId, async ({ orderId }) => {
  const user = await requireUser();
  const shipment = await createShipmentLabel(user, orderId);
  revalidatePath(`/commande/${orderId}`);
  return { trackingNumber: shipment.trackingNumber };
});

export const confirmReceiptAction = action(orderId, async ({ orderId }) => {
  const user = await requireUser();
  await confirmReceipt(user, orderId);
  revalidatePath(`/commande/${orderId}`);
  return { done: true };
});

export const sellerCancelAction = action(z.object({ orderId: z.uuid(), reason: z.string().trim().min(5).max(500), relist: z.boolean() }), async ({ orderId, reason, relist }) => {
  const user = await requireUser();
  await cancelPaidOrderBySeller(user, orderId, reason, relist);
  revalidatePath(`/commande/${orderId}`);
  return { done: true };
});

export const openDisputeAction = action(
  z.object({ orderId: z.uuid(), reason: z.enum(["NOT_RECEIVED", "DAMAGED", "NOT_AS_DESCRIBED", "COUNTERFEIT", "MISLEADING", "LOST", "WRONG_RECIPIENT", "OTHER"]), description: z.string().trim().min(20, "20 caractères minimum.").max(4000) }),
  async ({ orderId, reason, description }) => {
    const user = await requireUser();
    const d = await openDispute(user, orderId, { reason, description });
    revalidatePath(`/commande/${orderId}`);
    return { disputeId: d.id };
  },
);

export const disputeMessageAction = action(z.object({ disputeId: z.uuid(), body: z.string().trim().min(1).max(4000), staffOnly: z.boolean().optional() }), async ({ disputeId, body, staffOnly }) => {
  const user = await requireUser({ onboarded: false });
  await addDisputeMessage(user, disputeId, body, staffOnly);
  return { done: true };
});

export async function disputeEvidenceAction(formData: FormData): Promise<ActionResult<{ done: true }>> {
  try {
    const user = await requireUser({ onboarded: false });
    const disputeId = z.uuid().parse(formData.get("disputeId"));
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw invalid("Aucun fichier reçu.");
    if (file.size > 8 * 1024 * 1024) throw invalid("Fichier trop volumineux (8 Mo maximum).");
    await addDisputeEvidence(user, disputeId, { bytes: new Uint8Array(await file.arrayBuffer()), name: file.name });
    return { ok: true, data: { done: true } };
  } catch (e) {
    return toActionError(e);
  }
}

export const withdrawDisputeAction = action(z.object({ disputeId: z.uuid() }), async ({ disputeId }) => {
  const user = await requireUser();
  await withdrawDispute(user, disputeId);
  return { done: true };
});

export const reviewAction = action(z.object({ orderId: z.uuid(), rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional() }), async ({ orderId, rating, comment }) => {
  const user = await requireUser();
  await createReview(user, orderId, { rating, comment });
  revalidatePath(`/commande/${orderId}`);
  return { done: true };
});

export const saveAddressAction = action(z.object({ addressId: z.uuid().optional(), input: addressInputSchema }), async ({ addressId, input }) => {
  const user = await requireUser();
  const a = await saveAddress(user, input, addressId);
  revalidatePath("/compte/coordonnees");
  return { addressId: a.id };
});

export const deleteAddressAction = action(z.object({ addressId: z.uuid() }), async ({ addressId }) => {
  const user = await requireUser();
  await deleteAddress(user, addressId);
  revalidatePath("/compte/coordonnees");
  return { done: true };
});
