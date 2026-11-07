import "server-only";
import type { DisputeReason, DisputeResolution, OrderStatus } from "@/generated/prisma/client";
import { hasPermission } from "@/lib/domain/permissions";
import { ORDER_DISPUTABLE_STATES } from "@/lib/domain/order-state";
import { formatMoney } from "@/lib/domain/money";
import { sanitizeText } from "@/lib/domain/text";
import { track } from "@/server/analytics";
import type { CurrentUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { db } from "@/server/db/client";
import { processImage, sniffImageMime, sniffPdf } from "@/server/images";
import { notify } from "@/server/notifications";
import { conflict, forbidden, invalid, notFound, precondition } from "@/server/security/errors";
import { rateLimit } from "@/server/security/rate-limit";
import { getNumberSetting, getSetting } from "@/server/settings";
import { newStorageKey, putObject } from "@/server/storage";
import { completeOrder, getOrderRef, transitionOrder } from "./orders/core";
import { requestRefund } from "./payments";

export const DISPUTE_REASONS: { value: DisputeReason; label: string }[] = [
  { value: "NOT_RECEIVED", label: "Article non reçu" },
  { value: "DAMAGED", label: "Article endommagé" },
  { value: "NOT_AS_DESCRIBED", label: "Article non conforme à la description" },
  { value: "COUNTERFEIT", label: "Contrefaçon suspectée" },
  { value: "MISLEADING", label: "Description trompeuse" },
  { value: "LOST", label: "Colis perdu" },
  { value: "WRONG_RECIPIENT", label: "Livré à une autre personne" },
  { value: "OTHER", label: "Autre problème" },
];

/**
 * Ouverture d'un litige par l'acheteur (protection commerciale de Tamurt Market, distincte
 * des droits légaux du consommateur). Le versement au vendeur est bloqué pendant l'examen.
 */
export async function openDispute(user: CurrentUser, orderId: string, input: { reason: DisputeReason; description: string }) {
  await rateLimit(`dispute.open:${user.id}`, 5, 3600);
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.buyerId !== user.id) throw notFound("Commande introuvable.");
  if (!(ORDER_DISPUTABLE_STATES as readonly string[]).includes(order.status)) throw conflict("Un litige ne peut pas être ouvert à ce stade de la commande.");
  if (order.status === "IN_TRANSIT" || order.status === "READY_TO_SHIP" || order.status === "SHIPPING_PENDING") {
    // « Non reçu » : seulement après le délai d'acheminement raisonnable.
    const days = await getNumberSetting("protection.notReceivedAfterDays");
    if (order.paidAt && Date.now() - order.paidAt.getTime() < days * 86_400_000 && input.reason === "NOT_RECEIVED")
      throw precondition(`Un litige « non reçu » peut être ouvert ${days} jours après le paiement. Contactez d'abord le vendeur.`);
  }
  const description = sanitizeText(input.description).slice(0, 4000);
  if (description.length < 20) throw invalid("Décrivez le problème en 20 caractères minimum.", { description: ["Description trop courte."] });
  const respondHours = await getNumberSetting("protection.sellerResponseHours");
  const dispute = await db.$transaction(async (tx) => {
    const ref = await getOrderRef(tx, orderId);
    await transitionOrder(tx, ref, "DISPUTED", { type: "BUYER", id: user.id }, { reason: `Litige ouvert : ${input.reason}` });
    const d = await tx.dispute.create({
      data: {
        orderId,
        openedById: user.id,
        reason: input.reason,
        description,
        status: "AWAITING_SELLER",
        previousOrderStatus: ref.status,
        sellerRespondBy: new Date(Date.now() + respondHours * 3_600_000),
        messages: { create: { authorId: user.id, authorRole: "BUYER", body: description } },
      },
    });
    await tx.payout.updateMany({ where: { orderId, status: { in: ["PENDING", "BLOCKED"] } }, data: { status: "BLOCKED", blockedReason: "Litige en cours sur la commande." } });
    await notify(tx, order.sellerId, { type: "DISPUTE_OPENED", title: `Litige ouvert — ${order.reference}`, body: `L'acheteur signale un problème. Répondez sous ${respondHours} heures avec vos explications et preuves.`, link: `/commande/${orderId}/litige` });
    return d;
  });
  await track("dispute.opened", { userId: user.id, properties: { reason: input.reason } });
  return dispute;
}

async function disputeForViewer(user: Pick<CurrentUser, "id" | "roles">, disputeId: string) {
  const dispute = await db.dispute.findUnique({ where: { id: disputeId }, include: { order: { select: { id: true, buyerId: true, sellerId: true, reference: true, totalAmount: true, itemsSubtotal: true, currency: true, status: true } } } });
  if (!dispute) throw notFound("Litige introuvable.");
  const role = dispute.order.buyerId === user.id ? "BUYER" : dispute.order.sellerId === user.id ? "SELLER" : hasPermission(user.roles, "disputes.manage") ? "STAFF" : null;
  if (!role) throw notFound("Litige introuvable.");
  return { dispute, role };
}

