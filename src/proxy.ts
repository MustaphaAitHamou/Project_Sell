import { getSessionCookie } from "better-auth/cookies";
import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const handleI18nRouting = createIntlMiddleware(routing);

/** Espaces réservés aux utilisateurs connectés (redirection de confort : chaque page revérifie côté serveur). */
const PROTECTED = /^\/(?:(?:ar|kab|en)\/)?(compte|vendre|commander|commande|admin|onboarding)(\/|$)/;

function contentSecurityPolicy(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  const storageOrigin = process.env.S3_PUBLIC_ORIGIN ?? "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Les attributs style (Radix, animations) imposent 'unsafe-inline' pour les styles uniquement.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: https://lh3.googleusercontent.com ${storageOrigin}`.trim(),
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(process.env.APP_URL?.startsWith("https://") ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/**
 * Proxy (anciennement « middleware ») : CSP stricte avec nonce par requête, routage de
 * langue next-intl et redirection de confort vers la connexion. L'autorisation réelle
 * est toujours vérifiée côté serveur (pages, Server Actions, Route Handlers).
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);

  const { pathname, search } = request.nextUrl;
  if (PROTECTED.test(pathname) && !getSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  headers.set("x-pathname", pathname);
  const forwarded = new NextRequest(request, { headers });

  const response = handleI18nRouting(forwarded);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Toutes les pages, hors API, fichiers internes Next.js et fichiers statiques.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
