-- Le code de remise en main propre est dérivé (HMAC + poivre serveur + sel par commande) :
-- la colonne contient désormais le sel, jamais le code ni son empreinte réutilisable.
ALTER TABLE "orders" RENAME COLUMN "handoverCodeHash" TO "handoverSalt";
ALTER TABLE "orders" ALTER COLUMN "handoverSalt" TYPE VARCHAR(64);
