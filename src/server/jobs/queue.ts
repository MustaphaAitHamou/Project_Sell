import "server-only";
import { after } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { db, type DbOrTx } from "@/server/db/client";

export type JobType =
  | "email.send"
  | "notification.email"
  | "transport.reservation.confirm"
  | "transport.reservation.cancel"
  | "transport.shipment.create"
  | "payout.release"
  | "refund.execute"
  | "images.cleanup";

/**
 * Demande le traitement de la file juste après l'envoi de la réponse HTTP (la
 * transaction est alors validée). Hors requête (tests, scripts), sans effet : le
 * cron /api/cron/jobs ou le worker `pnpm jobs:run` prend le relais.
 */
function kick() {
  if (process.env.VITEST || process.env.JOBS_INLINE_DISABLED === "true") return;
  try {
    after(async () => {
      const { drainJobs } = await import("./runner");
      await drainJobs(25).catch(() => undefined);
    });
  } catch {
    // Pas de contexte de requête.
  }
}

/** Ajoute une tâche dans la même transaction que l'opération métier (pattern outbox). */
export async function enqueue(
  tx: DbOrTx,
  type: JobType,
  payload: Prisma.InputJsonValue,
  opts: { dedupeKey?: string; runAt?: Date; maxAttempts?: number } = {},
) {
  if (opts.dedupeKey) {
    await tx.job.upsert({
      where: { dedupeKey: opts.dedupeKey },
      create: { type, payload, dedupeKey: opts.dedupeKey, runAt: opts.runAt, maxAttempts: opts.maxAttempts },
      update: {},
    });
  } else {
    await tx.job.create({ data: { type, payload, runAt: opts.runAt, maxAttempts: opts.maxAttempts } });
  }
  kick();
}

export { db };
