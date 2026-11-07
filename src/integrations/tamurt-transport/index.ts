import "server-only";
import { env } from "@/lib/env";
import { TransportClient } from "./client";
import { SIMULATOR_BASE_URL, SIMULATOR_CLIENT_ID, simulatorClientSecret, simulatorFetch } from "./simulator";

let cached: TransportClient | null = null;

/** Client Tamurt Transport selon la configuration, ou null si l'intégration est désactivée. */
export function getTransportClient(): TransportClient | null {
  if (env.TRANSPORT_INTEGRATION === "disabled") return null;
  if (cached) return cached;
  cached =
    env.TRANSPORT_INTEGRATION === "simulator"
      ? new TransportClient({ baseUrl: SIMULATOR_BASE_URL, clientId: SIMULATOR_CLIENT_ID, clientSecret: simulatorClientSecret(), timeoutMs: env.TRANSPORT_TIMEOUT_MS, simulated: true, fetchImpl: simulatorFetch })
      : new TransportClient({ baseUrl: env.TRANSPORT_API_BASE_URL!, clientId: env.TRANSPORT_CLIENT_ID!, clientSecret: env.TRANSPORT_CLIENT_SECRET!, timeoutMs: env.TRANSPORT_TIMEOUT_MS, simulated: false });
  return cached;
}

export { TransportApiError, TransportUnavailableError } from "./client";
