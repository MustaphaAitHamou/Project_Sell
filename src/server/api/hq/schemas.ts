import { z } from "zod";

const amountByCurrency = z.object({ currency: z.string().length(3), amount: z.int(), simulated: z.boolean() });

/** Indicateurs agrégés exposés à Tamurt HQ : aucune donnée personnelle, aucun identifiant de membre. */
export const hqMetricsSchema = z
  .object({
    apiVersion: z.literal("v1"),
    generatedAt: z.iso.datetime(),
    environment: z.enum(["production", "simulation"]).meta({ description: "« simulation » : prestataires de test, aucun montant réel." }),
    windowDays: z.int(),
    users: z.object({ total: z.int(), newInWindow: z.int(), activeInWindow: z.int() }),
    listings: z.object({ active: z.int(), pendingReview: z.int(), publishedInWindow: z.int() }),
    orders: z.object({ byStatus: z.record(z.string(), z.int()), paidInWindow: z.int(), completedInWindow: z.int() }),
    gmv: z.array(amountByCurrency.extend({ orders: z.int() })).meta({ description: "Volume d'affaires des ventes conclues : revient aux vendeurs, ce n'est pas un chiffre d'affaires." }),
    platformRevenue: z.array(amountByCurrency).meta({ description: "Frais acquis par la plateforme (registre comptable)." }),
    paymentProviderFees: z.array(amountByCurrency),
    refunds: z.array(amountByCurrency.extend({ count: z.int() })),
    trust: z.object({ openDisputes: z.int(), openReports: z.int() }),
    transport: z.object({ integration: z.enum(["disabled", "simulator", "live"]), health: z.string(), reservationsByStatus: z.record(z.string(), z.int()) }),
  })
  .meta({ id: "HqMetrics" });

export type HqMetrics = z.infer<typeof hqMetricsSchema>;
