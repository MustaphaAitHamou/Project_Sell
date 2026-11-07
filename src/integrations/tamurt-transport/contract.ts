import { z } from "zod";

/**
 * ══════════════════════════════════════════════════════════════════════════
 * Contrat d'API partenaire Tamurt Transport — v1 (PROPOSITION)
 * ══════════════════════════════════════════════════════════════════════════
 * Tamurt Transport (dépôt « Tamurt Sending ») n'expose aujourd'hui aucune API
 * partenaire : ce contrat est la proposition de Tamurt Market, à implémenter côté
 * Transport (voir docs/TRANSPORT_INTEGRATION.md et docs/openapi/tamurt-transport-partner-v1.json).
 * Ces schémas Zod sont la source de vérité : ils peuvent être extraits dans un paquet
 * partagé (@tamurt/transport-contract) utilisé par les deux applications.
 *
 * Principes : aucune table partagée ; identifiants externes stables ; Market garde sa
 * référence de commande, Transport sa référence de réservation et d'expédition ;
 * jetons de service à durée limitée (OAuth 2.0 client credentials) ; clés d'idempotence
 * sur toute écriture ; webhooks signés HMAC-SHA256 ; versionnement par préfixe d'URL (/v1)
 * et en-tête de révision (Tamurt-Api-Version).
 */

export const TRANSPORT_API_VERSION = "v1";
export const TRANSPORT_API_REVISION = "2026-11-01";
export const TRANSPORT_SCOPES = ["shipping:quote", "shipping:reserve", "shipping:track"] as const;

const country = z.string().regex(/^[A-Z]{2}$/);
const currency = z.string().regex(/^[A-Z]{3}$/);
const money = z.object({ amount: z.number().int().nonnegative(), currency });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDateTime = z.string().datetime({ offset: true });

export const corridorStatusSchema = z.enum(["LIVE", "TEST_ONLY", "DISABLED"]);
export const transportModeSchema = z.enum(["PLANE", "CAR", "FERRY", "TRAIN", "BUS", "OTHER"]);
export const sizeClassSchema = z.enum(["XS", "S", "M", "L", "XL"]);

// ── Authentification ─────────────────────────────────────────────────────
export const tokenResponseSchema = z.object({
  access_token: z.string().min(20),
  token_type: z.literal("Bearer"),
  expires_in: z.number().int().positive().max(3600),
  scope: z.string(),
});

// ── Devis ────────────────────────────────────────────────────────────────
export const quoteRequestSchema = z.object({
  partnerReference: z.string().max(80).optional(),
  origin: z.object({ countryCode: country, city: z.string().max(120).optional(), regionCode: z.string().max(10).optional() }),
  destination: z.object({ countryCode: country, city: z.string().max(120).optional(), regionCode: z.string().max(10).optional() }),
  parcel: z.object({
    weightGrams: z.number().int().positive().max(30_000),
    sizeClass: sizeClassSchema,
    declaredValue: money,
    categoryCode: z.string().max(80),
    isFragile: z.boolean().default(false),
  }),
  earliestDate: isoDate.optional(),
  latestDate: isoDate.optional(),
});
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

export const quoteSchema = z.object({
  quoteId: z.string().min(1).max(120),
  expiresAt: isoDateTime,
  corridor: z.string().regex(/^[A-Z]{2}-[A-Z]{2}$/),
  service: z.literal("crowdshipping"),
  /** Prix final payé par l'expéditeur (inclut la rémunération de Tamurt Transport selon son propre contrat). */
  price: money,
  trip: z.object({
    departureDate: isoDate,
    arrivalDate: isoDate.optional(),
    mode: transportModeSchema,
    originCity: z.string(),
    destinationCity: z.string(),
    travelerRating: z.number().min(0).max(5).optional(),
    travelerVerified: z.boolean(),
  }),
  estimatedDelivery: z.object({ from: isoDate, to: isoDate }),
  /** Statut de conformité évalué par Transport pour ce trajet et cette marchandise. */
  compliance: z.object({ status: z.enum(["ALLOWED", "CONDITIONAL", "TO_VERIFY", "PROHIBITED"]), notes: z.array(z.string()).default([]) }),
  /** Réservable : faux tant que le corridor n'est pas LIVE ou que la marchandise n'est pas autorisée. */
  bookable: z.boolean(),
});
export type TransportQuote = z.infer<typeof quoteSchema>;

export const quoteResponseSchema = z.object({
  corridorStatus: corridorStatusSchema,
  quotes: z.array(quoteSchema),
  notices: z.array(z.string()).default([]),
});
export type QuoteResponse = z.infer<typeof quoteResponseSchema>;

