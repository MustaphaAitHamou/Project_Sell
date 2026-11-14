# Tamurt Market

Marketplace C2C/B2C de l'écosystème **Tamurt Services** (France, Algérie, diaspora), conçue pour s'intégrer nativement à **Tamurt Transport** (envoi collaboratif France ⇄ Algérie) tout en restant pleinement utilisable sans lui.

> **État réel (novembre 2026)** — Application fonctionnelle de bout en bout **en environnement de développement et de test**, avec des données persistées dans PostgreSQL. Les paiements, versements, étiquettes de livraison et Tamurt Transport sont **simulés** : aucune transaction réelle n'est possible. Aucun déploiement public n'a été effectué. Les textes juridiques sont des modèles **à faire valider** par des professionnels.

## Identité visuelle
Tamurt Market suit la DA de la famille **Tamurt Services** (slogan : « Le marché dans la poche ») :
- **Couleur** : jaune miel `#f6a609` en aplat avec un texte encre `#2b1d00`. Le texte de marque passe en ocre `#8a5300` (`#f8ba3c` en sombre), car le miel n'est pas lisible en texte sur fond clair. Les neutres chauds sont communs à la famille ; la terre cuite reste en accent ponctuel ; le rouge Tamurt est réservé au bouton yaz.
- **Police** : Montserrat pour tout, titres en 800, boutons en 700.
- **Formes** : boutons à coins de 12 px avec liseré ocre, champs et puces à 10 px, cartes à 14 px, frise « damier » sous l'accueil.
- **Fichiers** : logos dans `public/brand`, icônes PWA dans `public/icons`, `src/app/icon.svg` et `src/app/apple-icon.png` ; jetons dans `src/app/globals.css`. Décision : ADR-020 (docs/DECISIONS.md).

## Ce qui fonctionne (vérifié par des tests)

