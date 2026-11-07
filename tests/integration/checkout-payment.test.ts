import { describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { createOrder, expireUnpaidOrders, getCheckoutPreview, retryPayment } from "@/server/services/orders/checkout";
import { confirmHandover, confirmReceipt, getHandoverCode } from "@/server/services/orders/fulfillment";
import { enablePayoutAccount, retryBlockedPayouts } from "@/server/services/payments";
import { accountBalance, ledgerBalance, makeListing, makeUser, paySandbox, replayWebhook, runJobs } from "./helpers";

const key = () => crypto.randomUUID();

describe("Prix et commission calculés côté serveur", () => {
  it("ajoute 10 % de frais de protection à l'acheteur : 50 € → 5 € → 55 €, le vendeur reçoit 50 €", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const listing = await makeListing(seller, { price: 5000 });
    const preview = await getCheckoutPreview(buyer, listing.id, { deliveryMethod: "HAND_DELIVERY" });
    expect(preview.eligibility.purchasable).toBe(true);
    expect(preview.pricing).toMatchObject({ itemsSubtotal: 5000, buyerFee: 500, totalAmount: 5500, sellerNetAmount: 5000 });
  });

  it("ignore tout montant injecté par le navigateur", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const listing = await makeListing(seller, { price: 5000 });
    // Un client malveillant ajoute des montants : ils ne font pas partie du contrat et sont ignorés.
    const forged = { listingId: listing.id, deliveryMethod: "HAND_DELIVERY", idempotencyKey: key(), totalAmount: 1, buyerFee: 0, priceAmount: 1 } as unknown as Parameters<typeof createOrder>[1];
    const { orderId } = await createOrder(buyer, forged);
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { pricing: true, payments: true } });
    expect(order.totalAmount).toBe(5500);
    expect(order.pricing?.buyerFeeRateBps).toBe(1000);
    expect(order.payments[0]?.amount).toBe(5500);
  });

  it("refuse l'achat de sa propre annonce et sans e-mail vérifié", async () => {
    const seller = await makeUser();
    const listing = await makeListing(seller);
    await expect(createOrder(seller, { listingId: listing.id, deliveryMethod: "HAND_DELIVERY", idempotencyKey: key() })).rejects.toMatchObject({ code: "PRECONDITION" });
    const unverified = await makeUser({ verified: false });
    await expect(createOrder(unverified, { listingId: listing.id, deliveryMethod: "HAND_DELIVERY", idempotencyKey: key() })).rejects.toMatchObject({ code: "PRECONDITION" });
  });
});

describe("Concurrence et idempotence", () => {
  it("deux achats simultanés d'un exemplaire unique : une seule commande", async () => {
    const seller = await makeUser();
    const [a, b, c] = await Promise.all([makeUser(), makeUser(), makeUser()]);
    const listing = await makeListing(seller, { price: 3000 });
    const results = await Promise.allSettled([a, b, c].map((u) => createOrder(u, { listingId: listing.id, deliveryMethod: "HAND_DELIVERY", idempotencyKey: key() })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected").every((r) => (r as PromiseRejectedResult).reason?.code === "CONFLICT")).toBe(true);
    expect(await db.order.count({ where: { listingId: listing.id } })).toBe(1);
    expect(await db.listing.findUniqueOrThrow({ where: { id: listing.id } })).toMatchObject({ status: "RESERVED", quantityAvailable: 0 });
  });

  it("une même clé d'idempotence ne crée qu'une commande", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const listing = await makeListing(seller);
    const k = key();
    const first = await createOrder(buyer, { listingId: listing.id, deliveryMethod: "HAND_DELIVERY", idempotencyKey: k });
    const second = await createOrder(buyer, { listingId: listing.id, deliveryMethod: "HAND_DELIVERY", idempotencyKey: k });
    expect(second).toMatchObject({ orderId: first.orderId, replayed: true });
    expect(await db.order.count({ where: { listingId: listing.id } })).toBe(1);
  });
});

describe("Webhooks de paiement", () => {
  it("passe la commande en payée une seule fois, même si le webhook est rejoué", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const listing = await makeListing(seller, { price: 2490 });
    const { orderId } = await createOrder(buyer, { listingId: listing.id, deliveryMethod: "HAND_DELIVERY", idempotencyKey: key() });
    const { raw, result } = await paySandbox(orderId);
    expect(result.body).toMatchObject({ outcome: "paid" });
    const again = await replayWebhook(raw);
    expect(again.body).toMatchObject({ duplicate: true });
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { history: true, ledgerTransactions: true } });
    expect(order.status).toBe("SHIPPING_PENDING");
    expect(order.history.filter((h) => h.toStatus === "PAID")).toHaveLength(1);
    expect(order.ledgerTransactions.filter((t) => t.kind === "PAYMENT_CAPTURED")).toHaveLength(1);
    expect(await db.listing.findUniqueOrThrow({ where: { id: listing.id } })).toMatchObject({ status: "SOLD" });
    expect((await ledgerBalance()).EUR ?? 0).toBe(0);
  });

  it("rejette une signature invalide sans rien traiter", async () => {
    const { handlePaymentWebhook } = await import("@/server/services/payments");
    const raw = JSON.stringify({ id: "evt_forged", type: "payment.succeeded", data: { session: "x", payment: "y", amount: 1, currency: "EUR" } });
    const res = await handlePaymentWebhook("sandbox", raw, new Headers({ "tamurt-sandbox-signature": "t=1,v1=deadbeef" }));
    expect(res.status).toBe(400);
    expect(await db.webhookEvent.count({ where: { eventId: "evt_forged" } })).toBe(0);
  });

  it("refuse un montant payé différent du montant de la commande", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const listing = await makeListing(seller, { price: 2000 });
    const { orderId } = await createOrder(buyer, { listingId: listing.id, deliveryMethod: "HAND_DELIVERY", idempotencyKey: key() });
    const { result } = await paySandbox(orderId, { amount: 100 });
    expect(result.status).toBe(500);
    expect(await db.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({ status: "PAYMENT_PENDING" });
    expect(await db.auditLog.count({ where: { action: "payment.amount_mismatch" } })).toBeGreaterThan(0);
  });

  it("rembourse automatiquement un paiement en double", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const listing = await makeListing(seller, { price: 1500 });
    const { orderId } = await createOrder(buyer, { listingId: listing.id, deliveryMethod: "HAND_DELIVERY", idempotencyKey: key() });
    const firstSession = (await db.payment.findFirstOrThrow({ where: { orderId } })).providerSessionId!;
    await retryPayment(buyer, orderId);
    await paySandbox(orderId); // seconde session (la plus récente)
    const dup = await paySandbox(orderId, { session: firstSession });
    expect(dup.result.body).toMatchObject({ outcome: "duplicate_refunded" });
    await runJobs();
    const payments = await db.payment.findMany({ where: { orderId }, include: { refunds: true } });
    const duplicate = payments.find((p) => p.isDuplicate)!;
    expect(duplicate.refunds[0]?.status).toBe("SUCCEEDED");
    expect(await accountBalance("unallocated_receipts", orderId)).toBe(0);
    expect((await ledgerBalance()).EUR ?? 0).toBe(0);
  });
});

