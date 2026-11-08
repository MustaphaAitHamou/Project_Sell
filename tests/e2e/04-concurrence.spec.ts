import { expect, test } from "@playwright/test";
import { ACCOUNTS, newSession, openListing, sql } from "./helpers";

/** Scénario 8 — deux acheteurs, un exemplaire unique : une seule commande. */
test("Scénario 8 — achat simultané de l'unique exemplaire", async ({ browser }) => {
  const title = "Robe d'été en lin, taille S";
  const [a, b] = await Promise.all([newSession(browser, ACCOUNTS.kamel), newSession(browser, ACCOUNTS.yanis)]);
  for (const p of [a, b]) {
    await openListing(p, title);
    await p.getByRole("link", { name: "Acheter" }).click();
    await p.waitForURL(/\/commander\//);
  }
  await Promise.all([a.getByRole("button", { name: /Payer/ }).click(), b.getByRole("button", { name: /Payer/ }).click()]);
  await Promise.all([a.waitForLoadState("networkidle"), b.waitForLoadState("networkidle")]);
  await expect(async () => {
    const urls = [a.url(), b.url()];
    expect(urls.filter((u) => u.includes("/dev/paiement/"))).toHaveLength(1);
  }).toPass({ timeout: 20_000 });
  const loser = a.url().includes("/dev/paiement/") ? b : a;
  await expect(loser.getByText(/vient d'être réservé ou vendu|n'est plus disponible/).first()).toBeVisible();
  const [n] = await sql<{ n: string }>(`SELECT count(*) AS n FROM orders o JOIN listing l ON l.id = o."listingId" WHERE l.title = $1`, [title]);
  expect(Number(n!.n)).toBe(1);
});