// ── Réservations ────────────────────────────────────────────────────────
export const reservationRequestSchema = z.object({
  quoteId: z.string().min(1).max(120),
  partnerOrderId: z.string().min(1).max(80),
  /** Durée de blocage de la capacité, au plus 60 minutes (le temps du paiement). */
  holdMinutes: z.number().int().min(5).max(60),
});

export const reservationStatusSchema = z.enum(["HELD", "CONFIRMED", "CANCELLED", "EXPIRED"]);
export const reservationSchema = z.object({
  reservationId: z.string().min(1).max(120),
  partnerOrderId: z.string(),
  status: reservationStatusSchema,
  holdExpiresAt: isoDateTime,
  price: money,
  shipmentId: z.string().nullable(),
});
export type TransportReservationDto = z.infer<typeof reservationSchema>;

export const confirmReservationRequestSchema = z.object({
  partnerOrderId: z.string().min(1).max(80),
  /** Référence de paiement côté Market (jamais de donnée de carte). */
  paymentReference: z.string().min(1).max(120),
  /** Contacts transmis uniquement à la confirmation (minimisation). */
  sender: z.object({ displayName: z.string().max(120), phone: z.string().max(32).optional() }),
  recipient: z.object({ displayName: z.string().max(120), phone: z.string().max(32).optional(), city: z.string().max(120) }),
});

export const cancelReservationRequestSchema = z.object({ reason: z.string().min(1).max(300) });

// ── Expéditions ─────────────────────────────────────────────────────────
export const shipmentStatusSchema = z.enum(["PENDING_PICKUP", "COLLECTED", "IN_TRANSIT", "CUSTOMS_HOLD", "OUT_FOR_DELIVERY", "DELIVERED", "ISSUE", "CANCELLED"]);
export const shipmentEventSchema = z.object({ eventId: z.string(), status: shipmentStatusSchema, occurredAt: isoDateTime, location: z.string().optional(), description: z.string() });
export const shipmentSchema = z.object({
  shipmentId: z.string(),
  reservationId: z.string(),
  partnerOrderId: z.string(),
  status: shipmentStatusSchema,
  events: z.array(shipmentEventSchema),
  estimatedDelivery: z.object({ from: isoDate, to: isoDate }).nullable(),
});
export type TransportShipmentDto = z.infer<typeof shipmentSchema>;

export const incidentRequestSchema = z.object({
  type: z.enum(["DAMAGED", "LOST", "DELAY", "RECIPIENT_UNAVAILABLE", "OTHER"]),
  description: z.string().min(5).max(2000),
});

export const incidentAckSchema = z.object({ incidentId: z.string(), status: z.literal("OPEN") });
export const healthResponseSchema = z.object({ status: z.enum(["ok", "degraded"]), apiVersion: z.string() });

// ── Erreurs ─────────────────────────────────────────────────────────────
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.enum(["invalid_request", "unauthorized", "forbidden", "not_found", "conflict", "quote_expired", "capacity_unavailable", "corridor_closed", "item_not_allowed", "rate_limited", "unavailable"]),
    message: z.string(),
    retryable: z.boolean().default(false),
  }),
});

// ── Webhooks Transport → Market ─────────────────────────────────────────
export const TRANSPORT_EVENT_TYPES = [
  "transport.quote.created",
  "transport.reservation.created",
  "transport.reservation.confirmed",
  "transport.reservation.cancelled",
  "transport.reservation.expired",
  "transport.shipment.collected",
  "transport.shipment.in_transit",
  "transport.shipment.customs_hold",
  "transport.shipment.out_for_delivery",
  "transport.shipment.delivered",
  "transport.shipment.issue_reported",
] as const;
export type TransportEventType = (typeof TRANSPORT_EVENT_TYPES)[number];

export const webhookEventSchema = z.object({
  id: z.string().min(1).max(200),
  type: z.enum(TRANSPORT_EVENT_TYPES),
  apiVersion: z.literal(TRANSPORT_API_VERSION),
  createdAt: isoDateTime,
  data: z.object({
    reservationId: z.string(),
    partnerOrderId: z.string(),
    shipmentId: z.string().nullable().optional(),
    occurredAt: isoDateTime,
    location: z.string().optional(),
    description: z.string().optional(),
    issueType: z.string().optional(),
  }),
});
export type TransportWebhookEvent = z.infer<typeof webhookEventSchema>;

export const TRANSPORT_SIGNATURE_HEADER = "tamurt-signature";
