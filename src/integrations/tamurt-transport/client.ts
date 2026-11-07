import "server-only";
import type { z } from "zod";
import { db } from "@/server/db/client";
import { logger } from "@/server/logger";
import {
  cancelReservationRequestSchema,
  confirmReservationRequestSchema,
  errorResponseSchema,
  healthResponseSchema,
  incidentAckSchema,
  incidentRequestSchema,
  quoteRequestSchema,
  quoteResponseSchema,
  reservationRequestSchema,
  reservationSchema,
  shipmentSchema,
  tokenResponseSchema,
  TRANSPORT_API_REVISION,
  TRANSPORT_SCOPES,
  type QuoteRequest,
} from "./contract";

/**
 * Client HTTP de l'API partenaire Tamurt Transport.
 * - Jeton de service à durée limitée (OAuth 2.0 client credentials), renouvelé avant expiration.
 * - Délai maximal par appel, reprises avec backoff exponentiel et gigue (uniquement pour
 *   les lectures et les écritures porteuses d'une clé d'idempotence).
 * - Disjoncteur : après des échecs consécutifs, les appels échouent immédiatement pendant
 *   une période de refroidissement ; Market reste fonctionnel et affiche un état dégradé.
 * - Chaque appel est journalisé dans integration_event (sans donnée personnelle).
 * - Toutes les réponses sont validées contre le contrat (schémas Zod).
 */

export class TransportUnavailableError extends Error {
  constructor(public readonly reason: "circuit_open" | "timeout" | "network" | "server_error" | "disabled" | "invalid_response") {
    super(`Tamurt Transport indisponible (${reason})`);
    this.name = "TransportUnavailableError";
  }
}

export class TransportApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "TransportApiError";
  }
}

export interface TransportClientOptions {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  timeoutMs: number;
  simulated: boolean;
  fetchImpl?: (input: Request) => Promise<Response>;
  /** Seuil d'échecs consécutifs ouvrant le disjoncteur et durée d'ouverture. */
  breaker?: { threshold: number; cooldownMs: number };
}

