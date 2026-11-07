import { describe, expect, it } from "vitest";
import { generateOrderReference, generatePublicId, handleFromName, isValidHandle, listingPath, parseListingSegment } from "@/lib/domain/ids";
import { analyzeMessage, requiresRecipientWarning } from "@/lib/domain/message-risk";
import { normalizeForSearch, sanitizeText, slugify } from "@/lib/domain/text";
import { assignableRoles, hasPermission, permissionsFor } from "@/lib/domain/permissions";

describe("texte", () => {
  it("normalisation de recherche", () => {
    expect(normalizeForSearch("  Béjaïa — Tizi-Ouzou ")).toBe("bejaia tizi ouzou");
    expect(normalizeForSearch("Console PS5 édition numérique!")).toBe("console ps5 edition numerique");
  });
  it("slug", () => {
    expect(slugify("Robe kabyle brodée — taille M")).toBe("robe-kabyle-brodee-taille-m");
    expect(slugify("ⵜⴰⵎⵓⵔⵜ")).toBe("annonce");
    expect(slugify("Taqendurt n leɛrus")).toBe("taqendurt-n-leerus");
  });
  it("suppression des caractères de contrôle et marques bidirectionnelles", () => {
    expect(sanitizeText("abc‮gpj.exe\u0000 ok  ")).toBe("abcgpj.exe ok");
    expect(sanitizeText("ligne1\r\n\r\n\r\n\r\nligne2")).toBe("ligne1\n\nligne2");
    expect(sanitizeText("a\nb", { multiline: false })).toBe("a b");
  });
});

describe("identifiants publics", () => {
  it("format et unicité statistique", () => {
    const ids = new Set(Array.from({ length: 2000 }, () => generatePublicId()));
    expect(ids.size).toBe(2000);
    for (const id of ids) expect(id).toMatch(/^[0-9a-hjkmnp-tv-z]{10}$/);
  });
  it("référence de commande", () => expect(generateOrderReference()).toMatch(/^TM-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/));
  it("chemin d'annonce stable : l'identifiant reste valide si le slug change", () => {
    const id = generatePublicId();
    expect(listingPath("console-ps5", id)).toBe(`/produit/console-ps5-${id}`);
    expect(parseListingSegment(`console-ps5-${id}`)).toEqual({ publicId: id, slug: "console-ps5" });
    expect(parseListingSegment(`nouveau-titre-${id}`)?.publicId).toBe(id);
    expect(parseListingSegment("pas-un-identifiant")).toBeNull();
    expect(parseListingSegment("x-ILOU012345")).toBeNull();
  });
  it("pseudonymes", () => {
    expect(handleFromName("Atelier Lalla Fadhma")).toBe("atelier-lalla-fadhma");
    expect(isValidHandle("abc")).toBe(true);
    expect(isValidHandle("ab")).toBe(false); // 3 caractères minimum (contrainte SQL identique)
    expect(isValidHandle("-ab")).toBe(false);
    expect(isValidHandle("a--b")).toBe(false);
  });
});

describe("signaux de risque des messages", () => {
  it("lien externe et raccourcisseur", () => {
    expect(analyzeMessage("Regarde https://bit.ly/abc")).toEqual(expect.arrayContaining(["external_link", "suspicious_link"]));
    expect(analyzeMessage("voir www.exemple.com/annonce")).toContain("external_link");
  });
  it("lien vers le site lui-même non signalé", () => {
    expect(analyzeMessage("https://market.tamurt.example/produit/x", ["market.tamurt.example"])).toEqual([]);
  });
  it("coordonnées et paiement hors plateforme", () => {
    expect(analyzeMessage("Appelle-moi au 06 12 34 56 78")).toContain("phone_number");
    expect(analyzeMessage("mon numéro +213 5 55 12 34 56")).toContain("phone_number");
    expect(analyzeMessage("écris à moi@exemple.fr")).toContain("email_address");
    expect(analyzeMessage("Je préfère un virement, envoie ton IBAN")).toContain("off_platform_payment");
    expect(analyzeMessage("paiement Western Union possible")).toContain("off_platform_payment");
    expect(analyzeMessage("donne-moi le code de vérification reçu par SMS")).toContain("credential_request");
  });
  it("message ordinaire sans signal", () => {
    const flags = analyzeMessage("Bonjour, l'article est-il toujours disponible ? Je peux passer samedi.");
    expect(flags).toEqual([]);
    expect(requiresRecipientWarning(flags)).toBe(false);
  });
});

describe("permissions", () => {
  it("le support n'a pas les droits financiers", () => {
    expect(hasPermission(["SUPPORT"], "disputes.manage")).toBe(true);
    expect(hasPermission(["SUPPORT"], "payments.refund")).toBe(false);
    expect(hasPermission(["SUPPORT"], "fees.write")).toBe(false);
  });
  it("la finance ne modère pas", () => {
    expect(hasPermission(["FINANCE"], "payments.refund")).toBe(true);
    expect(hasPermission(["FINANCE"], "listings.moderate")).toBe(false);
  });
  it("un utilisateur sans rôle n'a aucun accès au back-office", () => expect(permissionsFor([]).size).toBe(0));
  it("seul un super-administrateur peut nommer des administrateurs ou modifier la conformité", () => {
    expect(assignableRoles(["ADMIN"])).not.toContain("ADMIN");
    expect(assignableRoles(["SUPER_ADMIN"])).toContain("ADMIN");
    expect(hasPermission(["ADMIN"], "compliance.write")).toBe(false);
    expect(hasPermission(["SUPER_ADMIN"], "compliance.write")).toBe(true);
  });
});
