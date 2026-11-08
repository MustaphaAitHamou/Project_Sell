# Tests

## Pyramide

| Niveau | Outil | Emplacement | Nombre | Base de données |
| --- | --- | --- | --- | --- |
| Unitaires (domaine pur) | Vitest | `tests/unit` | 71 | Aucune |
| Intégration (services réels) | Vitest | `tests/integration` | 35 | `tamurt_market_test` (créée, migrée et alimentée en référentiels automatiquement ; tables vidées à chaque fichier) |
| Bout en bout | Playwright + axe-core | `tests/e2e` | 34 | `tamurt_market_e2e` (recréée à chaque exécution, jeu de démonstration fictif), **build de production** sur le port 3100 |

Aucun test n'envoie d'e-mail réel ni ne déclenche de paiement réel : prestataires simulés, boîte e-mail interceptée, refus de toute base dont le nom ne contient pas « test » ou « e2e ».

## Commandes

```bash
pnpm test:unit
```

```bash
pnpm test:integration
```

```bash
pnpm test:e2e
```

Variables utiles : `TEST_DATABASE_URL` et `E2E_DATABASE_URL` (sinon dérivées de `.env.test` ou `.env.test.example`), `E2E_PORT`, `E2E_SKIP_BUILD=true` (réutiliser un build `.next-e2e`).

## Couverture fonctionnelle

### Unitaires
Arrondis et opérations monétaires en entiers, calcul des frais (10 %, minimum/maximum, part fixe), instantané de prix, machines à états (commande, annonce, acteurs autorisés), matrice de conformité (spécificité, sévérité, refus par défaut en international), identifiants publics, normalisation de recherche, détection de risques dans les messages, permissions.

### Intégration
| Sujet | Vérifications |
| --- | --- |
| Prix | 50 € → 5 € de frais → 55 € ; net vendeur 50 € ; montants injectés ignorés ; propre annonce et e-mail non vérifié refusés |
| Concurrence | 3 achats simultanés d'un exemplaire unique → 1 commande, 2 conflits ; annonce réservée |
| Idempotence | même clé → même commande |
| Webhooks | traitement unique malgré le rejeu ; signature invalide rejetée sans trace ; montant incohérent refusé avec alerte d'audit ; paiement en double remboursé automatiquement |
| Cycle complet | code de remise réservé à l'acheteur, mauvais code refusé, période de vérification, clôture, produit comptable 2,49 €, versement simulé, comptes soldés, registre équilibré |
| Expiration | commande non payée annulée, article remis en vente |
| Litiges | remboursement intégral après décision motivée ; plafond du support ; remboursement partiel ; modérateur non habilité |
| Accès | commande, litige, conversation d'autrui introuvables ; consultation par le personnel journalisée ; adresse visible du vendeur seulement après paiement ; blocage |
| Personnel | support ≠ modération, modérateur ≠ exclusion, administrateur ≠ création d'administrateur, suspension motivée + notification + fermeture des sessions |
| Transport | corridor de test bloquant ; saga blocage → paiement → confirmation → suivi signé ; frais de 10 % sur l'article seulement ; devis à usage unique ; compensation (remboursement + remise en vente) ; panne → Market utilisable |
| Recherche | accents, racines, ET logique, faute de frappe, graphie kabyle (« bgayet »), filtres pays/prix, annonces suspendues exclues |
| API | aucune donnée privée dans l'API publique ; pagination bornée ; jetons HQ (absent, invalide, portée, révocation) |

### Bout en bout (scénarios du cahier des charges)
| # | Scénario | Spécification |
| --- | --- | --- |
| 1 | Inscription (e-mail vérifié via la boîte simulée), profil, publication avec photo ; photo servie en WebP sans EXIF | `01-parcours-vente.spec.ts` |
| 2 | Recherche du produit et ajout aux favoris | `01-parcours-vente.spec.ts` |
| 3 | Commande de test payée (prestataire simulé) | `01-parcours-vente.spec.ts` |
| 4 | Le vendeur consulte sa vente | `01-parcours-vente.spec.ts` |
| 5 | L'administrateur tranche un litige, remboursement exécuté | `02-litige-admin.spec.ts` |
| 6 | Devis Tamurt Transport France → Algérie simulé, aucune réservation | `03-transport.spec.ts` |
| 7 | Prix modifié côté client (DOM et requête interceptée) → montant serveur facturé | `01-parcours-vente.spec.ts` |
| 8 | Deux acheteurs simultanés → une seule commande | `04-concurrence.spec.ts` |
| 9 | Webhook rejoué 3 fois → aucune écriture financière dupliquée, registre équilibré | `01-parcours-vente.spec.ts` |
| 10 | Panne de Tamurt Transport → état affiché, achat en main propre et navigation intacts | `03-transport.spec.ts` |
| — | Le support n'accède ni aux paiements, ni aux statistiques, ni à la configuration | `02-litige-admin.spec.ts` |
| — | Accessibilité axe (WCAG 2.1 AA, violations graves et critiques) sur 11 pages, thème clair et sombre ; navigation au clavier | `05-accessibilite.spec.ts` |
| — | Mobile (Pixel 7) : aucune barre de défilement horizontale, barre d'onglets | `responsive.spec.ts` |

## Résultats de la dernière exécution (8 novembre 2026)

| Contrôle | Résultat |
| --- | --- |
| `pnpm lint` | 0 erreur, 0 avertissement |
| `pnpm typecheck` | 0 erreur |
| Tests unitaires + intégration | **106 / 106** |
| Tests E2E | **34 / 34** (après corrections : contrastes, nom accessible du logo, bouton favori, message d'accès refusé) |
| `next build` | Succès |
| Spécifications OpenAPI | Valides (Redocly) |
| Dérive du schéma | Aucune (hors 4 index SQL manuels attendus) |

## Intégration continue

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) : installation figée, `pnpm audit` (vulnérabilités élevées), lint, typage, tests unitaires, tests d'intégration sur PostgreSQL 16 (service), contrôle de dérive du schéma, spécifications OpenAPI à jour, build, navigateur Playwright, tests E2E, rapport en cas d'échec. **Non encore exécutée sur GitHub** : le dépôt distant n'existe pas encore.

## Non couvert à ce jour

Tests de charge ; tests de contrat avec un vrai prestataire de paiement et avec une vraie API Tamurt Transport (inexistante) ; tests visuels de non-régression ; lecteurs d'écran réels (au-delà d'axe) ; langues `ar`, `kab`, `en` (non activées).
