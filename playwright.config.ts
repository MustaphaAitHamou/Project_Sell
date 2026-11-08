import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

/**
 * Tests de bout en bout (scénarios 1 à 10 du cahier des charges, accessibilité, responsive).
 * Exécution séquentielle : une seule base de données E2E, recréée par tests/e2e/serve.mjs.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never", outputFolder: "playwright-report" }]] : [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", locale: "fr-FR", timezoneId: "Europe/Paris", actionTimeout: 20_000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /responsive\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive\.spec/ },
  ],
  webServer: {
    command: "node tests/e2e/serve.mjs",
    url: `http://localhost:${PORT}/api/health`,
    timeout: 900_000,
    reuseExistingServer: !process.env.CI && process.env.E2E_REUSE === "true",
    stdout: "pipe",
    stderr: "pipe",
  },
});
