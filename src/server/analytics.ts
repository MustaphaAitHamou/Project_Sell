import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db/client";
import { logger } from "@/server/logger";

/**
 * Analytique produit minimisée : événements nommés, identifiant utilisateur interne
 * uniquement s'il est connecté, aucune IP, aucun user-agent, aucun contenu saisi.
 * Base légale à confirmer (intérêt légitime pour la mesure strictement nécessaire au
 * service) — voir docs/COMPLIANCE.md. Aucun cookie de mesure n'est déposé.
 */
export const ANALYTICS_EVENTS = [
  "user.signed_up",
  "listing.published",
  "listing.viewed",
  "favorite.added",
  "checkout.started",
  "payment.succeeded",
  "order.completed",
  "dispute.opened",
  "search.no_results",
  "search.performed",
  "transport.quote_requested",
  "transport.reservation_created",
  "message.sent",
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export async function track(name: AnalyticsEventName, opts: { userId?: string | null; properties?: Prisma.InputJsonValue } = {}) {
  try {
    await db.analyticsEvent.create({ data: { name, userId: opts.userId ?? null, properties: opts.properties ?? {} } });
  } catch (e) {
    logger.warn("analytics.failed", { name, error: e });
  }
}
