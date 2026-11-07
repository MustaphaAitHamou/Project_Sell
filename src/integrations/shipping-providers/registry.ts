import "server-only";
import { env } from "@/lib/env";
import { sandboxNationalCarrier } from "./sandbox-national";
import type { ShippingProviderAdapter } from "./types";

/** Adaptateurs disponibles dans cet environnement (aucun transporteur réel n'est intégré à ce jour). */
export function getShippingAdapter(code: string): ShippingProviderAdapter | null {
  if (code === "sandbox_national" && env.SHIPPING_PROVIDER === "sandbox") return sandboxNationalCarrier;
  return null;
}
