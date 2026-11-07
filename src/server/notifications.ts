import "server-only";
import type { NotificationType, Prisma } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import { db, type DbOrTx } from "@/server/db/client";
import { enqueue } from "@/server/jobs/queue";

/** Catégorie de préférence associée à chaque type (les emails transactionnels essentiels ne sont pas désactivables). */
const CATEGORY: Record<NotificationType, "TRANSACTIONAL" | "MESSAGES" | "SAVED_SEARCHES" | "ACCOUNT"> = {
  NEW_MESSAGE: "MESSAGES",
  NEW_ORDER: "TRANSACTIONAL",
  PAYMENT_CONFIRMED: "TRANSACTIONAL",
  ORDER_SHIPPED: "TRANSACTIONAL",
  ORDER_DELIVERED: "TRANSACTIONAL",
  ORDER_COMPLETED: "TRANSACTIONAL",
  ORDER_CANCELLED: "TRANSACTIONAL",
  REFUND_ISSUED: "TRANSACTIONAL",
  PAYOUT_SENT: "TRANSACTIONAL",
  DISPUTE_OPENED: "TRANSACTIONAL",
  DISPUTE_UPDATED: "TRANSACTIONAL",
  REVIEW_RECEIVED: "ACCOUNT",
  LISTING_APPROVED: "ACCOUNT",
  LISTING_REJECTED: "ACCOUNT",
  LISTING_SUSPENDED: "ACCOUNT",
  SAVED_SEARCH_MATCH: "SAVED_SEARCHES",
  ACCOUNT: "ACCOUNT",
  SYSTEM: "ACCOUNT",
};

export const NOTIFICATION_CATEGORIES = ["TRANSACTIONAL", "MESSAGES", "SAVED_SEARCHES", "ACCOUNT", "MARKETING"] as const;
/** Valeurs par défaut : communications commerciales désactivées (consentement explicite requis). */
export const DEFAULT_EMAIL_PREFS: Record<(typeof NOTIFICATION_CATEGORIES)[number], boolean> = {
  TRANSACTIONAL: true,
  MESSAGES: true,
  SAVED_SEARCHES: true,
  ACCOUNT: true,
  MARKETING: false,
};

export async function notify(
  tx: DbOrTx,
  userId: string,
  n: { type: NotificationType; title: string; body: string; link?: string; data?: Prisma.InputJsonValue },
) {
  await tx.notification.create({ data: { userId, type: n.type, title: n.title, body: n.body, link: n.link ?? null, data: n.data } });
  await enqueue(tx, "notification.email", { userId, type: n.type, title: n.title, body: n.body, link: n.link ?? null });
}

export async function emailAllowed(userId: string, type: NotificationType): Promise<boolean> {
  const category = CATEGORY[type];
  if (category === "TRANSACTIONAL") return true;
  const pref = await db.notificationPreference.findUnique({ where: { userId_channel_category: { userId, channel: "EMAIL", category } } });
  return pref?.enabled ?? DEFAULT_EMAIL_PREFS[category];
}

export function absoluteUrl(path: string) {
  return new URL(path, env.APP_URL).toString();
}
