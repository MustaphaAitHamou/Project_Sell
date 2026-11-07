"use client";
import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Client d'authentification (navigateur). Les droits sont toujours revérifiés côté serveur. */
export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        const next = new URLSearchParams(window.location.search).get("next") ?? "/compte";
        window.location.href = `/connexion/2fa?next=${encodeURIComponent(next)}`;
      },
    }),
  ],
});
