import { describe, expect, it } from "vitest";
import { evaluateCompliance, type ComplianceContext, type ComplianceRuleInput } from "@/lib/domain/compliance";

const smartphones = { id: "cat-smartphones", isProhibited: false };
const electronics = { id: "cat-electronique", isProhibited: false };
const books = { id: "cat-livres", isProhibited: false };

const rule = (r: Partial<ComplianceRuleInput> & Pick<ComplianceRuleInput, "status">): ComplianceRuleInput => ({
  id: Math.random().toString(36).slice(2),
  originCountry: null,
  destinationCountry: null,
  categoryId: null,
  paymentProvider: null,
  carrier: null,
  conditions: null,
  maxDeclaredValueMinor: null,
  ...r,
});

const ctx = (c: Partial<ComplianceContext>): ComplianceContext => ({
  originCountry: "FR",
  destinationCountry: "FR",
  categoryAncestry: [smartphones, electronics],
  paymentProvider: "sandbox",
  carrier: "sandbox_national",
  ...c,
});

describe("matrice de conformité", () => {
  it("national sans règle : autorisé", () => {
    const d = evaluateCompliance([], ctx({}));
    expect(d.status).toBe("ALLOWED");
    expect(d.purchasable).toBe(true);
  });

  it("transfrontalier sans règle : à vérifier, donc bloqué", () => {
    const d = evaluateCompliance([], ctx({ destinationCountry: "DZ" }));
    expect(d.status).toBe("TO_VERIFY");
    expect(d.purchasable).toBe(false);
    expect(d.reason).toBe("DEFAULT_CROSS_BORDER_UNVERIFIED");
  });

  it("catégorie interdite : interdit même avec une règle autorisant", () => {
    const d = evaluateCompliance(
      [rule({ status: "ALLOWED" })],
      ctx({ categoryAncestry: [{ id: "cat-armes", isProhibited: true }] }),
    );
    expect(d.status).toBe("PROHIBITED");
  });

  it("une règle plus spécifique l'emporte (livres autorisés FR→DZ, reste à vérifier)", () => {
    const rules = [
      rule({ originCountry: "FR", destinationCountry: "DZ", status: "TO_VERIFY" }),
      rule({ originCountry: "FR", destinationCountry: "DZ", categoryId: "cat-livres", status: "CONDITIONAL", conditions: "Déclaration de contenu" }),
    ];
    expect(evaluateCompliance(rules, ctx({ destinationCountry: "DZ", categoryAncestry: [books] })).status).toBe("CONDITIONAL");
    expect(evaluateCompliance(rules, ctx({ destinationCountry: "DZ" })).status).toBe("TO_VERIFY");
  });

  it("une règle de catégorie parente s'applique aux sous-catégories ; la plus proche l'emporte", () => {
    const rules = [
      rule({ destinationCountry: "DZ", categoryId: "cat-electronique", status: "PROHIBITED" }),
      rule({ destinationCountry: "DZ", categoryId: "cat-smartphones", status: "CONDITIONAL" }),
    ];
    expect(evaluateCompliance(rules, ctx({ destinationCountry: "DZ" })).status).toBe("CONDITIONAL");
    expect(
      evaluateCompliance(rules, ctx({ destinationCountry: "DZ", categoryAncestry: [{ id: "cat-tv", isProhibited: false }, electronics] })).status,
    ).toBe("PROHIBITED");
  });

  it("à spécificité égale, la règle la plus restrictive l'emporte", () => {
    const rules = [
      rule({ originCountry: "FR", destinationCountry: "DZ", paymentProvider: "sandbox", status: "ALLOWED" }),
      rule({ originCountry: "FR", destinationCountry: "DZ", categoryId: "cat-smartphones", status: "PROHIBITED" }),
    ];
    // 3 dimensions chacune ; la règle de catégorie gagne légèrement en spécificité et reste la plus restrictive.
    expect(evaluateCompliance(rules, ctx({ destinationCountry: "DZ" })).status).toBe("PROHIBITED");
    const tie = [
      rule({ originCountry: "FR", destinationCountry: "DZ", status: "ALLOWED" }),
      rule({ originCountry: "FR", destinationCountry: "DZ", status: "PROHIBITED" }),
    ];
    expect(evaluateCompliance(tie, ctx({ destinationCountry: "DZ" })).status).toBe("PROHIBITED");
  });

  it("une règle sur le transporteur ne s'applique qu'à ce transporteur", () => {
    const rules = [rule({ originCountry: "FR", destinationCountry: "DZ", carrier: "tamurt_transport", status: "CONDITIONAL" })];
    expect(evaluateCompliance(rules, ctx({ destinationCountry: "DZ", carrier: "tamurt_transport" })).purchasable).toBe(true);
    expect(evaluateCompliance(rules, ctx({ destinationCountry: "DZ", carrier: "autre" })).purchasable).toBe(false);
  });

  it("valeur déclarée au-delà du plafond : interdit", () => {
    const rules = [rule({ destinationCountry: "DZ", status: "CONDITIONAL", maxDeclaredValueMinor: 50_000 })];
    expect(evaluateCompliance(rules, ctx({ destinationCountry: "DZ", declaredValueMinor: 49_999 })).purchasable).toBe(true);
    const d = evaluateCompliance(rules, ctx({ destinationCountry: "DZ", declaredValueMinor: 50_001 }));
    expect(d.status).toBe("PROHIBITED");
    expect(d.reason).toBe("VALUE_ABOVE_LIMIT");
  });
});
