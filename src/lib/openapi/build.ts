import { z } from "zod";
import * as transport from "@/integrations/tamurt-transport/contract";
import { hqMetricsSchema } from "@/server/api/hq/schemas";
import { categorySchema, errorSchema, listingDetailSchema, listingPageSchema, sellerProfileSchema } from "@/server/api/v1/schemas";

/**
 * Spécifications OpenAPI 3.1 générées depuis les schémas Zod (source de vérité unique) :
 * API publique v1, API interne Tamurt HQ et contrat partenaire Tamurt Transport proposé.
 * Générées à la demande (route /api/v1/openapi.json) et dans docs/openapi/ (pnpm openapi).
 */
type Json = Record<string, unknown>;

function components(entries: [string, z.ZodType][], io: "input" | "output"): Record<string, Json> {
  const registry = z.registry<{ id: string }>();
  for (const [id, schema] of entries) registry.add(schema, { id });
  const out = z.toJSONSchema(registry, { io, uri: (id) => `#/components/schemas/${id}`, unrepresentable: "any" }) as { schemas: Record<string, Json> };
  for (const s of Object.values(out.schemas)) {
    delete s.$schema;
    delete s.$id;
  }
  return out.schemas;
}

const ref = (id: string) => ({ $ref: `#/components/schemas/${id}` });
const jsonContent = (id: string) => ({ "application/json": { schema: ref(id) } });
const errors = (codes: number[]) => Object.fromEntries(codes.map((c) => [String(c), { description: { 400: "Requête invalide", 401: "Non authentifié", 403: "Accès refusé", 404: "Introuvable", 409: "Conflit", 422: "Validation", 429: "Trop de requêtes", 503: "Indisponible" }[c] ?? "Erreur", content: jsonContent("Error") }]));

