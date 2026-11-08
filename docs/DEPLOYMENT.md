# Déploiement

> **Aucun déploiement public n'a été effectué.** Ce document décrit la cible proposée et la procédure ; chaque étape impliquant un service payant, une infrastructure de production ou une ouverture au public doit être validée au préalable.

## Architecture cible proposée

| Composant | Exigence | Options (à comparer) |
| --- | --- | --- |
| Application Next.js (Node.js 22) | Exécution Node (Sharp, Prisma, `after()`), plusieurs instances possibles | Vercel, Scaleway Serverless Containers, Render, Fly.io, VPS avec conteneur |
| PostgreSQL 16 | Extensions `unaccent`, `pg_trgm`, `citext` ; sauvegardes PITR ; hébergement UE | Scaleway, Neon, Supabase (PostgreSQL seul), AWS RDS |
| Stockage d'objets | API S3, privé, hébergement UE | Scaleway Object Storage, Cloudflare R2, AWS S3 |
| E-mails transactionnels | Domaine authentifié (SPF, DKIM, DMARC) | Resend (adaptateur prévu), Brevo, Postmark |
| Tâches planifiées | Appels HTTP authentifiés chaque minute / 5 à 15 min | Cron de l'hébergeur, GitHub Actions planifiées, service cron externe |
| Supervision | Erreurs, disponibilité, alertes | Sentry (réservé), sonde `/api/health` |

Les données des membres français doivent rester dans l'UE ; un éventuel hébergement de données d'utilisateurs algériens relève de la loi n° 18-07 (à instruire).

## Variables d'environnement

Référence complète et commentée : [`.env.example`](../.env.example). Validation au démarrage par [`src/lib/env.ts`](../src/lib/env.ts) ; **en production, l'application refuse de démarrer** avec `PAYMENT_PROVIDER=sandbox`, `SHIPPING_PROVIDER=sandbox`, `TRANSPORT_INTEGRATION=simulator`, `EMAIL_PROVIDER=outbox`, `STORAGE_DRIVER=local` ou `ADMIN_REQUIRE_2FA=false` (seules la boîte e-mail simulée et le stockage local admettent une dérogation explicite, `ALLOW_OUTBOX_EMAIL_IN_PRODUCTION` / `ALLOW_LOCAL_STORAGE_IN_PRODUCTION`, réservée à un essai privé).

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | PostgreSQL (TLS obligatoire en production) |
| `APP_URL`, `BETTER_AUTH_URL` | URL publique |
| `BETTER_AUTH_SECRET`, `CRON_SECRET`, `CODE_PEPPER` | Secrets (≥ 32 caractères aléatoires) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Connexion Google (facultative) |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM` | E-mails |
| `PAYMENT_PROVIDER` | `none` tant qu'aucun prestataire réel n'est intégré (achat intégré désactivé) |
| `SHIPPING_PROVIDER` | `none` tant qu'aucun transporteur n'est contractualisé |
| `TRANSPORT_INTEGRATION`, `TRANSPORT_API_BASE_URL`, `TRANSPORT_CLIENT_ID`, `TRANSPORT_CLIENT_SECRET`, `TRANSPORT_WEBHOOK_SECRET`, `TRANSPORT_TIMEOUT_MS` | Tamurt Transport (`disabled` tant que l'API n'existe pas) |
| `STORAGE_DRIVER=s3`, `S3_*` | Stockage d'objets |
| `ADMIN_REQUIRE_2FA` | Toujours actif en production |
| `LOG_LEVEL` | Niveau de journalisation |

Les secrets sont injectés par le gestionnaire de secrets de l'hébergeur, jamais versionnés.

## Procédure

1. Créer la base (rôle applicatif sans droits de superutilisateur ; extensions créées une fois par un administrateur de la base).
2. `pnpm install --frozen-lockfile` puis `pnpm build`.
3. `pnpm db:deploy` (migrations) — jamais `db:migrate` en production.
4. `pnpm db:seed` (référentiels uniquement ; **sans** `SEED_DEMO`).
5. Démarrer `pnpm start` derrière HTTPS ; vérifier `/api/health`.
6. Planifier `POST /api/cron/jobs` (chaque minute) et `POST /api/cron/maintenance` (toutes les 5 à 15 min) avec `Authorization: Bearer $CRON_SECRET`.
7. Créer le premier super-administrateur (attribution du rôle `SUPER_ADMIN` en base par une personne habilitée), qui active sa double authentification.
8. Configurer pays, frais, catégories et conformité en administration ; enregistrer les validations obtenues.

## Mode de lancement recommandé

Lancement progressif, sans achat intégré tant que le prestataire de paiement n'est pas contractualisé : `PAYMENT_PROVIDER=none`, `SHIPPING_PROVIDER=none`, `TRANSPORT_INTEGRATION=disabled`. La marketplace fonctionne alors en **petites annonces** (publication, recherche, messagerie, remise en main propre convenue entre membres), avec un affichage honnête de l'état du service.

## Liste de contrôle avant ouverture publique

- [ ] Documents juridiques validés, mentions légales complétées, médiateur désigné ([COMPLIANCE](COMPLIANCE.md))
- [ ] Prestataire de paiement contractualisé et intégré en mode test puis réel ([PAYMENTS](PAYMENTS.md))
- [ ] Domaine e-mail authentifié ; modèles d'e-mails relus
- [ ] Sauvegardes et test de restauration ; supervision et alertes
- [ ] Test d'intrusion ; revue des en-têtes et de la CSP sur le domaine final ([SECURITY](SECURITY.md))
- [ ] Charge : test de la recherche et du paiement sur un volume réaliste
- [ ] `robots.txt` : l'indexation s'active automatiquement en production sans simulateurs ; vérifier les sitemaps
- [ ] Aucune donnée de démonstration en base