type Breaker = { failures: number; openUntil: number };
const breakers = (globalThis as unknown as { __tmTransportBreakers?: Map<string, Breaker> }).__tmTransportBreakers ?? new Map<string, Breaker>();
(globalThis as unknown as { __tmTransportBreakers?: Map<string, Breaker> }).__tmTransportBreakers = breakers;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class TransportClient {
  private token: { value: string; expiresAt: number } | null = null;
  private readonly breaker: Breaker;
  private readonly threshold: number;
  private readonly cooldownMs: number;

  constructor(private readonly opts: TransportClientOptions) {
    const key = `${opts.baseUrl}|${opts.clientId}`;
    this.breaker = breakers.get(key) ?? { failures: 0, openUntil: 0 };
    breakers.set(key, this.breaker);
    this.threshold = opts.breaker?.threshold ?? 3;
    this.cooldownMs = opts.breaker?.cooldownMs ?? 30_000;
  }

  get isSimulated() {
    return this.opts.simulated;
  }

  get circuitOpen() {
    return Date.now() < this.breaker.openUntil;
  }

  private async send(request: Request): Promise<Response> {
    const fetchImpl = this.opts.fetchImpl ?? ((r: Request) => fetch(r));
    return fetchImpl(request);
  }

  private async getToken(force = false): Promise<string> {
    if (!force && this.token && Date.now() < this.token.expiresAt - 60_000) return this.token.value;
    const body = new URLSearchParams({ grant_type: "client_credentials", client_id: this.opts.clientId, client_secret: this.opts.clientSecret, scope: TRANSPORT_SCOPES.join(" ") });
    const res = await this.send(
      new Request(`${this.opts.baseUrl}/oauth/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(this.opts.timeoutMs),
      }),
    );
    if (!res.ok) throw new TransportApiError(res.status, "unauthorized", "Authentification auprès de Tamurt Transport refusée", false);
    const parsed = tokenResponseSchema.safeParse(await res.json());
    if (!parsed.success) throw new TransportUnavailableError("invalid_response");
    this.token = { value: parsed.data.access_token, expiresAt: Date.now() + parsed.data.expires_in * 1000 };
    return this.token.value;
  }

  private async recordHealth(ok: boolean, error?: string) {
    const now = new Date();
    await db.integrationHealth
      .upsert({
        where: { system: "TRANSPORT" },
        create: { system: "TRANSPORT", status: ok ? "UP" : "DOWN", consecutiveFailures: ok ? 0 : 1, lastCheckedAt: now, ...(ok ? { lastSuccessAt: now } : { lastFailureAt: now, lastError: error?.slice(0, 1000) }) },
        update: ok
          ? { status: "UP", consecutiveFailures: 0, lastCheckedAt: now, lastSuccessAt: now, circuitOpenUntil: null }
          : {
              status: this.circuitOpen ? "DOWN" : "DEGRADED",
              consecutiveFailures: this.breaker.failures,
              lastCheckedAt: now,
              lastFailureAt: now,
              lastError: error?.slice(0, 1000),
              circuitOpenUntil: this.circuitOpen ? new Date(this.breaker.openUntil) : null,
            },
      })
      .catch(() => undefined);
  }

  private async request<S extends z.ZodType>(
    operation: string,
    method: "GET" | "POST",
    path: string,
    schema: S,
    opts: { body?: unknown; idempotencyKey?: string; retries?: number; aggregateId?: string } = {},
  ): Promise<z.output<S>> {
    if (this.circuitOpen) {
      await this.log(operation, "FAILED", { error: "circuit_open", aggregateId: opts.aggregateId });
      throw new TransportUnavailableError("circuit_open");
    }
    const retryable = method === "GET" || !!opts.idempotencyKey;
    const maxAttempts = 1 + (retryable ? (opts.retries ?? 2) : 0);
    const correlationId = crypto.randomUUID();
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const started = Date.now();
      try {
        const token = await this.getToken(attempt > 1 && lastError instanceof TransportApiError && lastError.status === 401);
        const res = await this.send(
          new Request(`${this.opts.baseUrl}${path}`, {
            method,
            headers: {
              authorization: `Bearer ${token}`,
              accept: "application/json",
              "tamurt-api-version": TRANSPORT_API_REVISION,
              "x-request-id": correlationId,
              ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
              ...(opts.idempotencyKey ? { "idempotency-key": opts.idempotencyKey } : {}),
            },
            body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
            signal: AbortSignal.timeout(this.opts.timeoutMs),
          }),
        );
        const durationMs = Date.now() - started;
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const err = errorResponseSchema.safeParse(json);
          const apiError = new TransportApiError(res.status, err.success ? err.data.error.code : "unavailable", err.success ? err.data.error.message : `HTTP ${res.status}`, res.status >= 500 || res.status === 429 || (err.success && err.data.error.retryable));
          await this.log(operation, "FAILED", { httpStatus: res.status, durationMs, attempt, correlationId, error: apiError.code, aggregateId: opts.aggregateId });
          if (res.status === 401 && attempt === 1) {
            lastError = apiError;
            this.token = null;
            continue;
          }
          if (apiError.retryable && attempt < maxAttempts) {
            lastError = apiError;
            await sleep(200 * 3 ** (attempt - 1) + Math.random() * 100);
            continue;
          }
          if (res.status >= 500) {
            this.onFailure(apiError.message);
            throw new TransportUnavailableError("server_error");
          }
          // Erreur métier (4xx) : le service répond, ce n'est pas une panne.
          this.onSuccess();
          throw apiError;
        }
        const parsed = schema.safeParse(json);
        if (!parsed.success) {
          await this.log(operation, "FAILED", { httpStatus: res.status, durationMs, attempt, correlationId, error: "invalid_response", aggregateId: opts.aggregateId });
          this.onFailure("Réponse non conforme au contrat");
          throw new TransportUnavailableError("invalid_response");
        }
        await this.log(operation, "PROCESSED", { httpStatus: res.status, durationMs, attempt, correlationId, aggregateId: opts.aggregateId });
        this.onSuccess();
        return parsed.data;
      } catch (e) {
        if (e instanceof TransportApiError || e instanceof TransportUnavailableError) throw e;
        const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
        lastError = e;
        await this.log(operation, "FAILED", { durationMs: Date.now() - started, attempt, correlationId, error: timeout ? "timeout" : "network", aggregateId: opts.aggregateId });
        if (attempt < maxAttempts) {
          await sleep(200 * 3 ** (attempt - 1) + Math.random() * 100);
          continue;
        }
        this.onFailure(timeout ? "timeout" : e instanceof Error ? e.message : "network");
        throw new TransportUnavailableError(timeout ? "timeout" : "network");
      }
    }
    throw new TransportUnavailableError("network");
  }

  private onSuccess() {
    this.breaker.failures = 0;
    this.breaker.openUntil = 0;
    void this.recordHealth(true);
  }

  private onFailure(error: string) {
    this.breaker.failures++;
    if (this.breaker.failures >= this.threshold) this.breaker.openUntil = Date.now() + this.cooldownMs;
    logger.warn("transport.failure", { failures: this.breaker.failures, circuitOpen: this.circuitOpen, error });
    void this.recordHealth(false, error);
  }

  private async log(operation: string, status: "PROCESSED" | "FAILED", m: { httpStatus?: number; durationMs?: number; attempt?: number; correlationId?: string; error?: string; aggregateId?: string }) {
    await db.integrationEvent
      .create({
        data: {
          system: "TRANSPORT",
          direction: "OUTBOUND",
          operation,
          status,
          httpStatus: m.httpStatus ?? null,
          durationMs: m.durationMs ?? null,
          attempt: m.attempt ?? 1,
          correlationId: m.correlationId ?? null,
          aggregateType: m.aggregateId ? "ORDER" : null,
          aggregateId: m.aggregateId ?? null,
          error: m.error ?? null,
          summary: { simulated: this.opts.simulated },
        },
      })
      .catch(() => undefined);
  }

  // ── Opérations du contrat v1 ─────────────────────────────────────────

  health() {
    return this.request("health", "GET", "/health", healthResponseSchema, { retries: 0 });
  }

  quotes(req: QuoteRequest) {
    return this.request("quotes.create", "POST", "/shipping/quotes", quoteResponseSchema, { body: quoteRequestSchema.parse(req), idempotencyKey: crypto.randomUUID(), retries: 1 });
  }

  reserve(req: z.input<typeof reservationRequestSchema>, idempotencyKey: string) {
    return this.request("reservations.create", "POST", "/shipping/reservations", reservationSchema, { body: reservationRequestSchema.parse(req), idempotencyKey, aggregateId: req.partnerOrderId });
  }

  confirm(reservationId: string, req: z.input<typeof confirmReservationRequestSchema>, idempotencyKey: string) {
    return this.request("reservations.confirm", "POST", `/shipping/reservations/${encodeURIComponent(reservationId)}/confirm`, reservationSchema, {
      body: confirmReservationRequestSchema.parse(req),
      idempotencyKey,
      aggregateId: req.partnerOrderId,
    });
  }

  cancel(reservationId: string, reason: string, idempotencyKey: string, partnerOrderId?: string) {
    return this.request("reservations.cancel", "POST", `/shipping/reservations/${encodeURIComponent(reservationId)}/cancel`, reservationSchema, {
      body: cancelReservationRequestSchema.parse({ reason }),
      idempotencyKey,
      aggregateId: partnerOrderId,
    });
  }

  getShipment(shipmentId: string) {
    return this.request("shipments.get", "GET", `/shipping/shipments/${encodeURIComponent(shipmentId)}`, shipmentSchema);
  }

  reportIncident(shipmentId: string, req: z.input<typeof incidentRequestSchema>, idempotencyKey: string) {
    return this.request("shipments.incident", "POST", `/shipping/shipments/${encodeURIComponent(shipmentId)}/incidents`, incidentAckSchema, { body: incidentRequestSchema.parse(req), idempotencyKey });
  }

  /** Remise à zéro du disjoncteur (tests, action d'administration). */
  resetBreaker() {
    this.breaker.failures = 0;
    this.breaker.openUntil = 0;
  }
}
