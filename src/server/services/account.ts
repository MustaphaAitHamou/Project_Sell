import "server-only";
import { db } from "@/server/db/client";

/** Vue d'ensemble de l'espace membre : actions à mener en priorité. */
export async function getAccountOverview(userId: string) {
  const [listings, salesToProcess, salesInProgress, purchasesInProgress, favorites, payoutAccount, verifications, blockedPayouts, pendingPayouts] = await Promise.all([
    db.listing.groupBy({ by: ["status"], where: { sellerId: userId, status: { not: "DELETED" } }, _count: true }),
    db.order.count({ where: { sellerId: userId, status: "SHIPPING_PENDING" } }),
    db.order.count({ where: { sellerId: userId, status: { in: ["READY_TO_SHIP", "IN_TRANSIT", "DELIVERED", "DISPUTE_WINDOW", "DISPUTED"] } } }),
    db.order.count({ where: { buyerId: userId, status: { in: ["PAYMENT_PENDING", "PAID", "SHIPPING_PENDING", "READY_TO_SHIP", "IN_TRANSIT", "DELIVERED", "DISPUTE_WINDOW", "DISPUTED", "REFUND_PENDING"] } } }),
    db.favorite.count({ where: { userId } }),
    db.payoutAccount.findFirst({ where: { userId } }),
    db.userVerification.findMany({ where: { userId } }),
    db.payout.count({ where: { sellerId: userId, status: "BLOCKED" } }),
    db.payout.aggregate({ where: { sellerId: userId, status: { in: ["PENDING", "PROCESSING", "BLOCKED"] } }, _sum: { amount: true } }),
  ]);
  const byStatus = Object.fromEntries(listings.map((l) => [l.status, l._count]));
  return { byStatus, salesToProcess, salesInProgress, purchasesInProgress, favorites, payoutAccount, verifications, blockedPayouts, pendingPayoutAmount: pendingPayouts._sum.amount ?? 0 };
}
