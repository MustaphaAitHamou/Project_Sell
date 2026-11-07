import "server-only";
import { getTransportClient, TransportApiError, TransportUnavailableError } from "@/integrations/tamurt-transport";
import { PARCEL_SIZE_MAX_GRAMS } from "@/features/listings/schemas";
import type { ComplianceDecision } from "@/lib/domain/compliance";
import { env } from "@/lib/env";
import { track } from "@/server/analytics";
import { db } from "@/server/db/client";
import { logger } from "@/server/logger";
import { notFound } from "@/server/security/errors";
import { rateLimit } from "@/server/security/rate-limit";
import { isEnabled } from "@/server/settings";
import { evaluateTrade } from "./compliance";

export type TransportQuoteView = {
  quoteId: string;
  amount: number;
  currency: string;
  departureDate: string;
  arrivalDate: string | null;
  mode: string;
  originCity: string;
  destinationCity: string;
  estimatedFrom: string;
  estimatedTo: string;
  travelerRating: number | null;
  travelerVerified: boolean;
  transportCompliance: string;
  notes: string[];
  bookable: boolean;
  expiresAt: string;
};

export type TransportQuoteResult =
  | { status: "ok"; simulated: boolean; corridorStatus: string; quotes: TransportQuoteView[]; notices: string[]; marketCompliance: ComplianceDecision; purchasable: boolean; blockers: string[] }
  | { status: "unavailable"; simulated: boolean; message: string }
  | { status: "disabled"; message: string }
  | { status: "blocked"; message: string; marketCompliance: ComplianceDecision };

/**
 * Devis Tamurt Transport pour une annonce et un pays de destination. Sans effet de bord
 * chez Transport. Une indisponibilité de Transport n'empêche jamais l'usage de Market :
 * l'interface affiche simplement l'état dégradé.
 */
