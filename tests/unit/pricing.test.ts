import { describe, expect, it } from "vitest";
import { computeFee, computeOrderPricing, DEFAULT_BUYER_FEE_RULE } from "@/lib/domain/pricing";
import { MoneyError } from "@/lib/domain/money";

const base = { currency: "EUR", unitPrice: 5000, quantity: 1, buyerFeeRule: DEFAULT_BUYER_FEE_RULE, shipping: null };

describe("computeOrderPricing — exemple du cahier des charges", () => {
  it("produit 50 € → commission acheteur 5 € → sous-total 55 € ; vendeur reçoit 50 €", () => {
    const p = computeOrderPricing(base);
    expect(p.itemsSubtotal).toBe(5000);
    expect(p.buyerFee).toBe(500);
    expect(p.totalAmount).toBe(5500);
    expect(p.sellerNetAmount).toBe(5000);
    expect(p.buyerFeeRateBps).toBe(1000);
  });

  it("la livraison est ventilée séparément et n'est jamais soumise à la commission Market", () => {
    const p = computeOrderPricing({ ...base, shipping: { amount: 890, currency: "EUR", provider: "sandbox_national", quoteId: "q1" } });
    expect(p.buyerFee).toBe(500); // 10 % de 50 €, pas de 58,90 €
    expect(p.shippingAmount).toBe(890);
    expect(p.totalAmount).toBe(6390);
    expect(p.sellerNetAmount).toBe(5000);
    expect(p.breakdown.map((l) => l.kind)).toEqual(["ITEMS", "BUYER_FEE", "SHIPPING"]);
  });

  it("prix Tamurt Transport transmis tel quel (sa commission est déjà incluse par Transport)", () => {
    const p = computeOrderPricing({ ...base, unitPrice: 25000, shipping: { amount: 4500, currency: "EUR", provider: "tamurt_transport", quoteId: "q2" } });
    expect(p.buyerFee).toBe(2500);
    expect(p.shippingAmount).toBe(4500);
    expect(p.totalAmount).toBe(25000 + 2500 + 4500);
  });

  it("refuse une livraison dans une autre devise (pas de conversion implicite)", () => {
    expect(() => computeOrderPricing({ ...base, shipping: { amount: 1000, currency: "DZD", provider: "x", quoteId: null } })).toThrow(MoneyError);
  });

  it("taxes estimées affichées mais non ajoutées au total ; taxes incluses ajoutées", () => {
    const estimated = computeOrderPricing({ ...base, tax: { amount: 900, status: "ESTIMATED" } });
    expect(estimated.taxAmount).toBe(0);
    expect(estimated.totalAmount).toBe(5500);
    const included = computeOrderPricing({ ...base, tax: { amount: 900, status: "INCLUDED" } });
    expect(included.totalAmount).toBe(6400);
  });

  it("quantité (vendeur professionnel) et commission vendeur explicite", () => {
    const p = computeOrderPricing({
      ...base,
      unitPrice: 1999,
      quantity: 3,
      sellerFeeRule: { id: "s", rateBps: 500, fixedAmount: 0, minAmount: 0, maxAmount: null },
    });
    expect(p.itemsSubtotal).toBe(5997);
    expect(p.buyerFee).toBe(600); // 599,7 → 600
    expect(p.sellerFee).toBe(300); // 299,85 → 300
    expect(p.sellerNetAmount).toBe(5697);
    expect(p.totalAmount).toBe(6597);
  });

  it("invariant : total = articles + frais + livraison + taxes collectées", () => {
    for (let price = 1; price < 200_000; price += 997) {
      const p = computeOrderPricing({ ...base, unitPrice: price, shipping: { amount: price % 1300, currency: "EUR", provider: "p", quoteId: null } });
      expect(p.totalAmount).toBe(p.itemsSubtotal + p.buyerFee + p.shippingAmount + p.taxAmount);
      expect(Number.isInteger(p.buyerFee)).toBe(true);
    }
  });

  it("refuse un prix nul, une quantité invalide, une devise invalide", () => {
    expect(() => computeOrderPricing({ ...base, unitPrice: 0 })).toThrow();
    expect(() => computeOrderPricing({ ...base, quantity: 0 })).toThrow();
    expect(() => computeOrderPricing({ ...base, currency: "eur" })).toThrow();
  });
});

describe("computeFee — bornes", () => {
  it("minimum et maximum appliqués", () => {
    expect(computeFee(100, { id: null, rateBps: 1000, fixedAmount: 0, minAmount: 70, maxAmount: null })).toBe(70);
    expect(computeFee(10_000_000, { id: null, rateBps: 1000, fixedAmount: 0, minAmount: 0, maxAmount: 50_000 })).toBe(50_000);
    expect(computeFee(5000, { id: null, rateBps: 500, fixedAmount: 70, minAmount: 0, maxAmount: null })).toBe(320);
  });
});
