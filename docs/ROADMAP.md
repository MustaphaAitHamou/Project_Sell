# Feuille de route

## État par fonctionnalité

### Opérationnel (code réel, données persistées, testé)
Comptes et double authentification ; profils publics et vendeurs professionnels ; publication d'annonces en 5 étapes avec photos nettoyées ; modération humaine ; catégories administrables avec attributs ; recherche plein texte et filtres ; favoris ; messagerie sécurisée ; signalements ; commandes avec prix serveur et réservation ; remise en main propre par code ; période de vérification et clôture automatique ; avis ; litiges ; notifications internes ; back-office complet avec permissions fines et audit ; matrice de conformité bloquante ; API publique v1 ; API Tamurt HQ ; SEO (métadonnées, données structurées, sitemaps) ; mode sombre ; accessibilité AA vérifiée sur les pages principales.

### Simulé (aucune transaction réelle)
| Élément | Simulation | Ce qui manque pour le réel |
| --- | --- | --- |
| Paiement, remboursements, versements | Prestataire `sandbox` local avec webhooks signés | Choix et contrat d'un prestataire, adaptateur réel |
| Livraison nationale (étiquettes, suivi) | Transporteur `sandbox_national` | Contrat transporteur (Colissimo, Mondial Relay, Chronopost… préconfigurés mais inactifs) |
| Tamurt Transport | Simulateur conforme au contrat v1 | API partenaire à implémenter côté Transport |
| E-mails | Boîte simulée `/dev/boite-mail` | Domaine authentifié + fournisseur (adaptateur Resend prévu, non activé) |

### En attente de décision ou de validation
Documents juridiques ; statut de paiement ; ouverture internationale ; activité en Algérie (commerce électronique, données, paiement) ; vérification d'identité des vendeurs (prestataire KYC) ; hébergement de production ; médiateur.

### Préparé mais non activé
Langues `ar` (droite-à-gauche), `kab`, `en` (routage prêt, traductions à produire) ; fonctions d'IA (indicateurs à `false`, aucune implémentation, aucune sanction automatique prévue) ; commission vendeur (modèle de frais prêt) ; recherches sauvegardées (modèle prêt).

## Priorités proposées

1. **Décisions** : prestataire de paiement (proposition comparée à préparer), validation juridique des CGU/confidentialité, hébergement UE.
2. **Lancement en petites annonces** (sans achat intégré) pour constituer l'offre : déploiement, domaine e-mail, supervision, sauvegardes.
3. **Paiement réel en France** : adaptateur du prestataire choisi, KYC vendeurs, versements, exports comptables, TVA.
4. **Livraison nationale réelle** : contrat avec un transporteur, adaptateur, étiquettes.
5. **Tamurt Transport** : implémentation du contrat v1 côté Transport, tests de contrat, puis validation du corridor.
6. **Langues** : arabe (RTL) et kabyle pour l'interface publique.
7. **Croissance** : recherches sauvegardées avec alertes, offres et négociation, mise en avant payante (avec transparence du classement), application mobile (PWA puis native), Redis pour la limitation de débit et le cache, moteur de recherche dédié si le volume l'exige.

## Hors périmètre actuel

Véhicules, immobilier, services (catégories créées mais inactives : réglementations spécifiques) ; paiement en plusieurs fois ; portefeuille interne (activité réglementée).