export async function getTransportQuotes(input: { listingId: string; destinationCountry: string; destinationCity?: string; viewerId: string | null; viewerKey: string }): Promise<TransportQuoteResult> {
  await rateLimit(`transport.quotes:${input.viewerKey}`, 20, 600);
  const client = getTransportClient();
  if (!client || !(await isEnabled("transport.quotes"))) return { status: "disabled", message: "Les devis Tamurt Transport ne sont pas activés dans cet environnement." };

  const listing = await db.listing.findUnique({
    where: { id: input.listingId },
    select: { id: true, status: true, countryCode: true, priceAmount: true, currency: true, categoryId: true, weightGrams: true, parcelSize: true, deliveryMethods: true, acceptsCrossBorder: true, category: { select: { slug: true } }, city: { select: { name: true } }, region: { select: { code: true } } },
  });
  if (!listing || listing.status !== "ACTIVE" || !listing.deliveryMethods.includes("TAMURT_TRANSPORT")) throw notFound("Annonce introuvable ou non éligible à Tamurt Transport.");
  const crossBorder = input.destinationCountry !== listing.countryCode;
  if (crossBorder && !listing.acceptsCrossBorder) return { status: "disabled", message: "Le vendeur ne propose pas d'envoi vers l'étranger pour cet article." };

  const marketCompliance = await evaluateTrade({ originCountry: listing.countryCode, destinationCountry: input.destinationCountry, categoryId: listing.categoryId, paymentProvider: null, carrier: "tamurt_transport", declaredValueMinor: listing.priceAmount });
  if (marketCompliance.status === "PROHIBITED") return { status: "blocked", message: "Cet envoi n'est pas autorisé pour cette catégorie d'article entre ces pays.", marketCompliance };

  await track("transport.quote_requested", { userId: input.viewerId, properties: { corridor: `${listing.countryCode}-${input.destinationCountry}`, simulated: client.isSimulated } });
  try {
    const res = await client.quotes({
      partnerReference: listing.id,
      origin: { countryCode: listing.countryCode, city: listing.city?.name, regionCode: listing.region.code },
      destination: { countryCode: input.destinationCountry, city: input.destinationCity },
      parcel: {
        weightGrams: listing.weightGrams ?? PARCEL_SIZE_MAX_GRAMS[listing.parcelSize ?? "M"],
        sizeClass: listing.parcelSize ?? "M",
        declaredValue: { amount: listing.priceAmount, currency: listing.currency },
        categoryCode: listing.category.slug,
        isFragile: false,
      },
    });
    const crossBorderEnabled = await isEnabled("checkout.crossBorder");
    const blockers: string[] = [];
    if (crossBorder && !crossBorderEnabled) blockers.push("Les achats entre pays ne sont pas encore ouverts (validation juridique et opérationnelle en cours).");
    if (!marketCompliance.purchasable) blockers.push("Conformité de ce flux non validée par Tamurt Market (« à vérifier »).");
    if (res.corridorStatus !== "LIVE") blockers.push(`Corridor Tamurt Transport en statut ${res.corridorStatus === "TEST_ONLY" ? "« test uniquement »" : "« fermé »"}.`);
    if (res.quotes.some((q) => q.price.currency !== listing.currency))
      blockers.push(`Le transport est tarifé en ${res.quotes[0]?.price.currency} et l'article en ${listing.currency} : aucune conversion de devise n'est réalisée par la plateforme.`);

    // Les devis sont enregistrés côté serveur : seul leur identifiant transite par le navigateur.
    const now = Date.now();
    const quotes: TransportQuoteView[] = [];
    for (const q of res.quotes) {
      const stored = await db.shippingQuote.create({
        data: {
          listingId: listing.id,
          buyerId: input.viewerId,
          providerCode: "tamurt_transport",
          serviceCode: "crowdshipping",
          serviceName: `Tamurt Transport — ${q.trip.originCity} → ${q.trip.destinationCity}`,
          amount: q.price.amount,
          currency: q.price.currency,
          originCountry: listing.countryCode,
          destinationCountry: input.destinationCountry,
          estimatedDaysMin: Math.max(1, Math.round((Date.parse(q.estimatedDelivery.from) - now) / 86_400_000)),
          estimatedDaysMax: Math.max(1, Math.round((Date.parse(q.estimatedDelivery.to) - now) / 86_400_000)),
          externalQuoteId: q.quoteId,
          details: { trip: q.trip, compliance: q.compliance, bookable: q.bookable, corridorStatus: res.corridorStatus },
          isSimulated: client.isSimulated,
          expiresAt: new Date(q.expiresAt),
        },
      });
      quotes.push({
        quoteId: stored.id,
        amount: q.price.amount,
        currency: q.price.currency,
        departureDate: q.trip.departureDate,
        arrivalDate: q.trip.arrivalDate ?? null,
        mode: q.trip.mode,
        originCity: q.trip.originCity,
        destinationCity: q.trip.destinationCity,
        estimatedFrom: q.estimatedDelivery.from,
        estimatedTo: q.estimatedDelivery.to,
        travelerRating: q.trip.travelerRating ?? null,
        travelerVerified: q.trip.travelerVerified,
        transportCompliance: q.compliance.status,
        notes: q.compliance.notes,
        bookable: q.bookable,
        expiresAt: q.expiresAt,
      });
    }
    return { status: "ok", simulated: client.isSimulated, corridorStatus: res.corridorStatus, quotes, notices: res.notices, marketCompliance, purchasable: blockers.length === 0 && quotes.some((q) => q.bookable), blockers };
  } catch (e) {
    if (e instanceof TransportUnavailableError) return { status: "unavailable", simulated: client.isSimulated, message: "Tamurt Transport est momentanément indisponible. Les autres modes de remise restent disponibles ; réessayez plus tard." };
    if (e instanceof TransportApiError) {
      logger.warn("transport.quote_rejected", { code: e.code, status: e.status });
      return { status: "unavailable", simulated: client.isSimulated, message: "Aucun devis n'a pu être obtenu pour cet envoi." };
    }
    throw e;
  }
}

export async function getTransportStatus() {
  const client = getTransportClient();
  const health = await db.integrationHealth.findUnique({ where: { system: "TRANSPORT" } });
  return { mode: env.TRANSPORT_INTEGRATION, simulated: client?.isSimulated ?? false, circuitOpen: client?.circuitOpen ?? false, health };
}