export function buildPublicOpenApi(serverUrl: string): Json {
  // Les schémas de l'API publique portent leur identifiant (.meta({ id })) : registre global.
  const schemas = components(
    [
      ["Category", categorySchema],
      ["ListingPage", listingPageSchema],
      ["ListingDetail", listingDetailSchema],
      ["SellerProfile", sellerProfileSchema],
      ["Error", errorSchema],
    ],
    "output",
  );
  const q = (name: string, description: string, schema: Json = { type: "string" }) => ({ name, in: "query", required: false, description, schema });
  return {
    openapi: "3.1.0",
    info: { title: "Tamurt Market — API publique", version: "1.0.0", license: { name: "Propriétaire — Tamurt Services", identifier: "LicenseRef-Proprietary" }, description: "Lecture seule des données publiques (catégories, annonces, profils vendeurs). Aucune donnée personnelle non publique. Limite : 120 requêtes par minute et par adresse IP." },
    servers: [{ url: `${serverUrl}/api/v1` }],
    // API publique en lecture : aucune authentification (déclaré explicitement).
    security: [],
    paths: {
      "/categories": { get: { operationId: "listCategories", summary: "Catégories publiques", responses: { 200: { description: "Liste", content: { "application/json": { schema: { type: "object", properties: { items: { type: "array", items: ref("Category") } }, required: ["items"] } } } }, ...errors([429]) } } },
      "/listings": {
        get: {
          operationId: "searchListings",
          summary: "Recherche d'annonces",
          parameters: [
            q("q", "Texte recherché (tolère fautes de frappe et graphies latinisées)."),
            q("categorie", "Slug de catégorie (sous-catégories incluses)."),
            q("pays", "Code pays ISO (FR, DZ…)."),
            q("prix_min", "Prix minimal (exige « pays »)."),
            q("prix_max", "Prix maximal (exige « pays »)."),
            q("etat", "États séparés par des virgules (NEW_WITH_TAGS, VERY_GOOD…)."),
            q("livraison", "1 : livraison proposée."),
            q("vendeur", "particulier | pro"),
            q("tri", "pertinence | recent | prix_asc | prix_desc"),
            q("page", "Page (1 à 50).", { type: "integer", minimum: 1, maximum: 50 }),
          ],
          responses: { 200: { description: "Page de résultats", content: jsonContent("ListingPage") }, ...errors([429]) },
        },
      },
      "/listings/{id}": { get: { operationId: "getListing", summary: "Fiche d'annonce", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Annonce", content: jsonContent("ListingDetail") }, ...errors([404, 429]) } } },
      "/sellers/{handle}": { get: { operationId: "getSeller", summary: "Profil vendeur public", parameters: [{ name: "handle", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Profil", content: jsonContent("SellerProfile") }, ...errors([404, 429]) } } },
    },
    components: { schemas },
  };
}

export function buildHqOpenApi(serverUrl: string): Json {
  return {
    openapi: "3.1.0",
    info: { title: "Tamurt Market — API interne Tamurt HQ", version: "1.0.0", license: { name: "Propriétaire — Tamurt Services", identifier: "LicenseRef-Proprietary" }, description: "Indicateurs agrégés (aucune donnée personnelle). Jeton de service créé en administration (affiché une seule fois), portée metrics:read, restriction d'adresses IP possible, 60 requêtes par minute." },
    servers: [{ url: `${serverUrl}/api/internal/hq/v1` }],
    security: [{ serviceToken: [] }],
    paths: {
      "/metrics": {
        get: {
          operationId: "getMetrics",
          summary: "Indicateurs agrégés de la marketplace",
          parameters: [{ name: "jours", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 365, default: 30 } }],
          responses: { 200: { description: "Indicateurs", content: jsonContent("HqMetrics") }, ...errors([401, 403, 429]) },
        },
      },
    },
    components: { securitySchemes: { serviceToken: { type: "http", scheme: "bearer", bearerFormat: "tmhq_…" } }, schemas: components([["HqMetrics", hqMetricsSchema], ["Error", errorSchema]], "output") },
  };
}

export function buildTransportPartnerOpenApi(): Json {
  const req = components(
    [
      ["QuoteRequest", transport.quoteRequestSchema],
      ["ReservationRequest", transport.reservationRequestSchema],
      ["ConfirmReservationRequest", transport.confirmReservationRequestSchema],
      ["CancelReservationRequest", transport.cancelReservationRequestSchema],
      ["IncidentRequest", transport.incidentRequestSchema],
    ],
    "input",
  );
  const res = components(
    [
      ["TokenResponse", transport.tokenResponseSchema],
      ["QuoteResponse", transport.quoteResponseSchema],
      ["Reservation", transport.reservationSchema],
      ["Shipment", transport.shipmentSchema],
      ["IncidentAck", transport.incidentAckSchema],
      ["Health", transport.healthResponseSchema],
      ["TransportError", transport.errorResponseSchema],
      ["WebhookEvent", transport.webhookEventSchema],
    ],
    "output",
  );
  const terr = (codes: number[]) => Object.fromEntries(codes.map((c) => [String(c), { description: `Erreur ${c}`, content: { "application/json": { schema: ref("TransportError") } } }]));
  const idem = { name: "Idempotency-Key", in: "header", required: true, description: "Clé unique par opération ; rejouer la même clé renvoie le même résultat.", schema: { type: "string", maxLength: 200 } };
  const rev = { name: "Tamurt-Api-Version", in: "header", required: true, description: `Révision du contrat (actuelle : ${transport.TRANSPORT_API_REVISION}).`, schema: { type: "string" } };
  const body = (id: string) => ({ required: true, content: { "application/json": { schema: ref(id) } } });
  const id = (name: string) => ({ name, in: "path", required: true, schema: { type: "string" } });
  return {
    openapi: "3.1.0",
    info: {
      title: "Tamurt Transport — API partenaire (PROPOSITION de Tamurt Market)",
      license: { name: "Propriétaire — Tamurt Services", identifier: "LicenseRef-Proprietary" },
      version: `${transport.TRANSPORT_API_VERSION} (${transport.TRANSPORT_API_REVISION})`,
      description:
        "Contrat proposé par Tamurt Market ; Tamurt Transport ne l'implémente pas encore. Authentification OAuth 2.0 client credentials (portées shipping:quote, shipping:reserve, shipping:track), idempotence obligatoire sur les écritures, webhooks signés HMAC-SHA256 (en-tête tamurt-signature : t=<timestamp>,v1=<hex>).",
    },
    servers: [{ url: "{baseUrl}", variables: { baseUrl: { default: "https://transport.example.invalid/partner/v1", description: "[À DÉFINIR par l'équipe Tamurt Transport]" } } }],
    security: [{ oauth: [] }],
    paths: {
      "/oauth/token": {
        post: {
          security: [],
          operationId: "issueToken",
          summary: "Obtenir un jeton de service (client credentials)",
          requestBody: { required: true, content: { "application/x-www-form-urlencoded": { schema: { type: "object", properties: { grant_type: { const: "client_credentials" }, client_id: { type: "string" }, client_secret: { type: "string" }, scope: { type: "string" } }, required: ["grant_type", "client_id", "client_secret"] } } } },
          responses: { 200: { description: "Jeton (durée ≤ 1 h)", content: jsonContent("TokenResponse") }, ...terr([400, 401]) },
        },
      },
      "/health": { get: { operationId: "health", summary: "État du service", responses: { 200: { description: "État", content: jsonContent("Health") }, ...terr([503]) } } },
      "/shipping/quotes": { post: { operationId: "createQuotes", summary: "Demander des devis pour un colis", parameters: [idem, rev], requestBody: body("QuoteRequest"), responses: { 200: { description: "Devis", content: jsonContent("QuoteResponse") }, ...terr([400, 401, 403, 429, 503]) } } },
      "/shipping/reservations": { post: { operationId: "createReservation", summary: "Bloquer une capacité (avant paiement)", parameters: [idem, rev], requestBody: body("ReservationRequest"), responses: { 201: { description: "Capacité bloquée (HELD)", content: jsonContent("Reservation") }, ...terr([400, 401, 409, 422, 503]) } } },
      "/shipping/reservations/{reservationId}/confirm": { post: { operationId: "confirmReservation", summary: "Confirmer la réservation (après paiement)", parameters: [id("reservationId"), idem, rev], requestBody: body("ConfirmReservationRequest"), responses: { 200: { description: "Réservation confirmée", content: jsonContent("Reservation") }, ...terr([400, 401, 404, 409]) } } },
      "/shipping/reservations/{reservationId}/cancel": { post: { operationId: "cancelReservation", summary: "Annuler la réservation (compensation)", parameters: [id("reservationId"), idem, rev], requestBody: body("CancelReservationRequest"), responses: { 200: { description: "Réservation annulée", content: jsonContent("Reservation") }, ...terr([401, 404, 409]) } } },
      "/shipping/shipments/{shipmentId}": { get: { operationId: "getShipment", summary: "Suivi d'une expédition", parameters: [id("shipmentId"), rev], responses: { 200: { description: "Expédition", content: jsonContent("Shipment") }, ...terr([401, 404]) } } },
      "/shipping/shipments/{shipmentId}/incidents": { post: { operationId: "reportIncident", summary: "Signaler un incident", parameters: [id("shipmentId"), idem, rev], requestBody: body("IncidentRequest"), responses: { 201: { description: "Incident ouvert", content: jsonContent("IncidentAck") }, ...terr([400, 401, 404]) } } },
    },
    webhooks: {
      transportEvent: {
        post: {
          operationId: "receiveTransportEvent",
          summary: `Événements Transport → Market (${transport.TRANSPORT_EVENT_TYPES.length} types), signés ; Market répond 2xx après enregistrement idempotent (id unique).`,
          parameters: [{ name: transport.TRANSPORT_SIGNATURE_HEADER, in: "header", required: true, schema: { type: "string" } }],
          requestBody: { required: true, content: { "application/json": { schema: ref("WebhookEvent") } } },
          responses: { 200: { description: "Reçu" }, 401: { description: "Signature invalide" } },
        },
      },
    },
    components: { securitySchemes: { oauth: { type: "oauth2", flows: { clientCredentials: { tokenUrl: "/oauth/token", scopes: { "shipping:quote": "Devis", "shipping:reserve": "Réservations", "shipping:track": "Suivi" } } } } }, schemas: { ...req, ...res } },
  };
}
