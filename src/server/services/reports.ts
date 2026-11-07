import "server-only";
import { Prisma, type ReportReason, type ReportTargetType } from "@/generated/prisma/client";
import { sanitizeText } from "@/lib/domain/text";
import type { CurrentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { conflict, invalid, notFound } from "@/server/security/errors";
import { rateLimit } from "@/server/security/rate-limit";

/** Signalement d'une annonce, d'un membre, d'un message ou d'un avis (traité par la modération). */
export async function createReport(user: Pick<CurrentUser, "id">, input: { targetType: ReportTargetType; targetId: string; reason: ReportReason; details?: string | null }) {
  await rateLimit(`report:${user.id}`, 20, 3600);
  const exists = await (async () => {
    switch (input.targetType) {
      case "LISTING":
        return !!(await db.listing.findUnique({ where: { id: input.targetId }, select: { id: true, sellerId: true } }).then((l) => l && l.sellerId !== user.id));
      case "USER":
        return input.targetId !== user.id && !!(await db.user.findUnique({ where: { id: input.targetId }, select: { id: true } }));
      case "MESSAGE": {
        const m = await db.message.findUnique({ where: { id: input.targetId }, select: { senderId: true, conversation: { select: { buyerId: true, sellerId: true } } } });
        // Seul un participant peut signaler un message reçu.
        return !!m && m.senderId !== user.id && (m.conversation.buyerId === user.id || m.conversation.sellerId === user.id);
      }
      case "REVIEW":
        return !!(await db.review.findUnique({ where: { id: input.targetId }, select: { id: true } }));
    }
  })();
  if (!exists) throw notFound("Élément introuvable.");
  try {
    await db.report.create({
      data: { reporterId: user.id, targetType: input.targetType, targetId: input.targetId, reason: input.reason, details: input.details ? sanitizeText(input.details).slice(0, 2000) : null },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw conflict("Vous avez déjà signalé cet élément ; il est en cours d'examen.");
    throw e;
  }
}

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "PROHIBITED_ITEM", label: "Objet interdit ou dangereux" },
  { value: "COUNTERFEIT", label: "Contrefaçon" },
  { value: "SCAM", label: "Arnaque ou tentative de fraude" },
  { value: "MISLEADING", label: "Description trompeuse" },
  { value: "OFFENSIVE", label: "Contenu offensant ou haineux" },
  { value: "SPAM", label: "Spam ou publicité" },
  { value: "WRONG_CATEGORY", label: "Mauvaise catégorie" },
  { value: "OTHER", label: "Autre motif" },
];

export function assertReportReason(v: string): asserts v is ReportReason {
  if (!REPORT_REASONS.some((r) => r.value === v)) throw invalid("Motif invalide.");
}
