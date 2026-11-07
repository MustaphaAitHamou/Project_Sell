import "server-only";
import type { Job } from "@/generated/prisma/client";
import { db } from "@/server/db/client";
import { logger } from "@/server/logger";

type Handler = (payload: unknown, job: Job) => Promise<void>;

async function handlers(): Promise<Record<string, Handler>> {
  const { JOB_HANDLERS } = await import("./handlers");
  return JOB_HANDLERS;
}

/** Délai avant nouvel essai : exponentiel (30 s, 1 min, 2 min…) avec gigue, plafonné à 1 h. */
export function retryDelayMs(attempts: number) {
  const base = Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 3_600_000);
  return base + Math.floor(Math.random() * 5_000);
}

/**
 * Traite les tâches dues. Verrouillage `FOR UPDATE SKIP LOCKED` : plusieurs instances
 * (after(), cron, worker) peuvent tourner en parallèle sans traiter deux fois une tâche.
 * Une tâche qui échoue maxAttempts fois reste FAILED (file des lettres mortes, visible
 * en administration et rejouable).
 */
export async function runDueJobs(limit = 20): Promise<{ processed: number; failed: number }> {
  const claimed = await db.$queryRaw<Job[]>`
    UPDATE "job" SET "status" = 'PROCESSING', "lockedAt" = now(), "attempts" = "attempts" + 1, "updatedAt" = now()
    WHERE "id" IN (
      SELECT "id" FROM "job" WHERE "status" = 'PENDING' AND "runAt" <= now()
      ORDER BY "runAt" ASC LIMIT ${limit} FOR UPDATE SKIP LOCKED
    )
    RETURNING *`;
  if (claimed.length === 0) return { processed: 0, failed: 0 };
  const registry = await handlers();
  let failed = 0;
  for (const job of claimed) {
    const handler = registry[job.type];
    try {
      if (!handler) throw new Error(`Aucun gestionnaire pour ${job.type}`);
      await handler(job.payload, job);
      await db.job.update({ where: { id: job.id }, data: { status: "DONE", lockedAt: null, lastError: null } });
    } catch (e) {
      failed++;
      const message = e instanceof Error ? e.message : String(e);
      const exhausted = job.attempts >= job.maxAttempts;
      await db.job.update({
        where: { id: job.id },
        data: {
          status: exhausted ? "FAILED" : "PENDING",
          lockedAt: null,
          lastError: message.slice(0, 2000),
          runAt: exhausted ? job.runAt : new Date(Date.now() + retryDelayMs(job.attempts)),
        },
      });
      logger.warn("job.failed", { jobId: job.id, type: job.type, attempts: job.attempts, exhausted, error: message });
    }
  }
  return { processed: claimed.length, failed };
}

/** Vide la file (borné) : utilisé après une requête et par le cron. */
export async function drainJobs(max = 100) {
  let total = 0;
  for (let i = 0; i < 10 && total < max; i++) {
    const { processed } = await runDueJobs(Math.min(20, max - total));
    total += processed;
    if (processed === 0) break;
  }
  return total;
}

/** Remet en file les tâches bloquées (instance arrêtée pendant le traitement). */
export async function recoverStuckJobs(olderThanMinutes = 10) {
  return db.job.updateMany({
    where: { status: "PROCESSING", lockedAt: { lt: new Date(Date.now() - olderThanMinutes * 60_000) } },
    data: { status: "PENDING", lockedAt: null },
  });
}
