# API

Trois familles d'interfaces HTTP, toutes versionnées par préfixe d'URL (`/v1`). Les spécifications OpenAPI 3.1 sont **générées depuis les schémas Zod** (source de vérité unique) par `pnpm openapi`, validées par Redocly et contrôlées en CI :

| Spécification | Fichier |
| --- | --- |
| API publique v1 | [`openapi/tamurt-market-public-v1.json`](openapi/tamurt-market-public-v1.json) — servie aussi sur `/api/v1/openapi.json` |
| API interne Tamurt HQ | [`openapi/tamurt-hq-internal-v1.json`](openapi/tamurt-hq-internal-v1.json) |
| Contrat partenaire Tamurt Transport (proposé) | [`openapi/tamurt-transport-partner-v1.json`](openapi/tamurt-transport-partner-v1.json) — voir [TRANSPORT_INTEGRATION](TRANSPORT_INTEGRATION.md) |

Format d'erreur commun : `{ "error": { "code": "NOT_FOUND", "message": "…" } }`, sans détail interne. Codes HTTP : 400/422 validation, 401 authentification, 403 permission, 404 introuvable (y compris pour une ressource d'autrui : pas de divulgation d'existence), 409 conflit, 412 précondition, 429 limitation, 503 indisponibilité.

## 1. API publique v1 (lecture seule)

Données publiques uniquement ; aucune authentification ; aucun cookie lu (la réponse ne dépend jamais de la session). CORS ouvert en `GET`. Limite : **120 requêtes / minute / adresse IP** (empreinte HMAC de l'IP, jamais l'IP en clair). Cache partagé court (`s-maxage=60`, catégories 600 s).

| Méthode | Chemin | Description |
| --- | --- | --- |
| GET | `/api/v1/categories` | Catégories actives et non interdites (slug, parent, achat intégré possible, vérification avant publication) |
| GET | `/api/v1/listings` | Recherche : `q`, `categorie`, `pays`, `region`, `ville`, `prix_min`, `prix_max` (exigent `pays`), `etat`, `marque`, `livraison=1`, `verifie=1`, `vendeur=particulier\|pro`, `vendus=1`, `tri=pertinence\|recent\|prix_asc\|prix_desc`, `page` (≤ 50, 24 résultats par page) |
| GET | `/api/v1/listings/{id}` | Fiche publique (identifiant public), photos, attributs, vendeur (profil public) ; 404 si non publique |
| GET | `/api/v1/sellers/{handle}` | Profil vendeur public, identité légale du vendeur professionnel, 24 dernières annonces |
| GET | `/api/v1/openapi.json` | Spécification |

Chaque réponse passe par un schéma Zod de sortie : toute clé non déclarée est retirée (identifiants internes, e-mails, téléphones, notes de modération ne peuvent pas fuiter). Montants : `{ amount, currency, formatted }` en unités minimales.

## 2. API interne Tamurt HQ

`GET /api/internal/hq/v1/metrics?jours=30` — indicateurs **agrégés** (aucune donnée personnelle) : membres, annonces, commandes par statut, volume d'affaires, chiffre d'affaires de la plateforme, frais des prestataires, remboursements, litiges, état de Tamurt Transport. Chaque montant porte un indicateur `simulated` : les montants simulés ne sont jamais mêlés aux montants réels. Le champ `environment` vaut `simulation` tant que des simulateurs sont actifs.

Authentification : `Authorization: Bearer tmhq_…` — jeton créé par un super-administrateur dans **Administration → Configuration → API Tamurt HQ**, affiché une seule fois ; seule son empreinte SHA-256 est stockée. Portée requise `metrics:read`, restriction facultative par adresse IP, 60 requêtes / minute, révocation immédiate. 401 si le jeton est absent, inconnu ou révoqué ; 403 si la portée ou l'adresse IP ne conviennent pas.

## 3. Webhooks entrants

Tous signés HMAC-SHA256 (`t=<horodatage>,v1=<signature hex>` sur `"{t}.{corps}"`, tolérance de 5 minutes contre le rejeu), enregistrés de façon unique par `(source, identifiant d'événement)` puis traités en transaction. Un rejeu répond `200 { duplicate: true }` sans effet. Un événement en échec reste rejouable (maintenance et administration).

| Chemin | Émetteur | En-tête de signature |
| --- | --- | --- |
| `POST /api/webhooks/payments/{prestataire}` | Prestataire de paiement (aujourd'hui : `sandbox`) | `tamurt-sandbox-signature` |
| `POST /api/webhooks/shipping/{transporteur}` | Transporteur national (aujourd'hui : `sandbox_national`) | `tamurt-shipping-signature` |
| `POST /api/webhooks/transport` | Tamurt Transport (aujourd'hui : simulateur) | `tamurt-signature` |

Règles de traitement des paiements : un montant ou une devise différents de ceux de la commande ne font **jamais** passer la commande en « payée » (alerte d'audit conservée) ; un paiement reçu après expiration ou en double est enregistré comme encaissement non affecté et **remboursé automatiquement**.

## 4. Tâches planifiées

`Authorization: Bearer <CRON_SECRET>` (comparaison à temps constant).

| Chemin | Fréquence conseillée | Rôle |
| --- | --- | --- |
| `POST /api/cron/jobs` | chaque minute | Exécute la file de tâches |
| `POST /api/cron/maintenance` | toutes les 5 à 15 minutes | Expirations, clôtures automatiques, compensations Transport, rejeu des webhooks, relance des versements, purges |

## 5. Autres routes

| Chemin | Accès |
| --- | --- |
| `/api/auth/*` | Better Auth (inscription, connexion, vérification, 2FA, réinitialisation) |
| `/api/images/{id}/{thumb\|large}` | Photos d'annonces publiques (cache public) ; photos non publiques réservées au vendeur et au personnel |
| `/api/avatars/{userId}` | Avatars |
| `/api/uploads/listing-image` | Téléversement (session, contrôle d'origine, taille, type réel par signature binaire) |
| `/api/files/messages/{id}`, `/api/files/disputes/{id}` | Pièces jointes privées : participants et personnel habilité (consultation journalisée) |
| `/api/health` | Sonde de disponibilité (sans information sensible) |
| `/sitemap.xml`, `/sitemaps/index.xml`, `/sitemaps/annonces/{n}.xml`, `/robots.txt` | SEO (tout est bloqué hors production réelle) |
| `/api/dev/transport-simulator/*` | Simulateur Transport — **désactivé en production** |

## Server Actions

Les écritures de l'interface passent par des Server Actions Next.js (`src/features/*/actions.ts`), protégées par le contrôle d'origine de Next.js, validées par Zod (les clés inconnues sont supprimées : **aucun montant n'est accepté du navigateur**) et soumises aux mêmes vérifications d'appartenance et de permission que les services.
