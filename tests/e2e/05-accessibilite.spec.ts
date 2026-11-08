import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Accessibilité (WCAG 2.1 AA via axe-core) : aucune violation grave ou critique. */
const PAGES = ["/", "/explorer", "/recherche?q=console", "/categories", "/connexion", "/inscription", "/comment-ca-marche", "/protection-acheteur", "/centre-aide", "/vendre"];

for (const path of PAGES) {
  test(`axe — ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
  });
}

test("axe — fiche produit", async ({ page }) => {
  await page.goto("/recherche?q=vinyle");
  await page.locator('a[href*="/produit/"]').first().click();
  await page.waitForURL(/\/produit\//);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
});

test("navigation au clavier : lien d'évitement et focus visible", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Aller au contenu principal" });
  await expect(skip).toBeFocused();
});

test.describe("thème sombre", () => {
  test.use({ colorScheme: "dark" });
  for (const path of ["/", "/comment-ca-marche", "/connexion"]) {
    test(`axe (sombre) — ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
    });
  }
});
