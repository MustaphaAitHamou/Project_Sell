import "server-only";
import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import { logger } from "@/server/logger";
import { renderEmail, type EmailTemplate } from "./templates";

/**
 * Envoi d'un email transactionnel.
 * - outbox (développement, tests) : l'email est seulement enregistré en base et
 *   consultable sur /dev/boite-mail. AUCUN email réel n'est envoyé.
 * - resend : API HTTP de Resend (adaptateur écrit, non exécuté sans clé ; voir docs/DEPLOYMENT.md).
 */
export async function sendEmail(to: string, template: EmailTemplate, data: Record<string, string>) {
  const rendered = renderEmail(template, data);
  if (env.EMAIL_PROVIDER === "outbox") {
    await db.emailMessage.create({ data: { to, ...rendered, template, provider: "outbox", status: "OUTBOX" } });
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject: rendered.subject, html: rendered.html, text: rendered.text }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  await db.emailMessage.create({
    data: { to, ...rendered, template, provider: "resend", providerMessageId: body.id ?? null, status: res.ok ? "SENT" : "FAILED", error: res.ok ? null : (body.message ?? `HTTP ${res.status}`) },
  });
  if (!res.ok) {
    logger.error("email.failed", { template, status: res.status });
    throw new Error(`Échec d'envoi de l'email (${res.status})`);
  }
}
