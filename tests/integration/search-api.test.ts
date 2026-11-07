import { beforeAll, describe, expect, it } from "vitest";
import { GET as getListing } from "@/app/api/v1/listings/[publicId]/route";
import { GET as searchApi } from "@/app/api/v1/listings/route";
import { GET as hqMetrics } from "@/app/api/internal/hq/v1/metrics/route";
import { db } from "@/server/db/client";
import { sha256Hex } from "@/server/security/crypto";
import { parseSearchParams, searchListings } from "@/server/services/search";
import { makeListing, makeUser } from "./helpers";

const search = async (q: string, extra: Record<string, string> = {}) => (await searchListings(parseSearchParams({ q, ...extra }), { track: false })).items.map((i) => i.title);

describe("Recherche plein texte PostgreSQL", () => {
  beforeAll(async () => {
    const seller = await makeUser();
    const dzSeller = await makeUser({ country: "DZ" });
    await makeListing(seller, { title: "Lampe en céramique verte", price: 2490 });
    await makeListing(seller, { title: "Lampes de bureau articulées", price: 3500 });
    await makeListing(seller, { title: "Console PlayStation 5 avec manettes", price: 38_000, categorySlug: "consoles", brandName: "Sony" });
    await makeListing(dzSeller, { country: "DZ", title: "Burnous traditionnel en laine", price: 1_500_000, regionCode: "06", cityName: "Béjaïa", categorySlug: "artisanat" }).catch(() =>
      makeListing(dzSeller, { country: "DZ", title: "Burnous traditionnel en laine", price: 1_500_000, regionCode: "06", cityName: "Béjaïa" }),
    );
  });

  it("ignore les accents et la casse", async () => {
    expect(await search("CERAMIQUE")).toContain("Lampe en céramique verte");
  });

  it("racinise le français (singulier/pluriel)", async () => {
    const r = await search("lampe");
    expect(r).toEqual(expect.arrayContaining(["Lampe en céramique verte", "Lampes de bureau articulées"]));
  });

  it("combine les mots en ET", async () => {
    expect(await search("lampe verte")).toEqual(["Lampe en céramique verte"]);
  });

  it("tolère une faute de frappe (similarité trigramme)", async () => {
    expect(await search("playstaton")).toContain("Console PlayStation 5 avec manettes");
  });

  it("trouve par la graphie kabyle d'une ville (bgayet → Béjaïa)", async () => {
    expect(await search("bgayet")).toContain("Burnous traditionnel en laine");
  });

  it("filtre par pays et prix dans la devise du pays", async () => {
    expect(await search("lampe", { pays: "FR", prix_max: "30" })).toEqual(["Lampe en céramique verte"]);
    expect(await search("burnous", { pays: "FR" })).toEqual([]);
  });

  it("n'expose pas les annonces suspendues", async () => {
    await db.listing.updateMany({ where: { title: "Lampes de bureau articulées" }, data: { status: "SUSPENDED" } });
    expect(await search("lampe")).not.toContain("Lampes de bureau articulées");
  });
});

describe("API publique v1 : aucune donnée privée", () => {
  it("la fiche ne contient ni identifiant interne, ni e-mail, ni coordonnées", async () => {
    const seller = await makeUser();
    await db.userContact.create({ data: { userId: seller.id, phone: "+33612345678" } }).catch(() => undefined);
    const l = await makeListing(seller, { title: "Table basse en chêne" });
    const res = await getListing(new Request(`http://test/api/v1/listings/${l.publicId}`), { params: Promise.resolve({ publicId: l.publicId }) });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("Table basse en chêne");
    for (const secret of [seller.id, seller.email, l.id, "+33612345678", "sellerId", "moderationNote"]) expect(text).not.toContain(secret);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("une annonce non publique est introuvable", async () => {
    const seller = await makeUser();
    const l = await makeListing(seller);
    await db.listing.update({ where: { id: l.id }, data: { status: "PENDING_REVIEW" } });
    const res = await getListing(new Request(`http://test/api/v1/listings/${l.publicId}`), { params: Promise.resolve({ publicId: l.publicId }) });
    expect(res.status).toBe(404);
  });

  it("la recherche via l'API borne la pagination", async () => {
    const res = await searchApi(new Request("http://test/api/v1/listings?q=lampe&page=9999"), { params: Promise.resolve({}) });
    const body = (await res.json()) as { page: number };
    expect(body.page).toBe(50);
  });
});

describe("API interne Tamurt HQ", () => {
  it("exige un jeton valide, non révoqué, avec la bonne portée", async () => {
    const admin = await makeUser({ roles: ["SUPER_ADMIN"] });
    const token = `tmhq_${"a".repeat(12)}${crypto.randomUUID().replace(/-/g, "")}`;
    const client = await db.serviceApiClient.create({ data: { name: "HQ test", tokenHash: sha256Hex(token), tokenPrefix: token.slice(0, 10), scopes: ["metrics:read"], allowedIps: [], createdById: admin.id } });
    const call = (t?: string) => hqMetrics(new Request("http://test/api/internal/hq/v1/metrics", { headers: t ? { authorization: `Bearer ${t}` } : {} }));
    expect((await call()).status).toBe(401);
    expect((await call("tmhq_invalide_invalide_invalide")).status).toBe(401);
    const ok = await call(token);
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { environment: string; users: { total: number } };
    expect(body.environment).toBe("simulation");
    expect(JSON.stringify(body)).not.toContain(admin.email);
    await db.serviceApiClient.update({ where: { id: client.id }, data: { scopes: [] } });
    expect((await call(token)).status).toBe(403);
    await db.serviceApiClient.update({ where: { id: client.id }, data: { scopes: ["metrics:read"], revokedAt: new Date() } });
    expect((await call(token)).status).toBe(401);
  });
});
