import "server-only";
import { env, usesSimulators } from "@/lib/env";
import { hqMetricsSchema, type HqMetrics } from "@/server/api/hq/schemas";
import { db } from "@/server/db/client";

const toInt = (v: bigint | number | null | undefined) => Number(v ?? 0);

/** Agrégats pour Tamurt HQ, séparant systématiquement les montants simulés des montants réels. */
export async function getHqMetrics(windowDays = 30): Promise<HqMetrics> {
  const since = new Date(Date.now() - windowDays * 86_400_000);
  const [users, newUsers, activeUsers, activeListings, pendingReview, published, byStatus, paid, completed, gmv, revenue, fees, refunds, disputes, reports, health, reservations] = await Promise.all([
    db.user.count({ where: { status: { not: "DELETED" } } }),
    db.user.count({ where: { createdAt: { gte: since } } }),
    db.session.groupBy({ by: ["userId"], where: { updatedAt: { gte: since } } }).then((r) => r.length),
    db.listing.count({ where: { status: "ACTIVE" } }),
    db.listing.count({ where: { status: "PENDING_REVIEW" } }),
    db.listing.count({ where: { publishedAt: { gte: since } } }),
    db.order.groupBy({ by: ["status"], _count: true }),
    db.order.count({ where: { paidAt: { gte: since } } }),
    db.order.count({ where: { completedAt: { gte: since } } }),
    db.order.groupBy({ by: ["currency", "isSimulated"], where: { status: "COMPLETED", completedAt: { gte: since } }, _sum: { itemsSubtotal: true }, _count: true }),
    db.$queryRaw<{ currency: string; simulated: boolean; amount: bigint }[]>`
      SELECT e."currency", COALESCE(o."isSimulated", false) AS simulated, SUM(CASE WHEN e."direction" = 'CREDIT' THEN e."amount" ELSE -e."amount" END) AS amount
      FROM "ledger_entry" e JOIN "ledger_transaction" t ON t."id" = e."transactionId" LEFT JOIN "orders" o ON o."id" = t."orderId"
      WHERE e."account" IN ('buyer_fee_revenue', 'seller_fee_revenue') AND t."occurredAt" >= ${since}
      GROUP BY 1, 2`,
    db.$queryRaw<{ currency: string; simulated: boolean; amount: bigint }[]>`
      SELECT e."currency", COALESCE(o."isSimulated", false) AS simulated, SUM(CASE WHEN e."direction" = 'DEBIT' THEN e."amount" ELSE -e."amount" END) AS amount
      FROM "ledger_entry" e JOIN "ledger_transaction" t ON t."id" = e."transactionId" LEFT JOIN "orders" o ON o."id" = t."orderId"
      WHERE e."account" = 'psp_fees' AND t."occurredAt" >= ${since}
      GROUP BY 1, 2`,
    db.$queryRaw<{ currency: string; simulated: boolean; amount: bigint; count: bigint }[]>`
      SELECT r."currency", o."isSimulated" AS simulated, SUM(r."amount") AS amount, count(*) AS count
      FROM "refund" r JOIN "orders" o ON o."id" = r."orderId"
      WHERE r."status" = 'SUCCEEDED' AND r."succeededAt" >= ${since}
      GROUP BY 1, 2`,
    db.dispute.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    db.report.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
    db.integrationHealth.findUnique({ where: { system: "TRANSPORT" }, select: { status: true } }),
    db.transportReservation.groupBy({ by: ["status"], _count: true }),
  ]);
  return hqMetricsSchema.parse({
    apiVersion: "v1",
    generatedAt: new Date().toISOString(),
    environment: usesSimulators ? "simulation" : "production",
    windowDays,
    users: { total: users, newInWindow: newUsers, activeInWindow: activeUsers },
    listings: { active: activeListings, pendingReview, publishedInWindow: published },
    orders: { byStatus: Object.fromEntries(byStatus.map((o) => [o.status, o._count])), paidInWindow: paid, completedInWindow: completed },
    gmv: gmv.map((g) => ({ currency: g.currency, simulated: g.isSimulated, amount: g._sum.itemsSubtotal ?? 0, orders: g._count })),
    platformRevenue: revenue.map((r) => ({ currency: r.currency, simulated: r.simulated, amount: toInt(r.amount) })),
    paymentProviderFees: fees.map((r) => ({ currency: r.currency, simulated: r.simulated, amount: toInt(r.amount) })),
    refunds: refunds.map((r) => ({ currency: r.currency, simulated: r.simulated, amount: toInt(r.amount), count: toInt(r.count) })),
    trust: { openDisputes: disputes, openReports: reports },
    transport: { integration: env.TRANSPORT_INTEGRATION === "disabled" ? "disabled" : env.TRANSPORT_INTEGRATION === "simulator" ? "simulator" : "live", health: health?.status ?? "UNKNOWN", reservationsByStatus: Object.fromEntries(reservations.map((r) => [r.status, r._count])) },
  });
}
