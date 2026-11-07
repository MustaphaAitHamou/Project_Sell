import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { sanitizeText } from "@/lib/domain/text";
import type { CurrentUser } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { notify } from "@/server/notifications";
import { conflict, invalid, notFound, precondition } from "@/server/security/errors";
import { isEnabled } from "@/server/settings";

/**
 * Avis après transaction réelle uniquement : commande terminée, un avis par partie et par
 * commande (contrainte d'unicité), note de 1 à 5. Les agrégats de réputation sont mis à
 * jour dans la même transaction. Un avis peut être contesté et modéré.
 */
export async function createReview(user: Pick<CurrentUser, "id">, orderId: string, input: { rating: number; comment?: string | null }) {
  if (!(await isEnabled("reviews.enabled"))) throw precondition("Les avis sont momentanément désactivés.");
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw invalid("Note invalide.", { rating: ["Note de 1 à 5."] });
  const order = await db.order.findUnique({ where: { id: orderId }, select: { id: true, status: true, buyerId: true, sellerId: true, reference: true, completedAt: true } });
  if (!order || (order.buyerId !== user.id && order.sellerId !== user.id)) throw notFound("Commande introuvable.");
  if (order.status !== "COMPLETED") throw precondition("Un avis ne peut être laissé qu'une fois la transaction terminée.");
  if (order.completedAt && Date.now() - order.completedAt.getTime() > 60 * 86_400_000) throw precondition("Le délai pour laisser un avis (60 jours) est dépassé.");
  const isBuyer = order.buyerId === user.id;
  const subjectId = isBuyer ? order.sellerId : order.buyerId;
  const comment = input.comment ? sanitizeText(input.comment).slice(0, 1000) : null;
  try {
    await db.$transaction(async (tx) => {
      await tx.review.create({ data: { orderId, authorId: user.id, subjectId, authorRole: isBuyer ? "BUYER" : "SELLER", rating: input.rating, comment } });
      await tx.userProfile.update({ where: { userId: subjectId }, data: { ratingSum: { increment: input.rating }, ratingCount: { increment: 1 } } });
      await notify(tx, subjectId, { type: "REVIEW_RECEIVED", title: "Vous avez reçu un avis", body: `Un avis a été laissé suite à la transaction ${order.reference}.`, link: "/compte/profil" });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw conflict("Vous avez déjà laissé un avis pour cette transaction.");
    throw e;
  }
}

export async function contestReview(user: Pick<CurrentUser, "id">, reviewId: string, reason: string) {
  const review = await db.review.findUnique({ where: { id: reviewId } });
  if (!review || review.subjectId !== user.id) throw notFound("Avis introuvable.");
  if (review.contestedAt) throw conflict("Cet avis est déjà contesté.");
  const text = sanitizeText(reason).slice(0, 1000);
  if (text.length < 10) throw invalid("Expliquez la contestation (10 caractères minimum).");
  await db.$transaction([
    db.review.update({ where: { id: reviewId }, data: { contestedAt: new Date(), contestReason: text } }),
    db.report.create({ data: { reporterId: user.id, targetType: "REVIEW", targetId: reviewId, reason: "OTHER", details: `Contestation : ${text}` } }),
  ]);
}

export async function getPublicReviews(subjectId: string, take = 20) {
  return db.review.findMany({
    where: { subjectId, status: "VISIBLE" },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, rating: true, comment: true, authorRole: true, createdAt: true, replyBody: true, author: { select: { profile: { select: { displayName: true, handle: true } } } } },
  });
}

/** Masquage / rétablissement par la modération : les agrégats sont recalculés à l'identique. */
export async function setReviewVisibility(reviewId: string, visible: boolean) {
  await db.$transaction(async (tx) => {
    const review = await tx.review.findUniqueOrThrow({ where: { id: reviewId } });
    const wasVisible = review.status === "VISIBLE";
    if (wasVisible === visible) return;
    await tx.review.update({ where: { id: reviewId }, data: { status: visible ? "VISIBLE" : "HIDDEN" } });
    await tx.userProfile.update({
      where: { userId: review.subjectId },
      data: visible ? { ratingSum: { increment: review.rating }, ratingCount: { increment: 1 } } : { ratingSum: { decrement: review.rating }, ratingCount: { decrement: 1 } },
    });
  });
}
