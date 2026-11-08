# Coûts

> **Estimations indicatives**, établies sans consultation des grilles tarifaires en vigueur : chaque montant doit être vérifié auprès du fournisseur avant toute décision. Aucun service payant n'a été souscrit.

## Coûts d'infrastructure mensuels (ordre de grandeur)

| Poste | Lancement (≤ 5 000 membres) | Croissance (≈ 50 000 membres) | Remarques |
| --- | --- | --- | --- |
| Hébergement de l'application | 0 à 25 € | 50 à 200 € | Selon la plateforme (offre gratuite limitée, conteneurs, serverless) |
| PostgreSQL managé (UE, sauvegardes) | 15 à 40 € | 80 à 300 € | Le stockage des images n'est pas en base |
| Stockage d'objets (images) | < 5 € | 10 à 50 € | Images WebP ~100 à 300 Ko ; trafic sortant à surveiller (CDN) |
| E-mails transactionnels | 0 à 20 € | 20 à 80 € | Selon volume (inscriptions, commandes, notifications) |
| Supervision des erreurs | 0 à 26 € | 26 à 80 € | Offres gratuites limitées |
| Nom de domaine | ~1 à 2 € | ~1 à 2 € | |
| **Total infrastructure** | **≈ 20 à 120 €** | **≈ 200 à 700 €** | Hors équipe |

## Coûts variables liés aux transactions

| Poste | Hypothèse à vérifier | Impact |
| --- | --- | --- |
| Frais du prestataire de paiement (cartes européennes) | De l'ordre de 1,5 % + 0,25 € par paiement pour une carte standard de l'EEE chez les prestataires grand public | Sur 55 € payés : ≈ 1,08 € |
| Frais de place de marché (comptes vendeurs, versements) | Frais par compte actif et par versement selon l'offre « Connect » ou équivalente | À intégrer au calcul de rentabilité |
| Litiges et rétrofacturations | Frais fixes par litige bancaire | Provision à prévoir |
| Transporteurs nationaux | Tarif par colis selon format | Refacturé à l'acheteur |
| Tamurt Transport | Selon son contrat | Refacturé à l'acheteur |

Exemple sur un article à 50 € : frais de protection perçus 5,00 € ; frais de paiement estimés ≈ 1,08 € ; **revenu net estimé ≈ 3,90 €** avant frais de compte, de versement, de litige et de structure. Le tableau de bord d'administration calcule ces montants à partir du registre comptable réel (frais du prestataire inclus).

## Coûts non techniques à prévoir

- Conseil juridique : rédaction et validation des CGU, confidentialité, statut de paiement, conformité DSA/DAC7 ; conseil algérien pour l'activité en Algérie.
- Expert-comptable : TVA de la plateforme, factures de frais, exports comptables.
- Médiateur de la consommation (adhésion annuelle).
- Assurance responsabilité civile professionnelle ; assurance des envois si Tamurt Transport le prévoit.
- Vérification d'identité des vendeurs (prestataire KYC, à l'acte).
- Test d'intrusion avant ouverture.
- Modération et support humains (temps à dimensionner selon le volume de signalements et de litiges).
