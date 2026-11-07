import { describe, expect, it } from "vitest";
import {
  assertOrderTransition,
  canTransitionOrder,
  ORDER_STATUSES,
  ORDER_TERMINAL_STATES,
  ORDER_TRANSITIONS,
  OrderTransitionError,
} from "@/lib/domain/order-state";
import { canTransitionListing, LISTING_STATUSES, LISTING_TRANSITIONS, publicationTarget } from "@/lib/domain/listing-state";

describe("machine à états des commandes", () => {
  it("parcours nominal livraison nationale", () => {
    const path = [
      ["CREATED", "PAYMENT_PENDING", "SYSTEM"],
      ["PAYMENT_PENDING", "PAID", "SYSTEM"],
      ["PAID", "SHIPPING_PENDING", "SYSTEM"],
      ["SHIPPING_PENDING", "READY_TO_SHIP", "SYSTEM"],
      ["READY_TO_SHIP", "IN_TRANSIT", "SYSTEM"],
      ["IN_TRANSIT", "DELIVERED", "SYSTEM"],
      ["DELIVERED", "DISPUTE_WINDOW", "SYSTEM"],
      ["DISPUTE_WINDOW", "COMPLETED", "BUYER"],
    ] as const;
    for (const [from, to, actor] of path) expect(() => assertOrderTransition(from, to, actor)).not.toThrow();
  });

  it("le vendeur ne peut jamais déclarer une commande livrée ni payée", () => {
    for (const from of ORDER_STATUSES) {
      expect(canTransitionOrder(from, "DELIVERED", "SELLER")).toBe(false);
      expect(canTransitionOrder(from, "PAID", "SELLER")).toBe(false);
      expect(canTransitionOrder(from, "COMPLETED", "SELLER")).toBe(false);
    }
  });

  it("seul le système (webhook vérifié) marque une commande payée", () => {
    for (const actor of ["BUYER", "SELLER", "STAFF"] as const) expect(canTransitionOrder("PAYMENT_PENDING", "PAID", actor)).toBe(false);
    expect(canTransitionOrder("PAYMENT_PENDING", "PAID", "SYSTEM")).toBe(true);
  });

  it("seul le système confirme un remboursement", () => {
    for (const actor of ["BUYER", "SELLER", "STAFF"] as const) expect(canTransitionOrder("REFUND_PENDING", "REFUNDED", actor)).toBe(false);
  });

  it("les états terminaux n'ont aucune sortie", () => {
    for (const s of ORDER_TERMINAL_STATES) expect(Object.keys(ORDER_TRANSITIONS[s])).toHaveLength(0);
  });

  it("une transition interdite lève une erreur typée", () => {
    expect(() => assertOrderTransition("CREATED", "COMPLETED", "STAFF")).toThrow(OrderTransitionError);
  });

  it("tous les états cibles existent", () => {
    for (const edges of Object.values(ORDER_TRANSITIONS))
      for (const to of Object.keys(edges)) expect(ORDER_STATUSES).toContain(to);
  });
});

describe("cycle de vie des annonces", () => {
  it("publication directe ou modération préalable", () => {
    expect(publicationTarget({ categoryRequiresReview: false, sellerRequiresReview: false })).toBe("ACTIVE");
    expect(publicationTarget({ categoryRequiresReview: true, sellerRequiresReview: false })).toBe("PENDING_REVIEW");
    expect(publicationTarget({ categoryRequiresReview: false, sellerRequiresReview: true })).toBe("PENDING_REVIEW");
  });
  it("le vendeur ne peut ni approuver sa propre annonce ni lever une suspension", () => {
    expect(canTransitionListing("PENDING_REVIEW", "ACTIVE", "SELLER")).toBe(false);
    expect(canTransitionListing("SUSPENDED", "ACTIVE", "SELLER")).toBe(false);
  });
  it("seul le système réserve ; le vendeur peut déclarer une vente hors plateforme", () => {
    expect(canTransitionListing("ACTIVE", "RESERVED", "SELLER")).toBe(false);
    expect(canTransitionListing("ACTIVE", "RESERVED", "SYSTEM")).toBe(true);
    expect(canTransitionListing("ACTIVE", "SOLD", "SELLER")).toBe(true);
    expect(canTransitionListing("RESERVED", "SOLD", "SELLER")).toBe(false);
  });
  it("supprimée est terminal", () => expect(Object.keys(LISTING_TRANSITIONS.DELETED)).toHaveLength(0));
  it("tous les états cibles existent", () => {
    for (const edges of Object.values(LISTING_TRANSITIONS))
      for (const to of Object.keys(edges)) expect(LISTING_STATUSES).toContain(to);
  });
});
