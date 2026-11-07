import "server-only";
import { db } from "@/server/db/client";

/**
 * Indicateurs du tableau de bord. Distinction stricte :
 * - GMV (volume brut de marchandises) : prix des articles des ventes conclues — ce n'est
 *   PAS un chiffre d'affaires de la plateforme ;
 * - chiffre d'affaires de la plateforme : frais de protection et commissions ACQUIS
 *   (registre comptable, compte *_fee_revenue) ;
 * - revenu net estimé : chiffre d'affaires − frais des prestataires de paiement ; ce n'est
 *   pas un bénéfice (coûts d'hébergement, de personnel, etc. non inclus).
 * Montants par devise, jamais additionnés entre devises.
 */
export async function getDashboardStats(days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const [users, newUsers, activeUsers, listings, activeListings, ordersByStatus, gmv, revenue, pspFees, refunds, openDisputes, byCountry, deliveries, funnel, pendingReview, openReports, failedJobs, failedWebhooks] = await Promise.all([
    db.user.count({ where: { status: { not: "DELETED" } } }),
    db.user.count({ where: { createdAt: { gte: since } } }),
    db.session.groupBy({ by: ["userId"], where: { updatedAt: { gte: since } } }).then((r) => r.length),
    db.listing.count({ where: { status: { not: "DELETED" } } }),
    db.listing.count({ where: { status: "ACTIVE" } }),
    db.order.groupBy({ by: ["status"], _count: true }),
    db.order.groupBy({ by: ["currency"], where: { status: "COMPLETED", completedAt: { gte: since } }, _sum: { itemsSubtotal: true }, _count: true }),
    db.$queryRaw<{ currency: string; amount: bigint }[]>`
      SELECT e."currency", SUM(CASE WHEN e."direction" = 'CREDIT' THEN e."amount" ELSE -e."amount" END) AS amount
      FROM "ledger_entry" e JOIN "ledger_transaction" t ON t."id" = e."transactionId"
      WHERE e."account" IN ('buyer_fee_revenue', 'seller_fee_revenue') AND t."occurredAt" >= ${since}
      GROUP BY e."currency"`,
    db.$queryRaw<{ currency: string; amount: bigint }[]>`
      SELECT e."currency", SUM(CASE WHEN e."direction" = 'DEBIT' THEN e."amount" ELSE -e."amount" END) AS amount
      FROM "ledger_entry" e JOIN "ledger_transaction" t ON t."id" = e."transactionId"
      WHERE e."account" = 'psp_fees' AND t."occurredAt" >= ${since}
      GROUP BY e."currency"`,
    db.refund.groupBy({ by: ["currency"], where: { status: "SUCCEEDED", succeededAt: { gte: since } }, _sum: { amount: true }, _count: true }),
    db.dispute.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    db.order.groupBy({ by: ["originCountry", "destinationCountry"], where: { status: { in: ["COMPLETED", "PAID", "SHIPPING_PENDING", "READY_TO_SHIP", "IN_TRANSIT", "DELIVERED", "DISPUTE_WINDOW"] }, createdAt: { gte: since } }, _count: true }),
    db.order.groupBy({ by: ["deliveryMethod"], where: { paidAt: { gte: since } }, _count: true }),
    db.analyticsEvent.groupBy({ by: ["name"], where: { createdAt: { gte: since }, name: { in: ["user.signed_up", "listing.viewed", "checkout.started", "payment.succeeded", "order.completed", "listing.published", "search.no_results", "transport.quote_requested"] } }, _count: true }),
    db.listing.count({ where: { status: "PENDING_REVIEW" } }),
    db.report.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
    db.job.count({ where: { status: "FAILED" } }),
    db.webhookEvent.count({ where: { status: "FAILED" } }),
  ]);
  const ev = Object.fromEntries(funnel.map((f) => [f.name, f._count]));
  const started = ev["checkout.started"] ?? 0;
  const paid = ev["payment.succeeded"] ?? 0;
  return {
    days,
    users,
    newUsers,
    activeUsers,
    listings,
    activeListings,
    ordersByStatus: Object.fromEntries(ordersByStatus.map((o) => [o.status, o._count])),
    gmv: gmv.map((g) => ({ currency: g.currency, amount: g._sum.itemsSubtotal ?? 0, count: g._count })),
    revenue: revenue.map((r) => ({ currency: r.currency, amount: Number(r.amount) })),
    pspFees: pspFees.map((r) => ({ currency: r.currency, amount: Number(r.amount) })),
    refunds: refunds.map((r) => ({ currency: r.currency, amount: r._sum.amount ?? 0, count: r._count })),
    openDisputes,
    byCountry: byCountry.map((b) => ({ corridor: `${b.originCountry} → ${b.destinationCountry}`, count: b._count })),
    deliveries: deliveries.map((d) => ({ method: d.deliveryMethod, count: d._count })),
    events: ev,
    checkoutConversion: started > 0 ? Math.round((paid / started) * 1000) / 10 : null,
    queues: { pendingReview, openReports, failedJobs, failedWebhooks },
  };
}

/** Entonnoirs (événements minimisés, sans traceur : les visiteurs anonymes ne sont pas comptés). */
export async function getFunnels(days = 90) {
  const since = new Date(Date.now() - days * 86_400_000);
  const [signedUp, sellersWithListing, sellersWithView, sellersWithSale, buyersCheckout, buyersPaid] = await Promise.all([
    db.user.count({ where: { createdAt: { gte: since } } }),
    db.user.count({ where: { createdAt: { gte: since }, listings: { some: { publishedAt: { not: null } } } } }),
    db.user.count({ where: { createdAt: { gte: since }, listings: { some: { viewCount: { gt: 0 } } } } }),
    db.user.count({ where: { createdAt: { gte: since }, ordersAsSeller: { some: { status: "COMPLETED" } } } }),
    db.user.count({ where: { createdAt: { gte: since }, ordersAsBuyer: { some: {} } } }),
    db.user.count({ where: { createdAt: { gte: since }, ordersAsBuyer: { some: { paidAt: { not: null } } } } }),
  ]);
  return {
    seller: [
      { label: "Inscrits", value: signedUp },
      { label: "Première annonce publiée", value: sellersWithListing },
      { label: "Première consultation reçue", value: sellersWithView },
      { label: "Première vente conclue", value: sellersWithSale },
    ],
    buyer: [
      { label: "Visiteurs", value: null as number | null },
      { label: "Inscrits", value: signedUp },
      { label: "Paiement commencé", value: buyersCheckout },
      { label: "Transaction réussie", value: buyersPaid },
    ],
  };
}
