import path from "node:path";
import { expect, test } from "@playwright/test";
import { ACCOUNTS, login, newSession, openListing, orderIdFromUrl, sql } from "./helpers";

/**
 * Scénarios 1, 2, 3, 4, 7 et 9 : inscription et publication, favori, commande de test
 * (avec tentative de falsification du prix), consultation de la vente, webhook rejoué.
 */
test.describe.serial("Parcours de vente complet", () => {
  const stamp = Date.now().toString(36);
  const email = `vendeuse.${stamp}@exemple.test`;
  const title = `Lampe artisanale en céramique ${stamp}`;
  let orderUrl = "";

  test("Scénario 1 — un utilisateur s'inscrit et publie un produit", async ({ page }) => {
    await page.goto("/inscription");
    await page.getByLabel("Pseudonyme public").fill(`Vendeuse ${stamp}`);
    await page.getByLabel("Adresse email").fill(email);
    await page.getByLabel("Mot de passe").fill("MotDePasse2026!");
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await page.waitForURL(/verification/);

    // Aucun e-mail réel : lecture de la boîte simulée.
    await expect(async () => {
      await page.goto(`/dev/boite-mail?to=${encodeURIComponent(email)}`);
      await expect(page.locator("a", { hasText: "/api/auth/verify-email" }).first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    const link = await page.locator("a", { hasText: "/api/auth/verify-email" }).first().getAttribute("href");
    await page.goto(link!);
    await page.getByLabel("Adresse de votre profil").fill(`vendeuse-${stamp}`);
    await page.selectOption("#loc-region", { label: "13 — Bouches-du-Rhône" });
    await page.getByLabel("Ville").fill("Marseille");
    await page.getByRole("button", { name: "Terminer" }).click();
    await page.waitForURL(/compte/);

    await page.goto("/vendre/nouvelle-annonce");
    await page.locator('input[type="file"]').setInputFiles(path.join(import.meta.dirname, "fixtures/photo.jpg"));
    await expect(page.locator('img[alt="Photo 1"]')).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Suivant" }).click();
    await page.getByLabel("Titre").fill(title);
    await page.getByLabel("Description").fill("Lampe en céramique émaillée faite main, abat-jour en lin naturel. Parfait état de fonctionnement.");
    await page.selectOption("#category", { label: "Décoration" });
    await page.selectOption("#condition", { label: "Très bon état" });
    await page.getByLabel(/Prix/).fill("24,90");
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Suivant" }).click();
    await page.getByRole("button", { name: "Publier l'annonce" }).click();
    await page.waitForURL(/\/produit\//);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    // La photo stockée est ré-encodée, sans métadonnées (EXIF/GPS).
    const [img] = await sql<{ id: string }>(`SELECT i.id FROM listing_image i JOIN listing l ON l.id = i."listingId" WHERE l.title = $1`, [title]);
    const res = await page.request.get(`/api/images/${img!.id}/large`);
    expect(res.headers()["content-type"]).toBe("image/webp");
    expect((await res.body()).includes(Buffer.from("Exif"))).toBe(false);
  });

  test("Scénario 2 — un acheteur trouve le produit et le met en favoris", async ({ page }) => {
    await login(page, ACCOUNTS.kamel);
    await openListing(page, title);
    // Bouton principal de la fiche (libellé visible), distinct de ceux des annonces similaires.
    await page.locator("button[aria-pressed]", { hasText: "Ajouter aux favoris" }).click();
    await expect(page.locator("button[aria-pressed]", { hasText: "Retirer des favoris" })).toBeVisible();
    await expect(page.getByText("Ajouté à vos favoris")).toBeVisible();
    await page.goto("/compte/favoris");
    await expect(page.getByRole("link", { name: title }).first()).toBeVisible();
  });

  test("Scénarios 3 et 7 — commande de test ; un prix modifié côté client est ignoré", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await login(page, ACCOUNTS.kamel);
    await openListing(page, title);
    await page.getByRole("link", { name: "Acheter" }).click();
    await page.waitForURL(/\/commander\//);
    await expect(page.getByTestId("checkout-total")).toContainText("27,39");

    // Falsification : total affiché modifié dans le DOM et montants injectés dans la requête.
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="checkout-total"]');
      if (el) el.textContent = "1,00 €";
    });
    await page.route("**/commander/**", async (route) => {
      const req = route.request();
      if (req.method() === "POST" && req.headers()["next-action"]) {
        const body = req.postData() ?? "";
        const forged = body.replace('"listingId"', '"totalAmount":100,"buyerFee":0,"priceAmount":100,"listingId"');
        return route.continue({ postData: forged });
      }
      return route.continue();
    });
    await page.getByRole("button", { name: /Payer/ }).click();
    await page.waitForURL(/\/dev\/paiement\//);
    // Le montant à payer est celui calculé par le serveur : 24,90 € + 10 % = 27,39 €.
    await expect(page.getByTestId("sandbox-amount")).toContainText("27,39");
    await page.getByRole("button", { name: "Payer (succès simulé)" }).click();
    await page.waitForURL(/\/commande\/[0-9a-f-]+\?paiement=ok/);
    orderUrl = page.url().split("?")[0]!;
    await expect(page.getByTestId("handover-code")).toHaveText(/^\s*\d{6}\s*$/);

    const [order] = await sql<{ totalAmount: number; buyerFee: number }>(`SELECT "totalAmount", "buyerFee" FROM orders WHERE id = $1`, [orderIdFromUrl(orderUrl)]);
    expect(order).toMatchObject({ totalAmount: 2739, buyerFee: 249 });
  });

  test("Scénario 9 — un webhook rejoué ne duplique aucune transaction financière", async ({ page }) => {
    await login(page, ACCOUNTS.kamel);
    const orderId = orderIdFromUrl(orderUrl);
    const [payment] = await sql<{ providerSessionId: string }>(`SELECT "providerSessionId" FROM payment WHERE "orderId" = $1`, [orderId]);
    await page.goto(`/dev/paiement/${payment!.providerSessionId}`);
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: /Rejouer le dernier webhook/ }).click();
      await page.waitForTimeout(400);
    }
    const ledger = await sql<{ kind: string; n: string }>(`SELECT kind, count(*) AS n FROM ledger_transaction WHERE "orderId" = $1 GROUP BY kind`, [orderId]);
    expect(Object.fromEntries(ledger.map((l) => [l.kind, Number(l.n)]))).toMatchObject({ PAYMENT_CAPTURED: 1, PSP_FEE: 1 });
    const [paid] = await sql<{ n: string }>(`SELECT count(*) AS n FROM order_status_history WHERE "orderId" = $1 AND "toStatus" = 'PAID'`, [orderId]);
    expect(Number(paid!.n)).toBe(1);
    const [balance] = await sql<{ b: string | null }>(`SELECT SUM(CASE WHEN direction = 'DEBIT' THEN amount ELSE -amount END) AS b FROM ledger_entry`);
    expect(Number(balance!.b ?? 0)).toBe(0);
  });

  test("Scénario 4 — le vendeur consulte sa vente", async ({ browser }) => {
    const seller = await newSession(browser, email, "/compte", "MotDePasse2026!");
    await seller.goto("/compte/ventes");
    await expect(seller.getByText(title).first()).toBeVisible();
    await seller.goto(orderUrl);
    await expect(seller.getByLabel("Code de remise communiqué par l'acheteur")).toBeVisible();
    // L'adresse et le téléphone personnels de l'acheteur ne sont jamais affichés en remise en main propre.
    await expect(seller.getByText("+33")).toHaveCount(0);
  });
});
