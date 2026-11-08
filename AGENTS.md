<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Tamurt Market — repères pour les agents

- Lire `README.md` et `docs/ARCHITECTURE.md` avant toute modification.
- Domaine pur dans `src/lib/domain` (sans E/S, testé) ; services dans `src/server/services` (vérifient appartenance et permissions) ; Server Actions dans `src/features/*/actions.ts` (Zod).
- Argent : entiers en unités minimales uniquement ; jamais de montant venant du navigateur.
- Conformité : « à vérifier » bloque ; ne jamais transformer une restriction en avertissement.
- Migrations : `pnpm db:migrate --create-only`, relire le SQL, puis `pnpm db:deploy` ; `pnpm db:drift` doit rester vert.
- Avant de rendre la main : `pnpm lint`, `pnpm typecheck`, `pnpm test`, et `pnpm test:e2e` pour les parcours.
- Aucun e-mail réel, aucun paiement réel, aucun déploiement sans autorisation explicite.
