# Paiements

> **Aucun paiement réel n'est possible aujourd'hui.** Le seul prestataire branché est un simulateur local (`PAYMENT_PROVIDER=sandbox`), refusé par la configuration en production. Le choix et le contrat d'un prestataire réel sont des décisions à prendre (voir « Prestataires » ci-dessous).

## Modèle de frais

- **Frais de protection acheteur : 10 %** du prix de l'article, **ajoutés** au prix payé par l'acheteur ; le vendeur reçoit le prix affiché. Exemple : article à 50,00 € → frais 5,00 € → l'acheteur paie 55,00 € (hors livraison) ; le vendeur reçoit 50,00 €.
- Aucune commission vendeur à ce jour (le modèle la prévoit : règle `SELLER_COMMISSION`, désactivée).
- Les frais de livraison (transporteur national ou Tamurt Transport) s'ajoutent sans frais supplémentaires de Market : pas de double commission.
- Le taux est **configurable** en administration ; chaque modification crée une **nouvelle version** de règle (historisée, auteur journalisé) qui ne s'applique qu'aux nouvelles commandes.

### Calcul

[`src/lib/domain/pricing.ts`](../src/lib/domain/pricing.ts) et [`money.ts`](../src/lib/domain/money.ts) (fonctions pures, testées) :

- montants en **entiers** (unités minimales), devise ISO obligatoire, aucune conversion implicite ;
- taux en points de base (1 000 bps = 10 %), plafonné à 50 % ;
- arrondi **au plus proche, demi supérieur**, une seule fois par ligne (`applyRateBps`) ;
- minimum/maximum et part fixe optionnels par règle ;
- résultat = détail ligne à ligne (`breakdown`) + **instantané de prix** enregistré avec la commande (`pricing_snapshot` : version du calculateur, règles appliquées, taxes) ; les contraintes SQL garantissent `total = articles + frais + livraison + taxes`.

Le navigateur ne transmet **jamais** de montant : la commande ne reçoit que l'annonce, le mode de remise, l'adresse, l'identifiant de devis et une clé d'idempotence ; le prix est relu sous verrou au moment de la commande (prix modifié entre-temps → refus explicite).

### Taxes

Aucune TVA n'est collectée par la plateforme à ce stade (statut `NONE`). En transfrontalier, les droits et taxes d'importation sont **inconnus** (`UNKNOWN`) et affichés comme susceptibles d'être exigés à la livraison. Le régime de TVA de la plateforme (commission, éventuel régime de « fournisseur présumé » pour les ventes à distance) est **à valider** avec un expert-comptable.

## Abstraction des prestataires

Interface `PaymentProvider` ([`src/integrations/payment-providers/types.ts`](../src/integrations/payment-providers/types.ts)) : création de session, annulation, remboursement (total ou partiel), versement, compte de versement, analyse et vérification des webhooks, **capacités déclarées** (pays des payeurs, devises, pays de versement, versements différés, remboursements partiels). L'éligibilité à l'achat vérifie ces capacités : un pays ou une devise non pris en charge bloque l'achat intégré au lieu de l'autoriser par défaut.

## Flux

