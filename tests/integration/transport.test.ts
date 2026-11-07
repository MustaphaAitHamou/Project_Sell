import { beforeEach, describe, expect, it } from "vitest";
import { resetSimulator, setSimulatorCorridorLive, setSimulatorMode, simulatorState, emitSimulatorEvent } from "@/integrations/tamurt-transport/simulator";
import { db } from "@/server/db/client";
import { createOrder } from "@/server/services/orders/checkout";
import { getTransportQuotes } from "@/server/services/transport";
import { confirmTransportReservation } from "@/server/services/transport-orders";
import { ledgerBalance, makeAddress, makeListing, makeUser, paySandbox, runJobs, setCompliance, setFlag } from "./helpers";

/** Vendeur en France, acheteur de la diaspora en France qui fait livrer un proche en Algérie. */
async function corridorSetup() {
  const seller = await makeUser({ country: "FR" });
  const buyer = await makeUser({ country: "FR" });
  const listing = await makeListing(seller, { price: 4000, deliveryMethods: ["HAND_DELIVERY", "TAMURT_TRANSPORT"], acceptsCrossBorder: true });
  const address = await makeAddress(buyer, "DZ");
  return { seller, buyer, listing, address };
}

async function quotesFor(buyer: { id: string }, listingId: string) {
  return getTransportQuotes({ listingId, destinationCountry: "DZ", destinationCity: "Béjaïa", viewerId: buyer.id, viewerKey: buyer.id });
}

beforeEach(() => resetSimulator());

describe("Tamurt Transport — corridor non validé", () => {
  it("affiche des devis simulés mais bloque l'achat (corridor de test, flux international fermé, conformité à vérifier)", async () => {
    const { buyer, listing, address } = await corridorSetup();
    const res = await quotesFor(buyer, listing.id);
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.simulated).toBe(true);
    expect(res.corridorStatus).toBe("TEST_ONLY");
    expect(res.purchasable).toBe(false);
    expect(res.blockers.length).toBeGreaterThanOrEqual(2);
    expect(res.quotes.every((q) => !q.bookable)).toBe(true);
    await expect(createOrder(buyer, { listingId: listing.id, deliveryMethod: "TAMURT_TRANSPORT", addressId: address.id, transportQuoteId: res.quotes[0]!.quoteId, idempotencyKey: crypto.randomUUID() })).rejects.toMatchObject({ code: "PRECONDITION" });
    expect(await db.order.count({ where: { listingId: listing.id } })).toBe(0);
  });
});

describe("Tamurt Transport — saga de réservation (corridor ouvert en simulation)", () => {
  beforeEach(async () => {
    await setFlag("checkout.crossBorder", true);
    await setCompliance("FR", "DZ", "ALLOWED");
    setSimulatorCorridorLive(true);
  });

  it("bloque la capacité avant paiement, la confirme après paiement et suit la livraison", async () => {
    const { buyer, listing, address } = await corridorSetup();
    const res = await quotesFor(buyer, listing.id);
    if (res.status !== "ok") throw new Error(`devis : ${res.status}`);
    expect(res.purchasable).toBe(true);
    const quote = res.quotes.find((q) => q.bookable)!;
    const { orderId } = await createOrder(buyer, { listingId: listing.id, deliveryMethod: "TAMURT_TRANSPORT", addressId: address.id, transportQuoteId: quote.quoteId, idempotencyKey: crypto.randomUUID() });

    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { transportReservations: true, pricing: true } });
    expect(order).toMatchObject({ isCrossBorder: true, destinationCountry: "DZ", shippingAmount: quote.amount });
    // Frais de protection calculés sur le prix de l'article uniquement (pas sur le transport : pas de double commission).
    expect(order.buyerFee).toBe(400);
    expect(order.totalAmount).toBe(4000 + 400 + quote.amount);
    expect(order.pricing?.taxStatus).toBe("UNKNOWN");
    expect(order.transportReservations[0]).toMatchObject({ status: "HELD", corridor: "FR-DZ", isSimulated: true });

    // Un devis ne peut servir qu'à une seule commande.
    await expect(createOrder(buyer, { listingId: listing.id, deliveryMethod: "TAMURT_TRANSPORT", addressId: address.id, transportQuoteId: quote.quoteId, idempotencyKey: crypto.randomUUID() })).rejects.toBeTruthy();

    await paySandbox(orderId);
    await runJobs();
    const reservation = await db.transportReservation.findFirstOrThrow({ where: { orderId } });
    expect(reservation.status).toBe("CONFIRMED");
    expect(await db.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({ status: "READY_TO_SHIP" });
    expect(await db.integrationEvent.count({ where: { system: "TRANSPORT", aggregateId: orderId } })).toBeGreaterThan(0);

    // Événements signés émis par Transport (simulateur) : collecte, acheminement, livraison.
    for (const type of ["transport.shipment.collected", "transport.shipment.in_transit", "transport.shipment.delivered"] as const) {
      const r = await emitSimulatorEvent(reservation.externalReservationId, type);
      expect(r.status).toBe(200);
    }
    expect(await db.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({ status: "DISPUTE_WINDOW" });
    expect((await ledgerBalance()).EUR ?? 0).toBe(0);
  });

  it("compense un échec définitif de confirmation : remboursement intégral et remise en vente", async () => {
    const { buyer, listing, address } = await corridorSetup();
    const res = await quotesFor(buyer, listing.id);
    if (res.status !== "ok") throw new Error(`devis : ${res.status}`);
    const quote = res.quotes.find((q) => q.bookable)!;
    const { orderId } = await createOrder(buyer, { listingId: listing.id, deliveryMethod: "TAMURT_TRANSPORT", addressId: address.id, transportQuoteId: quote.quoteId, idempotencyKey: crypto.randomUUID() });
    // Paiement reçu, puis Transport devient injoignable avant la confirmation.
    await paySandbox(orderId);
    await db.job.updateMany({ where: { type: "transport.reservation.confirm" }, data: { status: "DONE" } }); // traité manuellement ci-dessous
    setSimulatorMode("down");
    const reservation = await db.transportReservation.findFirstOrThrow({ where: { orderId } });
    await confirmTransportReservation(reservation.id, 8, 8);
    expect(await db.transportReservation.findUniqueOrThrow({ where: { id: reservation.id } })).toMatchObject({ status: "FAILED" });
    setSimulatorMode("normal");
    await runJobs();
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { refunds: true } });
    expect(order.status).toBe("REFUNDED");
    expect(order.refunds[0]).toMatchObject({ status: "SUCCEEDED", amount: order.totalAmount });
    expect(await db.listing.findUniqueOrThrow({ where: { id: listing.id } })).toMatchObject({ status: "ACTIVE", quantityAvailable: 1 });
    expect((await ledgerBalance()).EUR ?? 0).toBe(0);
  });

  it("une indisponibilité de Transport n'empêche pas d'utiliser Market", async () => {
    const { buyer, listing } = await corridorSetup();
    setSimulatorMode("down");
    const res = await quotesFor(buyer, listing.id);
    expect(res.status).toBe("unavailable");
    // La remise en main propre (achat national) reste possible.
    const local = await makeUser({ country: "FR" });
    const { orderId } = await createOrder(local, { listingId: listing.id, deliveryMethod: "HAND_DELIVERY", idempotencyKey: crypto.randomUUID() });
    expect(orderId).toBeTruthy();
    expect(simulatorState().mode).toBe("down");
  });
});
