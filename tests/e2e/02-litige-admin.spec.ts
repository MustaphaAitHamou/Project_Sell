import { expect, test } from "@playwright/test";
import { ACCOUNTS, buyHandDelivery, newSession, orderIdFromUrl, sql } from "./helpers";

/** Scénario 5 — un administrateur gère un litige jusqu'au remboursement (simulé). */
test("Scénario 5 — un administrateur tranche un litige et l'acheteur est remboursé", async ({ browser }) => {
  const buyer = await newSession(browser, ACCOUNTS.kamel);
  const orderUrl = await buyHandDelivery(buyer, "Veste en jean taille M");
  const orderId = orderIdFromUrl(orderUrl);
  const code = (await buyer.getByTestId("handover-code").textContent())!.trim();

  const seller = await newSession(browser, ACCOUNTS.lina);
  await seller.goto(orderUrl);
  await seller.getByLabel("Code de remise communiqué par l'acheteur").fill(code);
  await seller.getByRole("button", { name: "Confirmer la remise" }).click();
  await expect(seller.getByText("Reçue — période de vérification").first()).toBeVisible();

  await buyer.goto(`${orderUrl}/litige`);
  await buyer.selectOption("#d-reason", "NOT_AS_DESCRIBED");
  await buyer.getByLabel("Décrivez le problème").fill("La veste présente une déchirure à la manche qui n'était pas visible sur les photos.");
  await buyer.getByRole("button", { name: "Ouvrir le litige" }).click();
  await expect(buyer.getByText("En attente du vendeur")).toBeVisible();

  const admin = await newSession(browser, ACCOUNTS.admin, "/admin/litiges");
  await admin.goto("/admin/litiges");
  const [ref] = await sql<{ reference: string }>(`SELECT reference FROM orders WHERE id = $1`, [orderId]);
  await admin.getByRole("link", { name: ref!.reference }).click();
  await expect(admin.getByRole("heading", { name: `Litige — ${ref!.reference}` })).toBeVisible();
  await admin.getByLabel(/Remboursement intégral/).check();
  await admin.getByLabel("Motivation de la décision (visible des deux parties)").fill("Déchirure confirmée par les photos ; défaut non mentionné dans l'annonce.");
  await admin.getByRole("button", { name: "Enregistrer la décision" }).click();
  await expect(admin.getByText("Décision rendue").first()).toBeVisible();

  // Le remboursement est exécuté par la file de tâches (prestataire simulé).
  await expect(async () => {
    const [o] = await sql<{ status: string }>(`SELECT status FROM orders WHERE id = $1`, [orderId]);
    expect(o!.status).toBe("REFUNDED");
  }).toPass({ timeout: 30_000 });
  const [refund] = await sql<{ amount: number; status: string }>(`SELECT amount, status FROM refund WHERE "orderId" = $1`, [orderId]);
  expect(refund).toMatchObject({ status: "SUCCEEDED" });
  const [audit] = await sql<{ n: string }>(`SELECT count(*) AS n FROM audit_log WHERE action = 'dispute.staff_view' AND "actorId" IS NOT NULL`);
  expect(Number(audit!.n)).toBeGreaterThan(0);
});

test("Le support n'a pas accès aux paiements ni à la configuration", async ({ browser }) => {
  const support = await newSession(browser, ACCOUNTS.support, "/admin");
  await support.goto("/admin");
  await expect(support.getByRole("link", { name: "Litiges", exact: true })).toBeVisible();
  await expect(support.getByRole("link", { name: "Paiements", exact: true })).toHaveCount(0);
  for (const section of ["/admin/paiements", "/admin/configuration", "/admin/statistiques"]) {
    await support.goto(section);
    await expect(support).toHaveURL(/\/admin\?erreur=permission/);
    await expect(support.getByText("Accès refusé")).toBeVisible();
    await expect(support.getByText("Registre comptable")).toHaveCount(0);
  }
});
