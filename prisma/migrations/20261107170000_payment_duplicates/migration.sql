-- Un paiement réussi en double (double soumission, paiement arrivé après expiration de la
-- réservation) est enregistré pour être remboursé automatiquement ; il est exclu de la
-- garantie « un seul paiement effectif par commande ».
ALTER TABLE "payment" ADD COLUMN "isDuplicate" BOOLEAN NOT NULL DEFAULT false;
DROP INDEX "payment_one_success_per_order";
CREATE UNIQUE INDEX "payment_one_success_per_order" ON "payment" ("orderId") WHERE "status" = 'SUCCEEDED' AND NOT "isDuplicate";
