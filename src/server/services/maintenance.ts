import "server-only";
import { db } from "@/server/db/client";
import { drainJobs, recoverStuckJobs } from "@/server/jobs/runner";
import { logger } from "@/server/logger";
import { purgeRateLimitBuckets } from "@/server/security/rate-limit";
import { getNumberSetting } from "@/server/settings";
import { cleanupOrphanImages } from "./listings";
import { expireUnpaidOrders } from "./orders/checkout";
import { autoCompleteOrders } from "./orders/fulfillment";
import { replayFailedWebhooks, retryBlockedPayouts } from "./payments";
import { compensateTransportFailure } from "./transport-orders";

/**
 * Maintenance périodique (cron HTTP /api/cron/maintenance, toutes les 5 à 15 minutes) :
 * expirations, clôtures automatiques, compensations, relances, purges. Chaque étape est
 * isolée : l'échec de l'une n'empêche pas les suivantes.
 */
export async function runMaintenance() {
  const report: Record<string, number | string> = {};
  const step = async (name: string, fn: () => Promise<number | { count: number }>) => {
    try {
      const r = await fn();
      report[name] = typeof r === "number" ? r : r.count;
    } catch (e) {
      report[name] = "error";
      logger.error("maintenance.step_failed", { step: name, error: e });
    }
  };
  await step("stuckJobsRecovered", () => recoverStuckJobs());
  await step("unpaidOrdersExpired", () => expireUnpaidOrders());
  await step("ordersAutoCompleted", () => autoCompleteOrders());
  await step("transportHoldsCompensated", async () => {
    // Paiement reçu mais blocage Transport expiré sans confirmation : compensation.
    const stale = await db.transportReservation.findMany({ where: { status: "HELD", holdExpiresAt: { lt: new Date() }, order: { status: { in: ["PAID", "SHIPPING_PENDING"] } } }, select: { id: true }, take: 50 });
    for (const r of stale) await compensateTransportFailure(r.id, "Blocage Tamurt Transport expiré avant confirmation");
    await db.transportReservation.updateMany({ where: { status: "HELD", holdExpiresAt: { lt: new Date(Date.now() - 3_600_000) }, OR: [{ orderId: null }, { order: { status: { in: ["CANCELLED", "REFUNDED"] } } }] }, data: { status: "EXPIRED" } });
    return stale.length;
  });
  await step("webhooksReplayed", () => replayFailedWebhooks());
  await step("payoutsRetried", () => retryBlockedPayouts());
  await step("orphanImagesRemoved", () => cleanupOrphanImages());
  await step("rateLimitBucketsPurged", async () => {
    await purgeRateLimitBuckets();
    return 0;
  });
  await step("idempotencyRecordsPurged", async () => (await db.idempotencyRecord.deleteMany({ where: { expiresAt: { lt: new Date() } } })).count);
  await step("expiredSessionsPurged", async () => (await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })).count);
  await step("expiredVerificationsPurged", async () => (await db.verification.deleteMany({ where: { expiresAt: { lt: new Date() } } })).count);
  await step("analyticsEventsPurged", async () => {
    const days = await getNumberSetting("privacy.analyticsRetentionDays");
    return (await db.analyticsEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - days * 86_400_000) } } })).count;
  });
  await step("jobsDrained", () => drainJobs(200));
  return report;
}
