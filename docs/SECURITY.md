# Sécurité

Ce document décrit les mesures **effectivement en place** dans le code, l'audit réalisé et les limites connues. Aucun test d'intrusion externe n'a été mené.

## Mesures en place

### Authentification et sessions
- Better Auth : mots de passe hachés (scrypt), vérification obligatoire de l'e-mail avant toute action sensible, réinitialisation par lien à usage unique, connexion Google facultative.
- Cookies de session `HttpOnly`, `SameSite=Lax`, `Secure` en production, préfixe dédié ; sessions supprimées lors d'une suspension.
- **Double authentification (TOTP)** disponible pour tous ; **obligatoire pour l'administration en production** (impossible à désactiver hors mode de test E2E).
- Limitation de débit des tentatives de connexion (stockée en base, cohérente entre instances).

### Autorisations
- Permissions fines du personnel ([`src/lib/domain/permissions.ts`](../src/lib/domain/permissions.ts)) : modération, support, finance, administration, super-administration. Le **support n'a pas de droits financiers** (remboursements plafonnés à 100 € / 15 000 DA, au-delà validation finance) ; un administrateur ne peut pas créer d'administrateur ; l'API Tamurt HQ et la conformité sont réservées au super-administrateur.
- **Anti-IDOR** : chaque service vérifie l'appartenance de l'objet (commande, litige, conversation, pièce jointe, adresse) ; une ressource d'autrui répond « introuvable ». Testé en intégration.
- Consultations de données privées par le personnel **journalisées** (commande, membre, litige, message signalé, pièce jointe).

### Entrées et données
- Validation Zod de toutes les entrées (Server Actions, routes, paramètres d'URL) ; les clés inconnues sont supprimées (aucun montant client accepté).
- Requêtes SQL paramétrées (Prisma, `Prisma.sql`) ; aucune concaténation de saisie utilisateur dans du SQL.
- Textes assainis (caractères de contrôle, longueurs) ; rendu React échappé par défaut, aucun HTML utilisateur interprété.
- Téléversements : taille maximale, **type réel vérifié par signature binaire**, limite de pixels (anti « bombe de décompression »), **ré-encodage WebP** qui supprime EXIF et position GPS, stockage privé, noms de fichiers générés. PDF de litige servis avec `Content-Disposition: attachment` et CSP `sandbox`.
- Messagerie : détection de coordonnées, liens de paiement externes et formulations d'hameçonnage (avertissement au destinataire), blocage, signalement, limitation des nouvelles conversations.

### Transport et navigateur
- **CSP stricte à nonce** générée à chaque requête (`script-src 'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`).
- En-têtes : HSTS (2 ans, sous-domaines, `preload` — à confirmer avant toute inscription sur la liste de préchargement), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictive (caméra, micro, géolocalisation, paiement, USB), `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`.
- Server Actions protégées par le contrôle d'origine de Next.js ; téléversements avec contrôle d'origine explicite.

### Paiements et intégrations
- Webhooks **signés HMAC-SHA256**, horodatage avec tolérance de 5 minutes (anti-rejeu), comparaison à temps constant, enregistrement unique par identifiant d'événement, traitement transactionnel.
- Montant et devise du webhook comparés à ceux de la commande ; incohérence → refus et alerte.
- Aucune donnée de carte bancaire ne transite par Market (page de paiement du prestataire).
- Jetons de service Tamurt HQ : affichés une seule fois, stockés en empreinte SHA-256, portées, liste d'IP, révocation.
- Tâches planifiées protégées par jeton porteur (`CRON_SECRET`).

### Configuration et secrets
- Variables d'environnement validées au démarrage ([`src/lib/env.ts`](../src/lib/env.ts)) ; en production, **refus** de démarrer avec les simulateurs de paiement, de livraison ou de Transport, la boîte e-mail simulée, le stockage local ou la 2FA d'administration désactivée.
- Aucun secret dans le dépôt (`.env*` ignorés, seuls des exemples factices versionnés).
- Outils `/dev/*` inaccessibles en production.

### Traçabilité
- Journal d'audit **en ajout seul** (modification et suppression refusées par déclencheur) : décisions de modération, rôles, réglages, indicateurs, frais, conformité, remboursements, consultations sensibles. Adresses IP stockées sous forme d'empreinte HMAC.
- Journaux applicatifs structurés (JSON) avec masquage automatique des champs sensibles (mots de passe, jetons, codes, cookies, téléphones, adresses, e-mails, contenus de messages, signatures).

## Audit réalisé (novembre 2026)

Revue manuelle et tests automatisés couvrant : contrôle d'accès objet par objet (commandes, litiges, conversations, fichiers), permissions du personnel, falsification de prix (test E2E par interception et modification de la requête), rejeu et signature des webhooks, concurrence sur l'achat d'un exemplaire unique, idempotence des commandes, fuite de données dans l'API publique, authentification de l'API interne (jeton invalide, portée, IP, révocation), absence de métadonnées dans les images, accessibilité (axe, WCAG 2.1 AA). `pnpm audit` est exécuté en intégration continue (vulnérabilités élevées bloquantes).

Défauts trouvés et corrigés pendant l'audit : alerte « montant incohérent » perdue lors de l'annulation de la transaction ; contrôle du pays du payeur fondé sur le pays de livraison ; affichage optimiste du bouton favori non annulé en cas d'erreur.

## Limites connues et actions recommandées

| Sujet | Recommandation |
| --- | --- |
| Pas de test d'intrusion externe | À réaliser avant l'ouverture publique |
| Limitation de débit en PostgreSQL | Suffisante au lancement ; passer à Redis au-delà de quelques centaines de requêtes par seconde |
| Pas d'analyse antivirus des pièces jointes PDF | Ajouter un service d'analyse (ou n'accepter que des images) |
| Pas de supervision d'erreurs (Sentry réservé, non intégré) | Intégrer un outil de supervision et d'alerte |
| Pas de WAF ni protection anti-bots avancée | Mettre en place au niveau de l'hébergeur (WAF, CAPTCHA adaptatif à l'inscription) |
| Rotation des secrets non outillée | Gestionnaire de secrets et procédure de rotation (webhooks, Better Auth, cron) |
| Vérification d'identité des vendeurs | Prestataire KYC à choisir (aucune pièce d'identité stockée par Market) |
| Liste d'IP de l'API HQ fondée sur `X-Forwarded-For` | Garantir que l'hébergeur remplace cet en-tête (proxy de confiance) |

## Signaler une vulnérabilité

[À COMPLÉTER : adresse dédiée et politique de divulgation responsable, par exemple `security.txt`.]
