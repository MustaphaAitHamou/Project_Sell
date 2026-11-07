import "server-only";
import { NOTIFICATION_CATEGORIES } from "@/server/notifications";
import type { CurrentUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { db } from "@/server/db/client";
import { conflict } from "@/server/security/errors";

export async function getEmailPreferences(userId: string) {
  const rows = await db.notificationPreference.findMany({ where: { userId, channel: "EMAIL" } });
  return Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c, rows.find((r) => r.category === c)?.enabled ?? (c !== "MARKETING")])) as Record<(typeof NOTIFICATION_CATEGORIES)[number], boolean>;
}

/** Préférences d'emails : les messages transactionnels essentiels restent toujours envoyés. */
export async function setEmailPreference(user: Pick<CurrentUser, "id">, category: string, enabled: boolean) {
  if (!(NOTIFICATION_CATEGORIES as readonly string[]).includes(category) || category === "TRANSACTIONAL") return;
  await db.notificationPreference.upsert({
    where: { userId_channel_category: { userId: user.id, channel: "EMAIL", category } },
    create: { userId: user.id, channel: "EMAIL", category, enabled },
    update: { enabled },
  });
}

export async function markNotificationsRead(userId: string) {
  await db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}

/**
 * Suppression de compte (RGPD) : anonymisation immédiate des données personnelles ; les
 * données de transaction sont conservées sous forme pseudonymisée pour les obligations
 * légales (comptabilité, litiges) — durées à valider (voir docs/COMPLIANCE.md).
 */
export async function deleteOwnAccount(user: CurrentUser) {
  const open = await db.order.count({ where: { OR: [{ buyerId: user.id }, { sellerId: user.id }], status: { notIn: ["COMPLETED", "CANCELLED", "REFUNDED"] } } });
  if (open > 0) throw conflict("Des commandes sont en cours : finalisez-les avant de supprimer votre compte.");
  const pendingPayouts = await db.payout.count({ where: { sellerId: user.id, status: { in: ["PENDING", "PROCESSING", "BLOCKED"] } } });
  if (pendingPayouts > 0) throw conflict("Des versements sont en attente : contactez le support avant de supprimer votre compte.");
  const suffix = user.id.slice(0, 8);
  await db.$transaction(async (tx) => {
    await tx.listing.updateMany({ where: { sellerId: user.id, status: { notIn: ["SOLD", "DELETED"] } }, data: { status: "DELETED", deletedAt: new Date() } });
    await tx.address.deleteMany({ where: { userId: user.id } });
    await tx.userContact.deleteMany({ where: { userId: user.id } });
    await tx.savedSearch.deleteMany({ where: { userId: user.id } });
    await tx.favorite.deleteMany({ where: { userId: user.id } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.account.deleteMany({ where: { userId: user.id } });
    await tx.twoFactor.deleteMany({ where: { userId: user.id } });
    await tx.userProfile.update({ where: { userId: user.id }, data: { displayName: "Membre supprimé", handle: `membre-supprime-${suffix}`, bio: null, avatarKey: null, cityName: null } });
    await tx.user.update({ where: { id: user.id }, data: { name: "Membre supprimé", email: `supprime+${user.id}@invalid.tamurt`, image: null, status: "DELETED", deletedAt: new Date(), emailVerified: false } });
    await audit({ actorId: user.id, action: "account.self_deleted", targetType: "user", targetId: user.id }, tx);
  });
}