| Domaine | État | Détail |
| --- | --- | --- |
| Comptes | Opérationnel | Inscription, vérification d'e-mail (boîte simulée), connexion, mot de passe oublié, double authentification (TOTP), profil public, vendeur professionnel, suppression avec anonymisation |
| Annonces | Opérationnel | Publication en 5 étapes, photos ré-encodées sans métadonnées (EXIF/GPS), modération humaine des catégories sensibles, cycle de vie complet, révisions |
| Recherche | Opérationnel | Plein texte PostgreSQL (français + forme exacte, sans accents), tolérance aux fautes (trigrammes), graphies kabyles/latinisées des villes, filtres, tri, pagination, SEO |
| Messagerie | Opérationnel | Conversations par annonce, coordonnées masquées, détection d'arnaques, blocage, signalement, pièces jointes |
| Commandes | Opérationnel (paiement simulé) | Prix et commission calculés côté serveur, réservation de l'exemplaire, remise en main propre par code, période de vérification, clôture, avis |
| Paiements | **Simulé** | Abstraction de prestataire, webhooks signés et idempotents, registre comptable en partie double, remboursements, versements, doublons |
| Litiges | Opérationnel (remboursement simulé) | Ouverture, preuves privées, échanges, décision motivée du support, plafonds par rôle |
| Tamurt Transport | **Simulé** | Contrat d'API v1 proposé, client résilient (OAuth, idempotence, disjoncteur), simulateur, saga blocage → confirmation → compensation |
| Administration | Opérationnel | Tableau de bord (GMV ≠ chiffre d'affaires ≠ revenu net), modération, utilisateurs, litiges, paiements, transport, statistiques, configuration, audit |
| API | Opérationnel | API publique v1 en lecture, API interne Tamurt HQ (jetons de service), spécifications OpenAPI 3.1 générées |

Le détail de ce qui est simulé, en attente ou à valider est dans [`docs/ROADMAP.md`](docs/ROADMAP.md) et la page « État du service » de l'application (`/comment-ca-marche#etat-du-service`).

## Démarrage

Prérequis : Node.js ≥ 22.12, pnpm 10, PostgreSQL 16 (extensions `unaccent`, `pg_trgm`, `citext` créées par les migrations : rôle avec droit `CREATE EXTENSION` en développement).

```bash
pnpm install
```

```bash
cp .env.example .env
```

Renseignez `DATABASE_URL` et générez les secrets (`openssl rand -base64 48`) pour `BETTER_AUTH_SECRET`, `CRON_SECRET`, `CODE_PEPPER` et les secrets de webhooks simulés.

```bash
pnpm db:deploy
```

```bash
SEED_DEMO=true pnpm db:seed
```

```bash
pnpm dev
```

Sans `SEED_DEMO`, seuls les référentiels (pays, 58 wilayas, 101 départements, villes, catégories, règles de conformité, frais) sont créés.

### Comptes de démonstration (fictifs)

Mot de passe commun : `DemoMarket2026!` — domaine `@demo.tamurt.local` (aucun e-mail n'est envoyé).

| Compte | Rôle |
| --- | --- |
| `admin@demo.tamurt.local` | Super-administrateur |
| `moderation@`, `support@`, `finance@` | Modération, support, finance |
| `lina@`, `yanis@`, `tech@`, `vinyles@` | Vendeurs en France (`tech@` est professionnel) |
| `thiziri@`, `bgayet@` | Vendeurs en Algérie (mode petites annonces) |
| `acheteur@` (Kamel, France), `acheteuse@` (Sonia, Algérie) | Acheteurs |

### Outils de développement (désactivés en production)

- `/dev/boite-mail` — e-mails transactionnels interceptés (aucun envoi réel).
- `/dev/paiement/{session}` — prestataire de paiement simulé : succès, échec, rejeu de webhook.
- `/dev/transport` — simulateur Tamurt Transport : panne, lenteur, ouverture du corridor, événements de livraison.

## Commandes

| Commande | Rôle |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Développement, build et serveur de production |
| `pnpm lint` / `pnpm typecheck` / `pnpm format` | Qualité du code |
| `pnpm test:unit` | Tests unitaires (domaine pur) |
| `pnpm test:integration` | Tests d'intégration sur une base PostgreSQL de test dédiée |
| `pnpm test:e2e` | Tests de bout en bout Playwright (build de production, base E2E recréée) |
| `pnpm db:migrate` / `pnpm db:deploy` / `pnpm db:seed` / `pnpm db:drift` | Migrations, référentiels, contrôle de cohérence du schéma |
| `pnpm jobs:run` | Exécute la file de tâches (e-mails, remboursements, versements, Transport) |
| `pnpm openapi` | Régénère `docs/openapi/*.json` depuis les schémas Zod |

## Documentation

| Document | Contenu |
| --- | --- |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Monolithe modulaire, composants, flux, machines à états |
| [DATABASE](docs/DATABASE.md) | Modèle de données, contraintes, SQL manuel, migrations |
| [API](docs/API.md) | API publique v1, API Tamurt HQ, webhooks, tâches planifiées |
| [TRANSPORT_INTEGRATION](docs/TRANSPORT_INTEGRATION.md) | Contrat avec Tamurt Transport, saga, événements, matrice de dépendances |
| [PAYMENTS](docs/PAYMENTS.md) | Frais, registre comptable, prestataires (Stripe Connect, Algérie) |
| [SECURITY](docs/SECURITY.md) | Mesures en place, audit réalisé, limites |
| [COMPLIANCE](docs/COMPLIANCE.md) | Matrice de conformité, obligations France/UE et Algérie |
| [DEPLOYMENT](docs/DEPLOYMENT.md) | Mise en production (non réalisée), variables, tâches planifiées |
| [COSTS](docs/COSTS.md) | Estimation des coûts (à confirmer) |
| [ROADMAP](docs/ROADMAP.md) | Simulé, en attente, priorités |
| [TESTING](docs/TESTING.md) | Stratégie et résultats des tests |
| [DECISIONS](docs/DECISIONS.md) | Décisions d'architecture (ADR) |

## Règles non négociables

- Aucun prix transmis par le navigateur n'est utilisé : tout montant est recalculé côté serveur, en unités entières.
- Les restrictions de conformité « à vérifier » **bloquent** la transaction ; les achats internationaux restent fermés sans validation juridique enregistrée.
- Aucune donnée de carte bancaire ni copie de pièce d'identité n'est stockée ; téléphones et adresses ne sont jamais publics.
- Aucune sanction définitive automatique : les décisions de modération sont humaines, motivées et réexaminables.
- Aucun secret dans le dépôt ; aucun e-mail ni paiement réel sans autorisation explicite.
