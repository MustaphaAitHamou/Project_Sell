import { expect, type Browser, type Page } from "@playwright/test";
import pg from "pg";
import { e2eEnv } from "./env.mjs";

export const DEMO_PASSWORD = "DemoMarket2026!";
export const ACCOUNTS = {
  admin: "admin@demo.tamurt.local",
  support: "support@demo.tamurt.local",
  kamel: "acheteur@demo.tamurt.local",
  yanis: "yanis@demo.tamurt.local",
  lina: "lina@demo.tamurt.local",
  vinyles: "vinyles@demo.tamurt.local",
} as const;

/** Requêtes de vérification directes sur la base E2E (lecture seule dans les assertions). */
export async function sql<T extends Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: e2eEnv().DATABASE_URL.split("?")[0] });
  await client.connect();
  try {
    return (await client.query(text, params)).rows as T[];
  } finally {
    await client.end();
  }
}

export async function login(page: Page, email: string, next = "/compte", password = DEMO_PASSWORD) {
  await page.goto(`/connexion?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Adresse email").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 30_000 });
}

export async function newSession(browser: Browser, email: string, next?: string, password?: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("dialog", (d) => d.accept());
  await login(page, email, next, password);
  return page;
}

export async function openListing(page: Page, title: string) {
  await page.goto(`/recherche?q=${encodeURIComponent(title)}`);
  await page.getByRole("link", { name: title }).first().click();
  await page.waitForURL(/\/produit\//);
  await page.waitForLoadState("networkidle"); // page hydratée avant toute interaction
}

/** Achat en remise en main propre jusqu'au paiement simulé ; renvoie l'URL de la commande. */
export async function buyHandDelivery(page: Page, title: string) {
  await openListing(page, title);
  await page.getByRole("link", { name: "Acheter" }).click();
  await page.waitForURL(/\/commander\//);
  await page.getByRole("button", { name: /Payer/ }).click();
  await page.waitForURL(/\/dev\/paiement\//, { timeout: 30_000 });
  await page.getByRole("button", { name: "Payer (succès simulé)" }).click();
  await page.waitForURL(/\/commande\/[0-9a-f-]+\?paiement=ok/, { timeout: 30_000 });
  return page.url().split("?")[0]!;
}

export const orderIdFromUrl = (url: string) => url.match(/commande\/([0-9a-f-]{36})/)![1]!;

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}
