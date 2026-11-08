# Conformité

> Ce document est un **inventaire de travail** établi pour préparer la validation par des professionnels (avocat, expert-comptable, déclarant en douane, délégué à la protection des données). Il ne constitue pas un avis juridique. Tout point marqué « à valider » doit être instruit avant l'ouverture correspondante.

## Matrice de conformité (implémentée)

La décision d'achat combine cinq dimensions : **pays du vendeur × pays de l'acheteur (destination) × catégorie × prestataire de paiement × transporteur** ([`src/lib/domain/compliance.ts`](../src/lib/domain/compliance.ts), table `compliance_rule`). La règle la plus spécifique l'emporte ; à spécificité égale, la plus restrictive.

| Statut | Effet |
| --- | --- |
| `ALLOWED` | Achat possible (sous réserve des autres conditions) |
| `CONDITIONAL` | Achat possible avec conditions affichées |
| `TO_VERIFY` | **Bloquant** — jamais un simple avertissement |
| `PROHIBITED` | Bloquant |
| Aucune règle applicable | National : autorisé ; **international : « à vérifier », donc bloquant** |

Règles initiales :

| Origine → destination | Catégorie | Statut | Commentaire |
| --- | --- | --- | --- |
| FR → FR | toutes | Autorisé | Hors catégories interdites et réglementées |
| DZ → DZ | toutes | Autorisé | Annonces seulement : achat intégré indisponible (pays en mode petites annonces) |
| FR → DZ | toutes | **À vérifier** | Douane, transport par particuliers, assurance, paiement, contrôle des changes |
| DZ → FR | toutes | **À vérifier** | Idem |
| DZ → toute destination | Art et œuvres | **À vérifier** | Exportation de biens culturels soumise à autorisation |

Garde-fous supplémentaires :

- Indicateur `checkout.crossBorder` **désactivé** ; son activation exige un **super-administrateur**, au moins une **validation de corridor** enregistrée au registre de conformité (`compliance_record` : objet, professionnel ayant validé, date, référence du document) et la saisie d'une **confirmation explicite**. Ouvrir une règle internationale en « autorisé » exige le nom du professionnel ayant validé. Tout est journalisé.
- Pays : mode `INTEGRATED` / `CLASSIFIED_ONLY` / `DISABLED` et versements activables par pays (permission « conformité »).
- Catégories interdites (armes, médicaments, animaux, contrefaçons) inactives ; catégories sensibles vérifiées avant publication ; mots-clés à risque → vérification humaine.

## France / Union européenne — liste de contrôle

| Sujet | Référence (à confirmer) | État dans le produit |
| --- | --- | --- |
| Information sur le rôle d'intermédiaire, classement, statut du vendeur | Code de la consommation (art. L111-7 et suivants), règlement P2B (UE) 2019/1150 | Modèles rédigés (CGU § 1, § 4) ; badge « Pro » ; **à valider** |
| Avis en ligne (caractère vérifié, modalités) | Code de la consommation (L111-7-2) | Avis réservés aux parties d'une transaction conclue ; contestation possible ; **à valider** |
| Services numériques : signalement, exposé des motifs, réclamations, traçabilité des professionnels | Règlement (UE) 2022/2065 (DSA) | Signalement, décisions motivées et notifiées, réexamen par le support, identité des vendeurs pro ; **point de contact, rapports de transparence et recours extrajudiciaire à organiser** |
| Déclaration des vendeurs aux autorités fiscales | Directive DAC7, CGI art. 242 bis | Champs vendeurs pro présents ; **collecte et déclaration annuelle à organiser** |
| Protection des données | RGPD, loi Informatique et Libertés | Minimisation, séparation profil/coordonnées, suppression avec anonymisation, durée de conservation de l'audience, journal des accès ; **registre des traitements, AIPD éventuelle, sous-traitants, transferts à documenter** |
| Cookies et traceurs | Lignes directrices CNIL | Uniquement des éléments strictement nécessaires (session, thème, recherches récentes en stockage local) → pas de bandeau ; **à revoir si un outil tiers est ajouté** |
| Droit de rétractation, garanties légales (vendeur professionnel) | Code de la consommation | Information affichée ; responsabilité du vendeur pro ; **à valider** |
| Médiation de la consommation | Code de la consommation (L612-1) | **Médiateur à désigner** |
| Services de paiement (fonds de tiers) | Directive (UE) 2015/2366 (DSP2), Code monétaire et financier | Fonds confiés à un prestataire agréé (cible) ; **statut à valider** |
| Lutte contre le blanchiment (KYC vendeurs) | Obligations du prestataire de paiement | Délégué au prestataire ; aucune pièce d'identité stockée |
| Sécurité des produits, rappels | Règlement (UE) 2023/988 (RGSP) | Catégories sensibles vérifiées ; **procédure de retrait sur rappel à formaliser** |
| Mentions légales | LCEN | Modèle avec champs à compléter |
| TVA de la plateforme | CGI, régimes du commerce électronique | **À valider avec un expert-comptable** |

## Algérie — liste de contrôle

| Sujet | Référence (à confirmer) | État |
| --- | --- | --- |
| Commerce électronique (inscription au registre du commerce, nom de domaine, obligations du fournisseur) | Loi n° 18-05 du 10 mai 2018 | **À instruire** avec un conseil algérien avant toute activité commerciale en Algérie |
| Protection des données | Loi n° 18-07 du 10 juin 2018 (ANPDP) | **À instruire** (déclarations, transferts) |
| Paiement en ligne | CIB / Edahabia via SATIM et banque acquéreuse | Non disponible pour une place de marché à ce jour ; mode petites annonces |
| Réglementation des changes | Banque d'Algérie | Tout flux financier transfrontalier **à instruire** |
| Douane (franchises, interdictions, déclaration) | Code des douanes algérien | **À instruire** — FR→DZ bloqué |

## International (France ⇄ Algérie)

Fermé tant que les points suivants ne sont pas validés et enregistrés au registre de conformité : régime douanier des envois de particuliers et de professionnels (valeur, quantités, marchandises interdites ou soumises à autorisation, déclaration), cadre juridique et assurance du transport par voyageurs (Tamurt Transport), responsabilité en cas de saisie ou de perte, paiement et contrôle des changes, fiscalité (TVA à l'importation, droits), protection des données (transferts hors UE). Les droits et taxes d'importation sont affichés comme **non inclus** et susceptibles d'être exigés à la livraison.

## Documents juridiques

Modèles intégrés à l'application, tous marqués « [À VALIDER] » avec champs « [À COMPLÉTER] » : conditions générales (`/conditions`), confidentialité (`/confidentialite`), mentions légales (`/mentions-legales`), protection acheteur (`/protection-acheteur`), objets interdits (`/objets-interdits`), contact (`/contact`). Les chiffres affichés (taux de frais, délais) sont lus dans la configuration pour rester exacts.

## Autorisations nécessaires avant production

1. Validation des documents juridiques et désignation du médiateur de la consommation.
2. Choix et contrat du prestataire de paiement ; validation du statut d'intermédiaire.
3. Registre des traitements RGPD, contrats de sous-traitance, information sur les transferts.
4. Organisation DSA (point de contact, procédure de réclamation, rapports) et DAC7.
5. Pour l'international : validations douanières, fiscales, de transport et d'assurance, enregistrées au registre de conformité, puis ouverture par un super-administrateur.
6. Pour l'Algérie : instruction juridique locale (commerce électronique, données, paiement, changes).
