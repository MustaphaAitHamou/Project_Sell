import { expect, test } from "@playwright/test";
import { ACCOUNTS, newSession, openListing, sql } from "./helpers";

const TITLE = "Console PS5 édition standard + 2 manettes";

test.describe.serial("Tamurt Transport (simulateur)", () => {
  test("Scénario 6 — devis France → Algérie simulé, sans transaction réelle possible", async ({ browser }) => {
    const page = await newSession(browser, ACCOUNTS.kamel);
    await openListing(page, TITLE);
    await page.getByRole("button", { name: "Estimer le transport" }).click();
    await expect(page.getByText("Simulation — trajets et voyageurs fictifs")).toBeVisible();
    await expect(page.getByText("Achat avec Tamurt Transport non disponible pour le moment")).toBeVisible();
    await expect(page.getByText(/test uniquement/)).toBeVisible();
    const [n] = await sql<{ n: string }>(`SELECT count(*) AS n FROM transport_reservation`);
    expect(Number(n!.n)).toBe(0);
  });

  test("Scénario 10 — Tamurt Transport indisponible : Market reste utilisable", async ({ browser }) => {
    const admin = await newSession(browser, ACCOUNTS.admin, "/dev/transport");
    await admin.goto("/dev/transport");
    await admin.getByRole("button", { name: "Simuler une panne (503)" }).click();
    await expect(admin.getByRole("button", { name: "Simuler une panne (503)" })).toHaveClass(/bg-primary/);
    try {
      const page = await newSession(browser, ACCOUNTS.kamel);
      await openListing(page, TITLE);
      await page.getByRole("button", { name: "Estimer le transport" }).click();
      await expect(page.getByText("Tamurt Transport indisponible")).toBeVisible();
      // Les autres modes de remise et la navigation restent disponibles.
      await expect(page.getByRole("link", { name: "Acheter" })).toBeVisible();
      await page.getByRole("link", { name: "Acheter" }).click();
      await page.waitForURL(/\/commander\//);
      await expect(page.getByTestId("checkout-total")).toBeVisible();
      await page.goto("/explorer");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    } finally {
      await admin.goto("/dev/transport");
      await admin.getByRole("button", { name: "Fonctionnement normal" }).click();
    }
  });
});
