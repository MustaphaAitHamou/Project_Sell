import "server-only";
import { env } from "@/lib/env";
import { signWebhook } from "@/server/security/crypto";
import {
  confirmReservationRequestSchema,
  quoteRequestSchema,
  reservationRequestSchema,
  TRANSPORT_API_VERSION,
  TRANSPORT_SIGNATURE_HEADER,
  type TransportEventType,
  type TransportQuote,
} from "./contract";

/**
 * ══════════════════════════════════════════════════════════════════════════
 * SIMULATEUR LOCAL de l'API partenaire Tamurt Transport (contrat v1)
 * ══════════════════════════════════════════════════════════════════════════
 * Développement et tests uniquement (refusé en production par src/lib/env.ts).
 * Trajets, voyageurs et prix FICTIFS. Aucune réservation ni expédition réelle.
 * Le corridor France ⇄ Algérie est « TEST_ONLY » comme dans Tamurt Sending : les devis
 * ne sont pas réservables, sauf activation explicite du mode « corridor ouvert » réservée
 * aux tests automatisés du parcours de réservation.
 */

export const SIMULATOR_BASE_URL = "https://transport-simulator.local/api/partner/v1";
export const SIMULATOR_CLIENT_ID = "tamurt-market-dev";
export const simulatorClientSecret = () => env.TRANSPORT_CLIENT_SECRET ?? "dev-simulator-client-secret";

type Trip = { id: string; corridor: "FR-DZ" | "DZ-FR"; originCity: string; destinationCity: string; mode: "PLANE" | "FERRY"; inDays: number; durationDays: number; pricePerKg: number; minPrice: number; capacityGrams: number; rating: number };

const TRIPS: Trip[] = [
  { id: "trip-par-alg", corridor: "FR-DZ", originCity: "Paris", destinationCity: "Alger", mode: "PLANE", inDays: 4, durationDays: 1, pricePerKg: 900, minPrice: 1500, capacityGrams: 15000, rating: 4.8 },
  { id: "trip-mrs-bja", corridor: "FR-DZ", originCity: "Marseille", destinationCity: "Béjaïa", mode: "FERRY", inDays: 6, durationDays: 2, pricePerKg: 700, minPrice: 1200, capacityGrams: 25000, rating: 4.6 },
  { id: "trip-lys-tzo", corridor: "FR-DZ", originCity: "Lyon", destinationCity: "Tizi Ouzou", mode: "PLANE", inDays: 9, durationDays: 2, pricePerKg: 1000, minPrice: 1800, capacityGrams: 10000, rating: 4.9 },
  { id: "trip-par-bja", corridor: "FR-DZ", originCity: "Paris", destinationCity: "Béjaïa", mode: "PLANE", inDays: 13, durationDays: 1, pricePerKg: 850, minPrice: 1500, capacityGrams: 12000, rating: 4.7 },
  { id: "trip-alg-par", corridor: "DZ-FR", originCity: "Alger", destinationCity: "Paris", mode: "PLANE", inDays: 5, durationDays: 1, pricePerKg: 1000, minPrice: 1500, capacityGrams: 12000, rating: 4.7 },
  { id: "trip-bja-mrs", corridor: "DZ-FR", originCity: "Béjaïa", destinationCity: "Marseille", mode: "FERRY", inDays: 8, durationDays: 2, pricePerKg: 800, minPrice: 1300, capacityGrams: 20000, rating: 4.5 },
  { id: "trip-tzo-lys", corridor: "DZ-FR", originCity: "Tizi Ouzou", destinationCity: "Lyon", mode: "PLANE", inDays: 11, durationDays: 2, pricePerKg: 1100, minPrice: 1800, capacityGrams: 10000, rating: 4.8 },
];

const ELECTRONICS = new Set(["smartphones", "ordinateurs-portables", "ordinateurs-fixes", "tablettes", "ecrans-peripheriques", "consoles", "accessoires-gaming", "audio-hifi", "photo-video", "tv-video", "electromenager"]);
const TO_VERIFY = new Set(["monnaies-billets", "art-oeuvres", "bijoux-montres", "bijoux-artisanaux"]);
const LIQUIDS = new Set(["beaute"]);

type SimReservation = { reservationId: string; partnerOrderId: string; quoteId: string; status: "HELD" | "CONFIRMED" | "CANCELLED" | "EXPIRED"; holdExpiresAt: number; price: { amount: number; currency: string }; shipmentId: string | null };
type SimShipment = { shipmentId: string; reservationId: string; partnerOrderId: string; status: string; events: { eventId: string; status: string; occurredAt: string; location?: string; description: string }[]; estimatedDelivery: { from: string; to: string } | null };
type SimQuote = TransportQuote & { tripId: string; weightGrams: number };

