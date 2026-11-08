# Décisions d'architecture (ADR)

Format : contexte → décision → conséquences. Les décisions marquées « à revoir » doivent être réévaluées à l'étape indiquée.

## ADR-001 — Monolithe modulaire Next.js
**Contexte** : petite équipe, produit à construire vite, besoin de frontières nettes (paiements, Transport). **Décision** : une application Next.js (App Router) avec modules `features/`, services `server/services/`, domaine pur `lib/domain/`, adaptateurs `integrations/`. **Conséquences** : un seul déploiement et une seule base ; l'extraction d'un service reste possible grâce aux interfaces d'intégration et à l'absence d'accès croisé hors services.

## ADR-002 — Alignement de pile avec l'écosystème Tamurt
**Contexte** : l'audit montre que Tamurt Transport (dépôt `project_wing`, paquet `tamurt-sending`) utilise Next.js 16, React 19, TypeScript 5.9, Prisma 7 et PostgreSQL (`pg`) ; Tamurt Jobs utilise Next.js avec Supabase. **Décision** : même pile (Next.js 16, React 19, TypeScript strict, Tailwind 4, Zod) pour mutualiser compétences et contrat partagé (`@tamurt/transport-contract` extractible). **Conséquences** : courbe d'apprentissage réduite ; dépendance à l'évolution de Next.js (version 16 : `proxy.ts`, paramètres asynchrones).

## ADR-003 — PostgreSQL + Prisma plutôt qu'un BaaS
**Contexte** : intégrité financière, contraintes, transactions, recherche plein texte ; Tamurt Transport utilise déjà Prisma 7 sur PostgreSQL. **Décision** : PostgreSQL 16 avec Prisma 7 (adaptateur `pg`) et SQL manuel dans les migrations pour ce que Prisma ne représente pas (CHECK, index partiels, déclencheurs, `tsvector`). **Conséquences** : portabilité entre hébergeurs ; contrôle de dérive (`pnpm db:drift`) nécessaire pour les objets manuels.

## ADR-004 — Argent en entiers et instantané de prix
**Décision** : montants en unités minimales (`Int`), devise obligatoire, taux en points de base, arrondi unique au plus proche ; prix figé par commande (`pricing_snapshot`) avec version du calculateur et règles appliquées. **Conséquences** : aucune erreur d'arrondi flottant ; changements de frais sans effet rétroactif.

## ADR-005 — Frais de protection côté acheteur (10 %)
**Contexte** : exigence produit. **Décision** : frais ajoutés au prix payé par l'acheteur, vendeur payé au prix affiché ; versionnés et configurables ; aucune commission sur la livraison. **Conséquences** : affichage clair avant paiement ; pas de double commission avec Tamurt Transport.

## ADR-006 — Registre comptable en partie double
**Décision** : registre technique immuable, transactions équilibrées vérifiées par un déclencheur différé, idempotence par clé. **Conséquences** : rapprochements et indicateurs fiables (GMV ≠ chiffre d'affaires ≠ revenu net) ; ne remplace pas la comptabilité légale.

## ADR-007 — Abstraction des prestataires et simulateurs fidèles
**Décision** : interfaces `PaymentProvider`, `ShippingProviderAdapter`, client Transport ; simulateurs implémentant les mêmes interfaces, avec webhooks signés traités par les mêmes routes. **Conséquences** : parcours testables de bout en bout sans argent réel ; le passage au réel se limite à un adaptateur ; simulateurs refusés en production.

## ADR-008 — File de tâches dans PostgreSQL (outbox)
**Contexte** : effets externes (e-mails, remboursements, Transport) à fiabiliser sans infrastructure supplémentaire. **Décision** : table `job` alimentée dans la transaction métier, `FOR UPDATE SKIP LOCKED`, reprises exponentielles, file des échecs. Déclenchement par `after()`, cron HTTP et commande. **À revoir** au-delà de quelques milliers de tâches par minute (file dédiée).

## ADR-009 — Saga avec compensation pour Tamurt Transport
**Décision** : blocage de capacité avant paiement, confirmation asynchrone après paiement, compensation (remboursement intégral, remise en vente, annulation chez Transport) en cas d'échec définitif ; disjoncteur et dégradation gracieuse. **Conséquences** : aucune commande payée sans transport confirmé ; Market reste utilisable si Transport tombe.

## ADR-010 — Contrat Transport proposé par Market
**Contexte** : aucune API partenaire n'existe côté Transport. **Décision** : contrat v1 en schémas Zod (source de vérité) + OpenAPI générée + simulateur. **Conséquences** : Transport peut implémenter contre une spécification exécutable ; le contrat reste une **proposition** à négocier.

## ADR-011 — Conformité bloquante par défaut
**Décision** : matrice pays × pays × catégorie × prestataire × transporteur ; « à vérifier » bloque ; international fermé par défaut ; ouverture réservée au super-administrateur avec preuve de validation et confirmation. **Conséquences** : impossible d'ouvrir un flux par erreur de configuration.

## ADR-012 — Algérie en mode petites annonces
**Contexte** : absence de solution de paiement pour place de marché démontrée (CIB/Edahabia via SATIM nécessitent un contrat bancaire ; redistribution à des tiers non présumée). **Décision** : publication, recherche et messagerie en Algérie ; aucun paiement intégré. **À revoir** après instruction juridique et bancaire.

## ADR-013 — CSP à nonce et rendu dynamique
**Décision** : nonce par requête (`strict-dynamic`), ce qui rend les pages dynamiques ; cache applicatif des référentiels. **Conséquences** : sécurité renforcée contre l'injection de scripts ; pas de génération statique des pages (acceptable au lancement ; envisager une CSP à empreintes pour des pages statiques si nécessaire).

## ADR-014 — next-intl, préfixe « au besoin »
**Décision** : français sans préfixe, autres langues préfixées (`/ar`, `/kab`, `/en`) ; messages typés. **Conséquences** : URL françaises courtes et stables pour le SEO ; activation d'une langue = traductions + ajout à la liste active.

## ADR-015 — Better Auth
**Décision** : Better Auth avec adaptateur Prisma (e-mail/mot de passe, vérification, réinitialisation, Google, TOTP, limitation en base). **Conséquences** : données d'authentification dans notre base ; pas de dépendance à un service tiers d'identité.

## ADR-016 — Code de remise dérivé, jamais stocké
**Décision** : le code à 6 chiffres est dérivé (HMAC) d'un sel par commande et d'un poivre serveur ; tentatives limitées. **Conséquences** : une fuite de la base ne révèle pas les codes ; le vendeur ne peut pas confirmer la remise sans l'acheteur.

## ADR-017 — Paiements en double : encaissement non affecté
**Décision** : un paiement réussi qui n'est pas effectif (doublon, après expiration) est marqué `isDuplicate`, comptabilisé en `unallocated_receipts` et remboursé automatiquement. **Conséquences** : aucune perte ni rétention de fonds de l'acheteur ; registre toujours équilibré.

## ADR-018 — Mesure d'audience interne minimisée
**Décision** : événements internes (sans traceur tiers, sans cookie publicitaire), visiteurs anonymes non suivis individuellement, conservation 13 mois. **Conséquences** : pas de bandeau de consentement nécessaire tant qu'aucun outil tiers n'est ajouté ; entonnoirs limités aux membres.

## ADR-019 — Sitemaps et robots calculés à la demande
**Décision** : aucune requête en base pendant le build ; index de sitemaps paginé ; indexation interdite hors production réelle. **Conséquences** : build reproductible en CI sans base ; préproduction jamais indexée.