export async function getDisputeForViewer(user: Pick<CurrentUser, "id" | "roles">, disputeId: string) {
  const { role } = await disputeForViewer(user, disputeId);
  const full = await db.dispute.findUniqueOrThrow({
    where: { id: disputeId },
    include: {
      messages: { where: role === "STAFF" ? {} : { visibility: "PARTIES" }, orderBy: { createdAt: "asc" } },
      evidence: { orderBy: { createdAt: "asc" }, select: { id: true, fileName: true, mimeType: true, sizeBytes: true, uploaderId: true, createdAt: true } },
      order: { include: { pricing: true, items: true, buyer: { select: { profile: { select: { displayName: true } } } }, seller: { select: { profile: { select: { displayName: true } } } } } },
      assignedTo: { select: { name: true } },
    },
  });
  if (role === "STAFF") await audit({ actorId: user.id, actorRoles: user.roles, action: "dispute.staff_view", targetType: "dispute", targetId: disputeId });
  return { dispute: full, role };
}

export async function addDisputeMessage(user: Pick<CurrentUser, "id" | "roles">, disputeId: string, body: string, staffOnly = false) {
  await rateLimit(`dispute.msg:${user.id}`, 30, 600);
  const { dispute, role } = await disputeForViewer(user, disputeId);
  if (["RESOLVED", "CLOSED"].includes(dispute.status)) throw conflict("Ce litige est clos.");
  const text = sanitizeText(body).slice(0, 4000);
  if (!text) throw invalid("Message vide.");
  await db.$transaction(async (tx) => {
    await tx.disputeMessage.create({ data: { disputeId, authorId: user.id, authorRole: role, body: text, visibility: role === "STAFF" && staffOnly ? "STAFF_ONLY" : "PARTIES" } });
    if (role === "SELLER" && dispute.status === "AWAITING_SELLER") await tx.dispute.update({ where: { id: disputeId }, data: { status: "UNDER_REVIEW" } });
    if (!(role === "STAFF" && staffOnly)) {
      const recipients = [dispute.order.buyerId, dispute.order.sellerId].filter((id) => id !== user.id);
      for (const r of recipients) await notify(tx, r, { type: "DISPUTE_UPDATED", title: `Litige ${dispute.order.reference} : nouveau message`, body: "Un nouveau message a été ajouté au dossier.", link: `/commande/${dispute.order.id}/litige` });
    }
  });
}

/** Preuve (photo ou PDF) : stockage privé, accessible aux seules parties et au personnel habilité. */
export async function addDisputeEvidence(user: Pick<CurrentUser, "id" | "roles">, disputeId: string, file: { bytes: Uint8Array; name: string }) {
  await rateLimit(`dispute.evidence:${user.id}`, 20, 3600);
  const { dispute } = await disputeForViewer(user, disputeId);
  if (["RESOLVED", "CLOSED"].includes(dispute.status)) throw conflict("Ce litige est clos.");
  const count = await db.disputeEvidence.count({ where: { disputeId } });
  if (count >= 15) throw precondition("15 pièces maximum par litige.");
  const id = crypto.randomUUID();
  let key: string;
  let bytes: Uint8Array;
  let mime: string;
  if (sniffImageMime(file.bytes)) {
    const processed = await processImage(file.bytes);
    key = newStorageKey("disputes", id, "webp");
    bytes = processed.large;
    mime = "image/webp";
  } else if (sniffPdf(file.bytes)) {
    if (file.bytes.byteLength > 8 * 1024 * 1024) throw invalid("PDF trop volumineux (8 Mo maximum).");
    key = newStorageKey("disputes", id, "pdf");
    bytes = file.bytes;
    mime = "application/pdf";
  } else throw invalid("Formats acceptés : photo (JPEG, PNG, WebP) ou PDF.");
  await putObject(key, bytes, mime);
  await db.disputeEvidence.create({ data: { id, disputeId, uploaderId: user.id, storageKey: key, mimeType: mime, sizeBytes: bytes.byteLength, fileName: sanitizeText(file.name, { multiline: false }).slice(0, 200) || "piece" } });
}

export async function getEvidenceForViewer(user: Pick<CurrentUser, "id" | "roles">, evidenceId: string) {
  const ev = await db.disputeEvidence.findUnique({ where: { id: evidenceId } });
  if (!ev) return null;
  const { role } = await disputeForViewer(user, ev.disputeId).catch(() => ({ role: null }));
  if (!role) return null;
  if (role === "STAFF") await audit({ actorId: user.id, actorRoles: user.roles, action: "dispute.evidence_view", targetType: "dispute_evidence", targetId: ev.id });
  return ev;
}