1. **Commande** → paiement `REQUIRES_ACTION`, session chez le prestataire, réservation de l'exemplaire (30 min, réglable).
2. **Webhook signé** `payment.succeeded` → vérification de la signature et de l'horodatage, enregistrement unique de l'événement, contrôle **montant + devise** (incohérence → refus et alerte d'audit), passage en payé, écritures comptables, annonce vendue, tâches de suite.
3. **Remise ou livraison** → période de vérification (48 h, réglable) → clôture.
4. **Versement** au vendeur (tâche `payout.release`) si le pays autorise les versements et si le vendeur dispose d'un compte de versement actif ; sinon `BLOCKED` avec motif, relance automatique. Gel en cas de litige.
5. **Remboursements** (litige, annulation vendeur, compensation Transport, doublon) via la tâche `refund.execute`, idempotente.

Paiement **en double** ou **après expiration** : encaissement enregistré au compte `unallocated_receipts` puis remboursé automatiquement (testé).

## Registre comptable

Registre **technique** en partie double ([`src/server/services/ledger.ts`](../src/server/services/ledger.ts)) — ce n'est pas la comptabilité légale, qui sera tenue par l'expert-comptable à partir d'exports.

| Compte | Nature |
| --- | --- |
| `psp_clearing` | Actif : fonds détenus chez le prestataire |
| `seller_payable` | Passif : dû aux vendeurs |
| `buyer_fee_deferred` / `buyer_fee_revenue` | Frais encaissés non acquis / acquis à la clôture |
| `seller_fee_deferred` / `seller_fee_revenue` | Commission vendeur (inactive) |
| `shipping_payable` | Dû aux transporteurs / à Tamurt Transport |
| `tax_payable` | Taxes à reverser |
| `psp_fees` | Charge : frais du prestataire |
| `unallocated_receipts` | Encaissements sans commande effective |

Chaque transaction est équilibrée (vérifiée dans le code puis par un **déclencheur de contrainte différé** au `COMMIT`), immuable (correction = écriture inverse) et idempotente (clé unique). Exemple vérifié de bout en bout (article 24,90 €) : encaissement 27,39 € → `psp_clearing` +27,39, `seller_payable` −24,90, `buyer_fee_deferred` −2,49 ; frais prestataire simulés 0,63 € ; à la clôture les 2,49 € passent en produit ; après versement, `seller_payable` revient à 0 et la trésorerie restante (1,86 €) correspond au revenu net.

En administration, le tableau de bord distingue **volume d'affaires (GMV)**, **chiffre d'affaires de la plateforme** (frais acquis) et **revenu net estimé** (après frais du prestataire) — sans jamais additionner des devises différentes.

## Prestataires

| Option | État | Ce qu'il faut vérifier avant de décider |
| --- | --- | --- |
| Simulateur local | Intégré (tests et démonstration) | — |
| **Stripe Connect** (France / UE) | Étudié, **non intégré** — aucun compte, aucune clé | Modèle « charges et transferts séparés » ou « paiements indirects » ; durée maximale de conservation des fonds avant transfert ; KYC des vendeurs particuliers et professionnels ; pays de versement ; tarification Connect en vigueur ; responsabilités en cas de litige et de rétrofacturation ; obligations de déclaration des vendeurs |
| Autres prestataires de place de marché (Mangopay, Adyen for Platforms, Lemonway…) | Non étudiés en détail | Comparaison des agréments, du KYC, des tarifs et de la gestion des fonds de tiers |
| **Algérie : CIB / Edahabia** (SATIM, via une banque acquéreuse) | **Non disponible** | Contrat d'acceptation avec une banque algérienne ; la redistribution des fonds à des vendeurs tiers (modèle place de marché) **n'est pas présumée possible** ; réglementation des changes pour tout flux transfrontalier. D'ici là : **mode petites annonces** en Algérie (aucun paiement intégré) |

Point juridique à valider : encaisser pour le compte de tiers est une activité réglementée (services de paiement). Le modèle cible confie l'encaissement, la conservation et le versement des fonds à un prestataire agréé ; Tamurt Market ne doit pas détenir les fonds des acheteurs sur ses propres comptes.

## Avant toute mise en production

1. Choix du prestataire et contrat (proposition à préparer pour décision).
2. Implémentation de l'adaptateur réel (`PaymentProvider`) + tests de contrat en mode test du prestataire.
3. Secrets dans un gestionnaire de secrets ; webhooks enregistrés chez le prestataire.
4. Validation fiscale (TVA, factures de frais) et comptable (exports du registre).
5. Activation pays par pays (`checkoutMode`, `payoutsEnabled`) par un administrateur habilité, avec trace dans le registre de conformité.
