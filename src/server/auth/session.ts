import "server-only";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { cache } from "react";
import type { SellerType, StaffRole, UserStatus } from "@/generated/prisma/client";
import { redirect } from "@/i18n/navigation";
import { adminRequires2fa } from "@/lib/env";
import { hasPermission, isStaff, permissionsFor, type Permission } from "@/lib/domain/permissions";
import { db } from "@/server/db/client";
import { forbidden, unauthenticated } from "@/server/security/errors";
import { auth } from "./index";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  status: UserStatus;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  termsAccepted: boolean;
  onboarded: boolean;
  roles: StaffRole[];
  isStaff: boolean;
  profile: { handle: string; displayName: string; countryCode: string | null; regionId: string | null; sellerType: SellerType; avatarKey: string | null } | null;
}

/**
 * Utilisateur courant, relu en base à chaque requête : le statut (suspension) et les
 * rôles font foi côté serveur, jamais une valeur en cache dans le cookie.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session) return null;
  const u = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      status: true,
      emailVerified: true,
      twoFactorEnabled: true,
      termsAcceptedAt: true,
      onboardedAt: true,
      roles: { select: { role: true } },
      profile: { select: { handle: true, displayName: true, countryCode: true, regionId: true, sellerType: true, avatarKey: true } },
    },
  });
  if (!u || u.status !== "ACTIVE") return null;
  const roles = u.roles.map((r) => r.role);
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    image: u.image,
    status: u.status,
    emailVerified: u.emailVerified,
    twoFactorEnabled: !!u.twoFactorEnabled,
    termsAccepted: !!u.termsAcceptedAt,
    onboarded: !!u.onboardedAt,
    roles,
    isStaff: isStaff(roles),
    profile: u.profile,
  };
});

async function localizedRedirect(href: string): Promise<never> {
  const locale = await getLocale();
  return redirect({ href, locale });
}

/** Server Actions et Route Handlers : lève une erreur si non connecté ou profil incomplet. */
export async function requireUser(opts: { onboarded?: boolean } = { onboarded: true }): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw unauthenticated();
  if (!u.termsAccepted) throw forbidden("Acceptez les conditions générales pour continuer.");
  if (opts.onboarded !== false && !u.onboarded) throw forbidden("Complétez votre profil pour continuer.");
  return u;
}

/** Pages : redirige vers la connexion, l'acceptation des conditions ou l'onboarding. */
export async function requireUserPage(next: string, opts: { onboarded?: boolean } = { onboarded: true }): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) return localizedRedirect(`/connexion?next=${encodeURIComponent(next)}`);
  if ((!u.termsAccepted || !u.onboarded) && opts.onboarded !== false) return localizedRedirect(`/onboarding?next=${encodeURIComponent(next)}`);
  return u;
}

export function can(u: Pick<CurrentUser, "roles">, permission: Permission): boolean {
  return hasPermission(u.roles, permission);
}

/** Back-office : permission fine + double authentification obligatoire (toujours en production). */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const u = await requireUser({ onboarded: false });
  if (!hasPermission(u.roles, permission)) throw forbidden();
  if (adminRequires2fa && !u.twoFactorEnabled) throw forbidden("La double authentification est obligatoire pour l'administration.");
  return u;
}

export async function requirePermissionPage(permission: Permission, next = "/admin"): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) return localizedRedirect(`/connexion?next=${encodeURIComponent(next)}`);
  if (!hasPermission(u.roles, permission)) return localizedRedirect(u.isStaff ? "/admin?erreur=permission" : "/compte?erreur=acces-refuse");
  if (adminRequires2fa && !u.twoFactorEnabled) return localizedRedirect("/compte/parametres?securite=2fa-requise");
  return u;
}

export function permissionSet(u: Pick<CurrentUser, "roles">) {
  return permissionsFor(u.roles);
}