interface SimState {
  mode: "normal" | "down" | "slow";
  corridorLive: boolean;
  tokens: Map<string, number>;
  quotes: Map<string, SimQuote>;
  reservations: Map<string, SimReservation>;
  shipments: Map<string, SimShipment>;
  idempotency: Map<string, { status: number; body: unknown }>;
  reservedGrams: Map<string, number>;
}

const g = globalThis as unknown as { __tmTransportSim?: SimState };
export function simulatorState(): SimState {
  g.__tmTransportSim ??= { mode: "normal", corridorLive: false, tokens: new Map(), quotes: new Map(), reservations: new Map(), shipments: new Map(), idempotency: new Map(), reservedGrams: new Map() };
  return g.__tmTransportSim;
}
export function setSimulatorMode(mode: SimState["mode"]) {
  simulatorState().mode = mode;
}
export function setSimulatorCorridorLive(live: boolean) {
  simulatorState().corridorLive = live;
}
export function resetSimulator() {
  g.__tmTransportSim = undefined;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const error = (status: number, code: string, message: string, retryable = false) => json(status, { error: { code, message, retryable } });
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

function complianceFor(categoryCode: string): TransportQuote["compliance"] {
  if (TO_VERIFY.has(categoryCode)) return { status: "TO_VERIFY", notes: ["Marchandise susceptible d'être soumise à autorisation ou à déclaration spécifique : à instruire."] };
  if (ELECTRONICS.has(categoryCode))
    return { status: "CONDITIONAL", notes: ["Appareil électronique : batteries lithium soumises aux règles des compagnies.", "Facture ou preuve d'achat et déclaration de contenu requises."] };
  if (LIQUIDS.has(categoryCode)) return { status: "CONDITIONAL", notes: ["Liquides et aérosols limités ; produits neufs et scellés uniquement."] };
  return { status: "ALLOWED", notes: ["Déclaration de contenu requise."] };
}

/** Distributeur de requêtes : même interface qu'un appel HTTP (Request → Response). */
export async function simulatorFetch(request: Request): Promise<Response> {
  const state = simulatorState();
  if (state.mode === "slow") await new Promise((r) => setTimeout(r, env.TRANSPORT_TIMEOUT_MS + 1500));
  if (request.signal?.aborted) throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
  if (state.mode === "down") return error(503, "unavailable", "Service Tamurt Transport indisponible (simulation de panne)", true);

  const url = new URL(request.url);
  const path = url.pathname.replace(/^.*?\/v1(?=\/)/, "");
  const method = request.method.toUpperCase();

  if (method === "POST" && path === "/oauth/token") {
    const form = new URLSearchParams(await request.text());
    if (form.get("grant_type") !== "client_credentials" || form.get("client_id") !== SIMULATOR_CLIENT_ID || form.get("client_secret") !== simulatorClientSecret())
      return error(401, "unauthorized", "Identifiants client invalides");
    const token = id("sim_at");
    state.tokens.set(token, Date.now() + 900_000);
    return json(200, { access_token: token, token_type: "Bearer", expires_in: 900, scope: form.get("scope") ?? "" });
  }
  if (method === "GET" && path === "/health") return json(200, { status: "ok", apiVersion: TRANSPORT_API_VERSION });

  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const exp = state.tokens.get(auth);
  if (!exp || exp < Date.now()) return error(401, "unauthorized", "Jeton absent ou expiré");

  const idemKey = request.headers.get("idempotency-key");
  const idemScope = idemKey ? `${method} ${path} ${idemKey}` : null;
  if (idemScope && state.idempotency.has(idemScope)) {
    const cached = state.idempotency.get(idemScope)!;
    return json(cached.status, cached.body);
  }
  const respond = (status: number, body: unknown) => {
    if (idemScope && status < 500) state.idempotency.set(idemScope, { status, body });
    return json(status, body);
  };

  if (method === "POST" && path === "/shipping/quotes") {
    const parsed = quoteRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return error(400, "invalid_request", parsed.error.issues[0]?.message ?? "Requête invalide");
    const req = parsed.data;
    const corridor = `${req.origin.countryCode}-${req.destination.countryCode}`;
    const trips = TRIPS.filter((t) => t.corridor === corridor && t.capacityGrams - (state.reservedGrams.get(t.id) ?? 0) >= req.parcel.weightGrams);
    if (!["FR-DZ", "DZ-FR"].includes(corridor)) return respond(200, { corridorStatus: "DISABLED", quotes: [], notices: ["Corridor non desservi par Tamurt Transport."] });
    const compliance = complianceFor(req.parcel.categoryCode);
    const sorted = trips.sort((a, b) => Number(b.destinationCity === req.destination.city) - Number(a.destinationCity === req.destination.city) || a.inDays - b.inDays).slice(0, 3);
    const quotes: SimQuote[] = sorted.map((t) => {
      const amount = Math.max(t.minPrice, Math.ceil((t.pricePerKg * req.parcel.weightGrams) / 1000));
      return {
        quoteId: id("sim_qt"),
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        corridor,
        service: "crowdshipping",
        price: { amount, currency: "EUR" },
        trip: { departureDate: day(t.inDays), arrivalDate: day(t.inDays + t.durationDays), mode: t.mode, originCity: t.originCity, destinationCity: t.destinationCity, travelerRating: t.rating, travelerVerified: true },
        estimatedDelivery: { from: day(t.inDays + t.durationDays), to: day(t.inDays + t.durationDays + 3) },
        compliance,
        bookable: state.corridorLive && compliance.status !== "TO_VERIFY" && compliance.status !== "PROHIBITED",
        tripId: t.id,
        weightGrams: req.parcel.weightGrams,
      };
    });
    for (const q of quotes) state.quotes.set(q.quoteId, q);
    return respond(200, {
      corridorStatus: state.corridorLive ? "LIVE" : "TEST_ONLY",
      quotes: quotes.map(({ tripId: _t, weightGrams: _w, ...q }) => q),
      notices: state.corridorLive ? ["Simulation : corridor ouvert pour les tests automatisés."] : ["Corridor en phase de test : aucune réservation possible tant que la validation juridique n'est pas acquise."],
    });
  }

  if (method === "POST" && path === "/shipping/reservations") {
    const parsed = reservationRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return error(400, "invalid_request", "Requête invalide");
    const quote = state.quotes.get(parsed.data.quoteId);
    if (!quote) return respond(404, { error: { code: "not_found", message: "Devis inconnu", retryable: false } });
    if (Date.parse(quote.expiresAt) < Date.now()) return respond(409, { error: { code: "quote_expired", message: "Devis expiré", retryable: false } });
    if (!quote.bookable) return respond(409, { error: { code: "corridor_closed", message: "Ce corridor n'est pas ouvert aux réservations", retryable: false } });
    const trip = TRIPS.find((t) => t.id === quote.tripId)!;
    const used = state.reservedGrams.get(trip.id) ?? 0;
    if (used + quote.weightGrams > trip.capacityGrams) return respond(409, { error: { code: "capacity_unavailable", message: "Capacité insuffisante sur ce trajet", retryable: false } });
    state.reservedGrams.set(trip.id, used + quote.weightGrams);
    const reservation: SimReservation = { reservationId: id("sim_rsv"), partnerOrderId: parsed.data.partnerOrderId, quoteId: quote.quoteId, status: "HELD", holdExpiresAt: Date.now() + parsed.data.holdMinutes * 60_000, price: quote.price, shipmentId: null };
    state.reservations.set(reservation.reservationId, reservation);
    return respond(201, serializeReservation(reservation));
  }

  const confirmMatch = path.match(/^\/shipping\/reservations\/([^/]+)\/confirm$/);
  if (method === "POST" && confirmMatch) {
    const r = state.reservations.get(decodeURIComponent(confirmMatch[1]!));
    if (!r) return respond(404, { error: { code: "not_found", message: "Réservation inconnue", retryable: false } });
    const parsed = confirmReservationRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return error(400, "invalid_request", "Requête invalide");
    if (r.status === "CONFIRMED") return respond(200, serializeReservation(r));
    if (r.status !== "HELD" || r.holdExpiresAt < Date.now()) {
      r.status = r.status === "HELD" ? "EXPIRED" : r.status;
      return respond(409, { error: { code: "conflict", message: "Réservation expirée ou annulée", retryable: false } });
    }
    r.status = "CONFIRMED";
    const quote = state.quotes.get(r.quoteId)!;
    const shipment: SimShipment = {
      shipmentId: id("sim_shp"),
      reservationId: r.reservationId,
      partnerOrderId: r.partnerOrderId,
      status: "PENDING_PICKUP",
      events: [],
      estimatedDelivery: quote.estimatedDelivery,
    };
    r.shipmentId = shipment.shipmentId;
    state.shipments.set(shipment.shipmentId, shipment);
    queueMicrotask(() => void emitSimulatorEvent(r.reservationId, "transport.reservation.confirmed"));
    return respond(200, serializeReservation(r));
  }

  const cancelMatch = path.match(/^\/shipping\/reservations\/([^/]+)\/cancel$/);
  if (method === "POST" && cancelMatch) {
    const r = state.reservations.get(decodeURIComponent(cancelMatch[1]!));
    if (!r) return respond(404, { error: { code: "not_found", message: "Réservation inconnue", retryable: false } });
    if (r.status === "HELD" || r.status === "CONFIRMED") {
      const quote = state.quotes.get(r.quoteId);
      const trip = quote ? TRIPS.find((t) => t.id === quote.tripId) : undefined;
      if (trip && quote) state.reservedGrams.set(trip.id, Math.max(0, (state.reservedGrams.get(trip.id) ?? 0) - quote.weightGrams));
      r.status = "CANCELLED";
    }
    return respond(200, serializeReservation(r));
  }

  const shipmentMatch = path.match(/^\/shipping\/shipments\/([^/]+)$/);
  if (method === "GET" && shipmentMatch) {
    const s = state.shipments.get(decodeURIComponent(shipmentMatch[1]!));
    if (!s) return error(404, "not_found", "Expédition inconnue");
    return json(200, s);
  }

  const incidentMatch = path.match(/^\/shipping\/shipments\/([^/]+)\/incidents$/);
  if (method === "POST" && incidentMatch) {
    const s = state.shipments.get(decodeURIComponent(incidentMatch[1]!));
    if (!s) return error(404, "not_found", "Expédition inconnue");
    return respond(201, { incidentId: id("sim_inc"), status: "OPEN" });
  }

  return error(404, "not_found", "Route inconnue du contrat v1");
}

function serializeReservation(r: SimReservation) {
  return { reservationId: r.reservationId, partnerOrderId: r.partnerOrderId, status: r.status, holdExpiresAt: new Date(r.holdExpiresAt).toISOString(), price: r.price, shipmentId: r.shipmentId };
}

const SHIPMENT_STATUS_BY_EVENT: Partial<Record<TransportEventType, string>> = {
  "transport.shipment.collected": "COLLECTED",
  "transport.shipment.in_transit": "IN_TRANSIT",
  "transport.shipment.customs_hold": "CUSTOMS_HOLD",
  "transport.shipment.out_for_delivery": "OUT_FOR_DELIVERY",
  "transport.shipment.delivered": "DELIVERED",
  "transport.shipment.issue_reported": "ISSUE",
};

/**
 * Émet un événement signé vers le gestionnaire de webhooks de Market, exactement comme
 * le ferait Tamurt Transport (corps JSON + en-tête Tamurt-Signature).
 */
export async function emitSimulatorEvent(reservationId: string, type: TransportEventType, extra: { description?: string; location?: string; issueType?: string } = {}) {
  const state = simulatorState();
  const r = state.reservations.get(reservationId);
  if (!r) throw new Error("Réservation simulée inconnue");
  const shipment = r.shipmentId ? state.shipments.get(r.shipmentId) : undefined;
  const occurredAt = new Date().toISOString();
  const status = SHIPMENT_STATUS_BY_EVENT[type];
  if (shipment && status) {
    shipment.status = status;
    shipment.events.push({ eventId: id("sim_se"), status, occurredAt, location: extra.location, description: extra.description ?? type });
  }
  const event = {
    id: id("sim_evt"),
    type,
    apiVersion: TRANSPORT_API_VERSION,
    createdAt: occurredAt,
    data: { reservationId, partnerOrderId: r.partnerOrderId, shipmentId: r.shipmentId, occurredAt, location: extra.location, description: extra.description, issueType: extra.issueType },
  };
  const raw = JSON.stringify(event);
  const headers = new Headers({ "content-type": "application/json", [TRANSPORT_SIGNATURE_HEADER]: signWebhook(env.TRANSPORT_WEBHOOK_SECRET!, raw) });
  const { handleTransportWebhook } = await import("@/server/services/transport-webhooks");
  return handleTransportWebhook(raw, headers);
}

export function listSimulatorReservations() {
  const state = simulatorState();
  return [...state.reservations.values()].map((r) => ({ ...serializeReservation(r), shipment: r.shipmentId ? state.shipments.get(r.shipmentId) ?? null : null }));
}
