import { describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { getDisputeForViewer, openDispute, resolveDispute } from "@/server/services/disputes";
import { getConversation, sendMessage, setBlock, startConversation } from "@/server/services/messaging";
import { moderateListing, setStaffRole, setUserStatus } from "@/server/services/moderation";
import { createOrder } from "@/server/services/orders/checkout";
import { confirmHandover, getHandoverCode } from "@/server/services/orders/fulfillment";
import { getOrderForViewer } from "@/server/services/orders/queries";
import { ledgerBalance, makeListing, makeUser, paySandbox, runJobs } from "./helpers";

/** Commande remise en main propre, en période de vérification (litige possible). */
async function deliveredOrder(price = 2490) {
  const seller = await makeUser();
  const buyer = await makeUser();
  const listing = await makeListing(seller, { price });
  const { orderId } = await createOrder(buyer, { listingId: listing.id, deliveryMethod: "HAND_DELIVERY", idempotencyKey: crypto.randomUUID() });
  await paySandbox(orderId);
  await confirmHandover(seller, orderId, (await getHandoverCode(buyer, orderId))!);
  return { seller, buyer, listing, orderId };
}

const DESCRIPTION = "L'article présente une fissure importante non mentionnée dans l'annonce.";

describe("Litiges et remboursements", () => {
  it("gèle le versement puis rembourse intégralement après décision motivée du support", async () => {
    const { buyer, orderId } = await deliveredOrder();
    const support = await makeUser({ roles: ["SUPPORT"] });
    const dispute = await openDispute(buyer, orderId, { reason: "DAMAGED", description: DESCRIPTION });
    expect(await db.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({ status: "DISPUTED" });
    await expect(resolveDispute(support, dispute.id, { resolution: "FULL_REFUND", note: "bref" })).rejects.toMatchObject({ code: "VALIDATION" });
    await resolveDispute(support, dispute.id, { resolution: "FULL_REFUND", note: "Photos probantes : fissure non signalée dans l'annonce." });
    await runJobs();
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { refunds: true, payout: true } });
    expect(order.status).toBe("REFUNDED");
    expect(order.refunds[0]).toMatchObject({ status: "SUCCEEDED", amount: 2739 });
    expect(order.payout?.status).not.toBe("PAID");
    expect((await ledgerBalance()).EUR ?? 0).toBe(0);
  });

  it("plafonne les remboursements décidés par le support (au-delà : équipe finance)", async () => {
    const { buyer, orderId } = await deliveredOrder(20_000); // 200 € > plafond support de 100 €
    const support = await makeUser({ roles: ["SUPPORT"] });
    const admin = await makeUser({ roles: ["ADMIN"] });
    const dispute = await openDispute(buyer, orderId, { reason: "NOT_AS_DESCRIBED", description: DESCRIPTION });
    await expect(resolveDispute(support, dispute.id, { resolution: "FULL_REFUND", note: "Décision motivée par les preuves fournies." })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(resolveDispute(admin, dispute.id, { resolution: "PARTIAL_REFUND", refundAmount: 20_000, note: "Montant partiel égal au prix : refusé." })).rejects.toMatchObject({ code: "VALIDATION" });
    await resolveDispute(admin, dispute.id, { resolution: "PARTIAL_REFUND", refundAmount: 5_000, note: "Défaut mineur : remboursement partiel de 50 €." });
    await runJobs();
    const refund = await db.refund.findFirstOrThrow({ where: { orderId } });
    expect(refund).toMatchObject({ amount: 5_000, status: "SUCCEEDED" });
    expect((await ledgerBalance()).EUR ?? 0).toBe(0);
  });

  it("un modérateur ne peut pas trancher un litige", async () => {
    const { buyer, orderId } = await deliveredOrder();
    const moderator = await makeUser({ roles: ["MODERATOR"] });
    const dispute = await openDispute(buyer, orderId, { reason: "DAMAGED", description: DESCRIPTION });
    await expect(resolveDispute(moderator, dispute.id, { resolution: "NO_REFUND", note: "Tentative sans autorisation suffisante." })).rejects.toMatchObject({ code: expect.stringMatching(/FORBIDDEN|NOT_FOUND/) });
  });
});

describe("Contrôle d'accès objet par objet (anti-IDOR)", () => {
  it("une commande, un litige ou une conversation d'autrui sont introuvables", async () => {
    const { buyer, seller, listing, orderId } = await deliveredOrder();
    const stranger = await makeUser();
    await expect(getOrderForViewer(stranger, orderId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const dispute = await openDispute(buyer, orderId, { reason: "DAMAGED", description: DESCRIPTION });
    await expect(getDisputeForViewer(stranger, dispute.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(openDispute(stranger, orderId, { reason: "DAMAGED", description: DESCRIPTION })).rejects.toMatchObject({ code: "NOT_FOUND" });

    const other = await makeUser();
    const conversation = await startConversation(other, listing.id, "Bonjour, l'article est-il toujours disponible ?");
    await expect(getConversation(stranger, conversation.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(sendMessage(stranger as never, conversation.id, "intrusion")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getConversation(seller, conversation.id)).resolves.toBeTruthy();
  });

  it("le personnel habilité consulte une commande et la consultation est journalisée", async () => {
    const { orderId } = await deliveredOrder();
    const support = await makeUser({ roles: ["SUPPORT"] });
    const view = await getOrderForViewer(support, orderId);
    expect(view.role).toBe("STAFF");
    expect(await db.auditLog.count({ where: { action: "order.staff_view", targetId: orderId, actorId: support.id } })).toBe(1);
  });

  it("un vendeur ne voit l'adresse de livraison qu'après le paiement", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const listing = await makeListing(seller, { deliveryMethods: ["HAND_DELIVERY"] });
    const { orderId } = await createOrder(buyer, { listingId: listing.id, deliveryMethod: "HAND_DELIVERY", idempotencyKey: crypto.randomUUID() });
    await db.order.update({ where: { id: orderId }, data: { shippingAddress: { fullName: "Destinataire", line1: "1 rue privée", city: "Lyon", countryCode: "FR" } } });
    expect((await getOrderForViewer(seller, orderId)).order.shippingAddress).toBeNull();
    await paySandbox(orderId);
    expect((await getOrderForViewer(seller, orderId)).order.shippingAddress).not.toBeNull();
  });

  it("un membre bloqué ne peut plus écrire", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const listing = await makeListing(seller);
    const c = await startConversation(buyer, listing.id, "Bonjour, je suis intéressé par votre article.");
    await setBlock(seller, buyer.id, true);
    await expect(sendMessage(buyer, c.id, "Vous êtes là ?")).rejects.toBeTruthy();
  });
});

describe("Permissions du personnel", () => {
  it("le support ne modère pas les annonces, le modérateur n'exclut pas, l'administrateur ne crée pas d'administrateur", async () => {
    const seller = await makeUser();
    const listing = await makeListing(seller);
    const support = await makeUser({ roles: ["SUPPORT"] });
    const moderator = await makeUser({ roles: ["MODERATOR"] });
    const admin = await makeUser({ roles: ["ADMIN"] });
    await expect(moderateListing(support, listing.id, "SUSPEND", "Contenu suspect à vérifier")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setUserStatus(moderator, seller.id, "BANNED", "Fraude répétée constatée")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setStaffRole(admin, moderator.id, "ADMIN", true)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setUserStatus(admin, admin.id, "SUSPENDED", "Auto-suspension interdite")).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("une suspension est motivée, notifiée, journalisée et ferme les sessions", async () => {
    const member = await makeUser();
    const moderator = await makeUser({ roles: ["MODERATOR"] });
    await db.session.create({ data: { id: crypto.randomUUID(), userId: member.id, token: crypto.randomUUID(), expiresAt: new Date(Date.now() + 86_400_000) } });
    await expect(setUserStatus(moderator, member.id, "SUSPENDED", "")).rejects.toMatchObject({ code: "VALIDATION" });
    await setUserStatus(moderator, member.id, "SUSPENDED", "Annonces trompeuses répétées malgré avertissement");
    expect(await db.user.findUniqueOrThrow({ where: { id: member.id } })).toMatchObject({ status: "SUSPENDED" });
    expect(await db.session.count({ where: { userId: member.id } })).toBe(0);
    expect(await db.notification.count({ where: { userId: member.id, type: "ACCOUNT" } })).toBe(1);
    expect(await db.moderationAction.count({ where: { targetId: member.id, action: "SUSPEND_USER" } })).toBe(1);
  });
});
