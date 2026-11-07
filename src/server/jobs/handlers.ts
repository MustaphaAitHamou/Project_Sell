import "server-only";
import type { Job, NotificationType } from "@/generated/prisma/client";
import { db } from "@/server/db/client";
import { sendEmail } from "@/server/email/send";
import { absoluteUrl, emailAllowed } from "@/server/notifications";

type Handler = (payload: unknown, job: Job) => Promise<void>;

const asRecord = (p: unknown) => (p && typeof p === "object" ? (p as Record<string, unknown>) : {});

export const JOB_HANDLERS: Record<string, Handler> = {
  "refund.execute": async (payload) => {
    const { executeRefund } = await import("@/server/services/payments");
    const p = asRecord(payload);
    await executeRefund({ refundId: String(p.refundId), kind: (p.kind as "FULL" | "PARTIAL" | "UNALLOCATED") ?? "FULL", relist: p.relist !== false });
  },
  "payout.release": async (payload) => {
    const { releasePayout } = await import("@/server/services/payments");
    await releasePayout(String(asRecord(payload).payoutId));
  },
  "transport.reservation.confirm": async (payload, job) => {
    const { confirmTransportReservation } = await import("@/server/services/transport-orders");
    await confirmTransportReservation(String(asRecord(payload).reservationId), job.attempts, job.maxAttempts);
  },
  "transport.reservation.cancel": async (payload) => {
    const { cancelTransportReservation } = await import("@/server/services/transport-orders");
    const p = asRecord(payload);
    await cancelTransportReservation(String(p.reservationId), String(p.reason ?? "Annulation"));
  },
  "images.cleanup": async () => {
    const { cleanupOrphanImages } = await import("@/server/services/listings");
    await cleanupOrphanImages();
  },
  "email.send": async (payload) => {
    const p = asRecord(payload);
    await sendEmail(String(p.to), p.template as "verifyEmail" | "resetPassword" | "notification", (p.data ?? {}) as Record<string, string>);
  },
  "notification.email": async (payload) => {
    const p = asRecord(payload);
    const userId = String(p.userId);
    if (!(await emailAllowed(userId, p.type as NotificationType))) return;
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, status: true, deletedAt: true } });
    if (!user || user.status === "DELETED" || user.deletedAt) return;
    await sendEmail(user.email, "notification", {
      title: String(p.title),
      body: String(p.body),
      ...(p.link ? { url: absoluteUrl(String(p.link)) } : {}),
    });
  },
};

/** Enregistrement des gestionnaires des autres modules (commandes, paiements, Transport). */
export function registerJobHandler(type: string, handler: Handler) {
  JOB_HANDLERS[type] = handler;
}
