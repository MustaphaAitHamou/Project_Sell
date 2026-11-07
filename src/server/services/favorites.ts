import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { PUBLIC_LISTING_STATES } from "@/lib/domain/listing-state";
import { track } from "@/server/analytics";
import type { CurrentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { invalid, notFound } from "@/server/security/errors";
import { rateLimit } from "@/server/security/rate-limit";
import { cardSelect } from "./listings";

export async function toggleFavorite(user: Pick<CurrentUser, "id">, listingId: string): Promise<{ favorited: boolean }> {
  await rateLimit(`favorite:${user.id}`, 120, 60);
  const listing = await db.listing.findUnique({ where: { id: listingId }, select: { id: true, sellerId: true, status: true } });
  if (!listing || !(PUBLIC_LISTING_STATES as readonly string[]).includes(listing.status)) throw notFound("Annonce introuvable.");
  if (listing.sellerId === user.id) throw invalid("Vous ne pouvez pas ajouter votre propre annonce à vos favoris.");
  const existing = await db.favorite.findUnique({ where: { userId_listingId: { userId: user.id, listingId } } });
  if (existing) {
    await db.$transaction([
      db.favorite.delete({ where: { userId_listingId: { userId: user.id, listingId } } }),
      db.$executeRaw`UPDATE "listing" SET "favoriteCount" = GREATEST("favoriteCount" - 1, 0) WHERE "id" = ${listingId}::uuid`,
    ]);
    return { favorited: false };
  }
  try {
    await db.$transaction([
      db.favorite.create({ data: { userId: user.id, listingId } }),
      db.listing.update({ where: { id: listingId }, data: { favoriteCount: { increment: 1 } } }),
    ]);
  } catch (e) {
    // Double clic : la contrainte d'unicité garantit l'idempotence.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { favorited: true };
    throw e;
  }
  await track("favorite.added", { userId: user.id, properties: { listingId } });
  return { favorited: true };
}

export async function getFavoriteIds(userId: string, listingIds: string[]): Promise<Set<string>> {
  if (!listingIds.length) return new Set();
  const rows = await db.favorite.findMany({ where: { userId, listingId: { in: listingIds } }, select: { listingId: true } });
  return new Set(rows.map((r) => r.listingId));
}

export async function getFavorites(userId: string) {
  const rows = await db.favorite.findMany({
    where: { userId, listing: { status: { not: "DELETED" } } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { createdAt: true, listing: { select: cardSelect } },
  });
  return rows.map((r) => r.listing);
}
