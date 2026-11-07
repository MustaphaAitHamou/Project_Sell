import "server-only";
import type { Job, NotificationType } from "@/generated/prisma/client";
import { db } from "@/server/db/client";
import { sendEmail } from "@/server/email/send";
import { absoluteUrl, emailAllowed } from "@/server/notifications";

type Handler = (payload: unknown, job: Job) => Promise<void>;

const asRecord = (p: unknown) => (p && typeof p === "object" ? (p as Record<string, unknown>) : {});

export const JOB_HANDLERS: Record<string, Handler> = {
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
