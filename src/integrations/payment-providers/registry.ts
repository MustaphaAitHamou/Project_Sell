import "server-only";
import { env } from "@/lib/env";
import { sandboxProvider } from "./sandbox";
import type { PaymentProvider } from "./types";

/** Prestataire actif, ou null si l'achat intégré est désactivé (PAYMENT_PROVIDER=none). */
export function getActivePaymentProvider(): PaymentProvider | null {
  return env.PAYMENT_PROVIDER === "sandbox" ? sandboxProvider : null;
}

export function getPaymentProviderByCode(code: string): PaymentProvider | null {
  return code === "sandbox" ? sandboxProvider : null;
}
