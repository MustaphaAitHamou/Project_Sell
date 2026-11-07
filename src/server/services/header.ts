import "server-only";
import { cache } from "react";
import { db } from "@/server/db/client";

/** Compteurs de l'en-tête : conversations non lues et notifications non lues. */
export const getHeaderCounts = cache(async (userId: string) => {
  const [unread, notifications] = await Promise.all([
    db.$queryRaw<{ count: bigint }[]>`
      SELECT count(DISTINCT m."conversationId") AS count
      FROM "message" m JOIN "conversation" c ON c."id" = m."conversationId"
      WHERE ((c."buyerId" = ${userId} AND (c."buyerLastReadAt" IS NULL OR m."createdAt" > c."buyerLastReadAt"))
          OR (c."sellerId" = ${userId} AND (c."sellerLastReadAt" IS NULL OR m."createdAt" > c."sellerLastReadAt")))
        AND m."senderId" IS DISTINCT FROM ${userId} AND NOT m."isHidden"`,
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { unreadConversations: Number(unread[0]?.count ?? 0), unreadNotifications: notifications };
});