describe("Remise en main propre jusqu'au versement", () => {
  it("code de remise, période de vérification, clôture, versement simulé", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const listing = await makeListing(seller, { price: 2490 });
    const { orderId } = await createOrder(buyer, { listingId: listing.id, deliveryMethod: "HAND_DELIVERY", idempotencyKey: key() });
    await paySandbox(orderId);
    // Le code n'est accessible qu'à l'acheteur.
    await expect(getHandoverCode(seller, orderId)).rejects.toBeTruthy();
    const code = await getHandoverCode(buyer, orderId);
    expect(code).toMatch(/^\d{6}$/);
    await expect(confirmHandover(seller, orderId, code === "000000" ? "111111" : "000000")).rejects.toMatchObject({ code: "VALIDATION" });
    await confirmHandover(seller, orderId, code);
    expect(await db.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({ status: "DISPUTE_WINDOW", handoverAttempts: 1 });
    await confirmReceipt(buyer, orderId);
    await runJobs();
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { payout: true } });
    expect(order.status).toBe("COMPLETED");
    expect(order.payout).toMatchObject({ status: "BLOCKED", amount: 2490 });
    expect(await accountBalance("buyer_fee_revenue", orderId)).toBe(-249); // produit acquis (crédit de 2,49 €)
    expect(await accountBalance("buyer_fee_deferred", orderId)).toBe(0);

    // Versements : pays et compte de versement requis (simulés dans cet environnement).
    await db.country.update({ where: { code: "FR" }, data: { payoutsEnabled: true } });
    await enablePayoutAccount({ id: seller.id, profile: { countryCode: "FR" } });
    await retryBlockedPayouts();
    await runJobs();
    expect(await db.payout.findUniqueOrThrow({ where: { orderId } })).toMatchObject({ status: "PAID", isSimulated: true });
    expect(await accountBalance("seller_payable", orderId)).toBe(0);
    expect(await accountBalance("psp_clearing", orderId)).toBe(2739 - 2490 - 63); // encaissé − versé − frais prestataire
    expect((await ledgerBalance()).EUR ?? 0).toBe(0);
  });

  it("annule une commande non payée à expiration et remet l'article en vente", async () => {
    const seller = await makeUser();
    const buyer = await makeUser();
    const listing = await makeListing(seller);
    const { orderId } = await createOrder(buyer, { listingId: listing.id, deliveryMethod: "HAND_DELIVERY", idempotencyKey: key() });
    await db.order.update({ where: { id: orderId }, data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    expect(await expireUnpaidOrders()).toBeGreaterThanOrEqual(1);
    expect(await db.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({ status: "CANCELLED" });
    expect(await db.listing.findUniqueOrThrow({ where: { id: listing.id } })).toMatchObject({ status: "ACTIVE", quantityAvailable: 1 });
  });
});
