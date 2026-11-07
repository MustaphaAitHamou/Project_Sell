import "server-only";
import type { ModerationActionType, StaffRole, UserStatus } from "@/generated/prisma/client";
import { assertListingTransition } from "@/lib/domain/listing-state";
import { assignableRoles, hasPermission, type Permission } from "@/lib/domain/permissions";
import { sanitizeText } from "@/lib/domain/text";
import type { CurrentUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { db, type Tx } from "@/server/db/client";
import { notify } from "@/server/notifications";
import { conflict, forbidden, invalid, notFound } from "@/server/security/errors";
import { setReviewVisibility } from "./reviews";

type Staff = Pick<CurrentUser, "id" | "roles">;

function need(staff: Staff, p: Permission) {
  if (!hasPermission(staff.roles, p)) throw forbidden();
}

function reasonOf(reason: string, min = 5) {
  const r = sanitizeText(reason).slice(0, 1000);
  if (r.length < min) throw invalid("Motivez la décision (motif communiqué au membre).", { reason: ["Motif requis."] });
  return r;
}

async function record(tx: Tx, staff: Staff, action: ModerationActionType, targetType: string, targetId: string, reason: string, reportId?: string) {
  await tx.moderationAction.create({ data: { actorId: staff.id, targetType, targetId, action, reason, reportId: reportId ?? null } });
  await audit({ actorId: staff.id, actorRoles: staff.roles, action: `moderation.${action.toLowerCase()}`, targetType, targetId, metadata: { reason } }, tx);
}

/**
 * Décisions de modération : toujours prises par un humain habilité, motivées, journalisées
 * (table en ajout seul) et notifiées au membre concerné, qui peut demander un réexamen.
 */
export async function moderateListing(staff: Staff, listingId: string, decision: "APPROVE" | "REJECT" | "SUSPEND" | "REINSTATE" | "REMOVE", rawReason: string, reportId?: string) {
  need(staff, "listings.moderate");
  const reason = decision === "APPROVE" || decision === "REINSTATE" ? sanitizeText(rawReason).slice(0, 1000) || "Conforme" : reasonOf(rawReason);
  const listing = await db.listing.findUnique({ where: { id: listingId }, select: { id: true, status: true, version: true, sellerId: true, title: true } });
  if (!listing) throw notFound();
  const target = { APPROVE: "ACTIVE", REJECT: "REJECTED", SUSPEND: "SUSPENDED", REINSTATE: "ACTIVE", REMOVE: "DELETED" }[decision] as "ACTIVE";
  assertListingTransition(listing.status, target, "MODERATOR");
  if (decision === "SUSPEND" || decision === "REMOVE") {
    const active = await db.order.count({ where: { listingId, status: { in: ["CREATED", "PAYMENT_PENDING"] } } });
    if (active > 0) throw conflict("Un paiement est en cours sur cette annonce ; réessayez dans quelques minutes.");
  }
  const actionType = { APPROVE: "APPROVE_LISTING", REJECT: "REJECT_LISTING", SUSPEND: "SUSPEND_LISTING", REINSTATE: "REINSTATE_LISTING", REMOVE: "REMOVE_LISTING" }[decision] as ModerationActionType;
  await db.$transaction(async (tx) => {
    const res = await tx.listing.updateMany({
      where: { id: listingId, status: listing.status, version: listing.version },
      data: {
        status: target,
        version: { increment: 1 },
        moderationNote: decision === "APPROVE" || decision === "REINSTATE" ? null : reason,
        ...(decision === "APPROVE" ? { publishedAt: new Date() } : {}),
        ...(decision === "REMOVE" ? { deletedAt: new Date() } : {}),
      },
    });
    if (res.count !== 1) throw conflict("L'annonce a changé entre-temps.");
    await record(tx, staff, actionType, "listing", listingId, reason, reportId);
    if (reportId) await tx.report.update({ where: { id: reportId }, data: { status: "ACTIONED", handledById: staff.id, handledAt: new Date(), resolutionNote: reason } });
    const messages = {
      APPROVE: { type: "LISTING_APPROVED" as const, title: "Annonce publiée", body: `Votre annonce « ${listing.title} » a été validée et est en ligne.` },
      REJECT: { type: "LISTING_REJECTED" as const, title: "Annonce refusée", body: `Votre annonce « ${listing.title} » n'a pas été validée : ${reason}. Vous pouvez la modifier et la soumettre à nouveau.` },
      SUSPEND: { type: "LISTING_SUSPENDED" as const, title: "Annonce suspendue", body: `Votre annonce « ${listing.title} » a été suspendue : ${reason}. Vous pouvez contester cette décision auprès du support.` },
      REINSTATE: { type: "LISTING_APPROVED" as const, title: "Annonce rétablie", body: `Votre annonce « ${listing.title} » est de nouveau en ligne.` },
      REMOVE: { type: "LISTING_SUSPENDED" as const, title: "Annonce retirée", body: `Votre annonce « ${listing.title} » a été retirée : ${reason}. Vous pouvez contester cette décision auprès du support.` },
    }[decision];
    await notify(tx, listing.sellerId, { ...messages, link: "/compte/annonces" });
  });
}

export async function dismissReport(staff: Staff, reportId: string, note: string) {
  need(staff, "reports.handle");
  await db.$transaction(async (tx) => {
    const r = await tx.report.findUnique({ where: { id: reportId } });
    if (!r) throw notFound();
    if (r.status === "DISMISSED" || r.status === "ACTIONED") throw conflict("Signalement déjà traité.");
    await tx.report.update({ where: { id: reportId }, data: { status: "DISMISSED", handledById: staff.id, handledAt: new Date(), resolutionNote: sanitizeText(note).slice(0, 1000) || "Sans suite" } });
    await record(tx, staff, "DISMISS_REPORT", "report", reportId, note || "Sans suite");
  });
}

export async function hideMessage(staff: Staff, messageId: string, reason: string, reportId?: string) {
  need(staff, "messages.read_for_moderation");
  const r = reasonOf(reason);
  await db.$transaction(async (tx) => {
    await tx.message.update({ where: { id: messageId }, data: { isHidden: true, hiddenReason: r } });
    await record(tx, staff, "HIDE_MESSAGE", "message", messageId, r, reportId);
    if (reportId) await tx.report.update({ where: { id: reportId }, data: { status: "ACTIONED", handledById: staff.id, handledAt: new Date(), resolutionNote: r } });
  });
}

export async function moderateReview(staff: Staff, reviewId: string, visible: boolean, reason: string, reportId?: string) {
  need(staff, "reviews.moderate");
  await setReviewVisibility(reviewId, visible);
  await db.$transaction(async (tx) => {
    await record(tx, staff, visible ? "RESTORE_REVIEW" : "HIDE_REVIEW", "review", reviewId, reasonOf(reason, 3), reportId);
    if (reportId) await tx.report.update({ where: { id: reportId }, data: { status: "ACTIONED", handledById: staff.id, handledAt: new Date(), resolutionNote: reason } });
  });
}

/** Suspension / exclusion / rétablissement d'un compte. Une exclusion n'est jamais automatique. */
export async function setUserStatus(staff: Staff, userId: string, status: Extract<UserStatus, "ACTIVE" | "SUSPENDED" | "BANNED">, reason: string) {
  need(staff, status === "BANNED" ? "users.ban" : "users.suspend");
  if (userId === staff.id) throw invalid("Vous ne pouvez pas modifier votre propre statut.");
  const r = reasonOf(reason);
  const target = await db.user.findUnique({ where: { id: userId }, include: { roles: true } });
  if (!target || target.status === "DELETED") throw notFound();
  const targetRoles = target.roles.map((x) => x.role);
  if (targetRoles.includes("SUPER_ADMIN") && !staff.roles.includes("SUPER_ADMIN")) throw forbidden("Seul un super-administrateur peut agir sur ce compte.");
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status, statusReason: status === "ACTIVE" ? null : r } });
    if (status !== "ACTIVE") await tx.session.deleteMany({ where: { userId } });
    await record(tx, staff, status === "ACTIVE" ? "REINSTATE_USER" : status === "BANNED" ? "BAN_USER" : "SUSPEND_USER", "user", userId, r);
    await notify(tx, userId, {
      type: "ACCOUNT",
      title: status === "ACTIVE" ? "Compte rétabli" : "Compte suspendu",
      body: status === "ACTIVE" ? "Votre compte est de nouveau actif." : `Votre compte a été ${status === "BANNED" ? "exclu" : "suspendu"} : ${r}. Vous pouvez demander un réexamen en contactant le support.`,
    });
  });
}

/** Attribution des rôles du personnel (un administrateur ne peut pas créer d'administrateur). */
export async function setStaffRole(staff: Staff, userId: string, role: StaffRole, grant: boolean) {
  need(staff, "users.roles.assign");
  if (!assignableRoles(staff.roles).includes(role)) throw forbidden("Vous ne pouvez pas attribuer ce rôle.");
  if (userId === staff.id && !grant) throw invalid("Vous ne pouvez pas retirer vos propres rôles.");
  await db.$transaction(async (tx) => {
    if (grant) await tx.userRole.upsert({ where: { userId_role: { userId, role } }, create: { userId, role, grantedById: staff.id }, update: {} });
    else await tx.userRole.deleteMany({ where: { userId, role } });
    await audit({ actorId: staff.id, actorRoles: staff.roles, action: grant ? "role.granted" : "role.revoked", targetType: "user", targetId: userId, metadata: { role } }, tx);
  });
}
