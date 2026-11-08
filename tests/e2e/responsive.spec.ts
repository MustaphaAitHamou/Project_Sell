import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll } from "./helpers";

/** Mobile (Pixel 7) : pas de défilement horizontal, barre d'onglets, recherche utilisable. */
for (const path of ["/", "/explorer", "/recherche?q=robe", "/categories", "/comment-ca-marche", "/conditions", "/connexion", "/inscription"]) {
  test(`mobile — ${path}`, async ({ page }) => {
    await page.goto(path);
    await expectNoHorizontalScroll(page);
  });
}

test("mobile — fiche produit et barre d'onglets", async ({ page }) => {
  await page.goto("/recherche?q=robe");
  await page.locator('a[href*="/produit/"]').first().click();
  await page.waitForURL(/\/produit\//);
  await expectNoHorizontalScroll(page);
  await expect(page.getByRole("navigation").filter({ hasText: "Vendre" }).last()).toBeVisible();
});