/** Retrait du litige par l'acheteur : la commande reprend son cours. */
export async function withdrawDispute(user: Pick<CurrentUser, "id" | "roles">, disputeId: string) {
  const { dispute, role } = await disputeForViewer(user, disputeId);
  if (role !== "BUYER") throw forbidden();
  if (["RESOLVED", "CLOSED"].includes(dispute.status)) throw conflict("Ce litige est déjà clos.");
  await db.$transaction(async (tx) => {
    const ref = await getOrderRef(tx, dispute.orderId);
    await transitionOrder(tx, ref, dispute.previousOrderStatus as OrderStatus, { type: "BUYER", id: user.id }, { reason: "Litige retiré par l'acheteur" });
    await tx.dispute.update({ where: { id: disputeId }, data: { status: "CLOSED", resolvedAt: new Date(), resolutionNote: "Retiré par l'acheteur" } });
    await tx.payout.updateMany({ where: { orderId: dispute.orderId, status: "BLOCKED", blockedReason: "Litige en cours sur la commande." }, data: { status: "PENDING", blockedReason: null } });
  });
}

/**
 * Décision du personnel. Le support ne peut décider seul d'un remboursement qu'en deçà
 * d'un plafond ; au-delà, la permission financière « payments.refund » est requise.
 * Aucune sanction ni décision n'est prise automatiquement par un système d'IA.
 */
export async function resolveDispute(
  staff: Pick<CurrentUser, "id" | "roles">,
  disputeId: string,
  input: { resolution: DisputeResolution; refundAmount?: number; note: string },
) {
  if (!hasPermission(staff.roles, "disputes.resolve")) throw forbidden();
  const { dispute } = await disputeForViewer(staff, disputeId);
  if (["RESOLVED", "CLOSED"].includes(dispute.status)) throw conflict("Ce litige est déjà clos.");
  const note = sanitizeText(input.note).slice(0, 2000);
  if (note.length < 10) throw invalid("Motivez la décision (10 caractères minimum).", { note: ["Motivation requise."] });
  const order = dispute.order;
  const amount = input.resolution === "FULL_REFUND" ? order.totalAmount : input.resolution === "PARTIAL_REFUND" ? (input.refundAmount ?? 0) : 0;
  if (input.resolution === "PARTIAL_REFUND" && (!Number.isSafeInteger(amount) || amount <= 0 || amount >= order.itemsSubtotal))
    throw invalid("Montant partiel invalide (strictement inférieur au prix de l'article).", { refundAmount: ["Montant invalide."] });
  if (amount > 0 && !hasPermission(staff.roles, "payments.refund")) {
    const caps = (await getSetting("support.maxRefundMinor")) as unknown as Record<string, number>;
    const cap = caps?.[order.currency] ?? 0;
    if (amount > cap) throw forbidden(`Remboursement supérieur au plafond du support (${formatMoney(cap, order.currency)}) : validation par l'équipe finance requise.`);
  }
  await db.$transaction(async (tx) => {
    const ref = await getOrderRef(tx, order.id);
    if (ref.status !== "DISPUTED") throw conflict("La commande n'est plus en litige.");
    const actor = { type: "STAFF" as const, id: staff.id };
    if (amount > 0) {
      await transitionOrder(tx, ref, "REFUND_PENDING", actor, { reason: `Décision de litige : ${input.resolution}` });
      await requestRefund(tx, { orderId: order.id, amount, reason: `Litige ${order.reference} : ${note}`, kind: input.resolution === "FULL_REFUND" ? "FULL" : "PARTIAL", initiatedById: staff.id, disputeId, relist: false });
    } else {
      await completeOrder(tx, ref, actor, "Litige clos sans remboursement");
    }
    await tx.dispute.update({ where: { id: disputeId }, data: { status: "RESOLVED", resolution: input.resolution, refundAmount: amount || null, resolutionNote: note, resolvedById: staff.id, resolvedAt: new Date() } });
    await tx.disputeMessage.create({ data: { disputeId, authorId: staff.id, authorRole: "STAFF", body: `Décision : ${input.resolution === "FULL_REFUND" ? "remboursement intégral" : input.resolution === "PARTIAL_REFUND" ? `remboursement partiel de ${formatMoney(amount, order.currency)}` : "aucun remboursement"}. ${note}` } });
    if (input.resolution !== "NO_REFUND") await tx.userProfile.update({ where: { userId: order.sellerId }, data: { disputesLostCount: { increment: 1 } } });
    await audit({ actorId: staff.id, actorRoles: staff.roles, action: "dispute.resolved", targetType: "dispute", targetId: disputeId, metadata: { resolution: input.resolution, amount } }, tx);
    for (const r of [order.buyerId, order.sellerId]) await notify(tx, r, { type: "DISPUTE_UPDATED", title: `Litige ${order.reference} : décision rendue`, body: "Consultez la décision et ses motifs dans le dossier.", link: `/commande/${order.id}/litige` });
  });
}

export async function listDisputesForStaff(status?: string) {
  return db.dispute.findMany({
    where: status && status !== "ALL" ? { status: status as never } : { status: { notIn: ["RESOLVED", "CLOSED"] } },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { order: { select: { reference: true, totalAmount: true, currency: true, isSimulated: true } }, openedBy: { select: { profile: { select: { displayName: true } } } } },
  });
}
