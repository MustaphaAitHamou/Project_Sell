import "server-only";
import { analyzeMessage, type MessageRiskFlag } from "@/lib/domain/message-risk";
import { PUBLIC_LISTING_STATES } from "@/lib/domain/listing-state";
import { sanitizeText, truncate } from "@/lib/domain/text";
import { env } from "@/lib/env";
import { track } from "@/server/analytics";
import type { CurrentUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { db, type DbOrTx } from "@/server/db/client";
import { processImage } from "@/server/images";
import { notify } from "@/server/notifications";
import { forbidden, invalid, notFound, precondition } from "@/server/security/errors";
import { rateLimit } from "@/server/security/rate-limit";
import { getNumberSetting, isEnabled } from "@/server/settings";
import { newStorageKey, putObject } from "@/server/storage";

const trustedHosts = () => [new URL(env.APP_URL).hostname];

async function isBlockedBetween(a: string, b: string, tx: DbOrTx = db) {
  const block = await tx.userBlock.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] }, select: { blockerId: true } });
  return block ? { byMe: block.blockerId === a } : null;
}

/** Première prise de contact à propos d'une annonce (une conversation par acheteur et par annonce). */
export async function startConversation(user: CurrentUser, listingId: string, body: string) {
  const listing = await db.listing.findUnique({ where: { id: listingId }, select: { id: true, sellerId: true, status: true, title: true, seller: { select: { status: true } } } });
  if (!listing || !(PUBLIC_LISTING_STATES as readonly string[]).includes(listing.status) || listing.seller.status !== "ACTIVE") throw notFound("Annonce introuvable.");
  if (listing.sellerId === user.id) throw invalid("Vous ne pouvez pas vous écrire à vous-même.");
  if (await isBlockedBetween(user.id, listing.sellerId)) throw forbidden("Ce membre ne peut pas recevoir de messages de votre part.");
  const existing = await db.conversation.findUnique({ where: { listingId_buyerId: { listingId, buyerId: user.id } }, select: { id: true } });
  if (!existing) {
    const limit = await getNumberSetting("messaging.maxNewConversationsPerDay");
    await rateLimit(`conversation.new:${user.id}`, limit, 86_400);
  }
  const conversation =
    existing ??
    (await db.conversation.upsert({
      where: { listingId_buyerId: { listingId, buyerId: user.id } },
      create: { listingId, buyerId: user.id, sellerId: listing.sellerId },
      update: {},
      select: { id: true },
    }));
  await sendMessage(user, conversation.id, body);
  return conversation;
}

/** Envoi d'un message par un participant. Les signaux de risque sont détectés et affichés au destinataire. */
export async function sendMessage(user: CurrentUser, conversationId: string, rawBody: string, image?: Uint8Array | null) {
  const conversation = await db.conversation.findUnique({ where: { id: conversationId }, include: { listing: { select: { title: true } } } });
  if (!conversation || (conversation.buyerId !== user.id && conversation.sellerId !== user.id)) throw notFound("Conversation introuvable.");
  if (conversation.status !== "OPEN") throw precondition("Cette conversation est fermée.");
  const recipientId = conversation.buyerId === user.id ? conversation.sellerId : conversation.buyerId;
  if (await isBlockedBetween(user.id, recipientId)) throw forbidden("Ce membre ne peut pas recevoir de messages de votre part.");
  await rateLimit(`message.send:${user.id}`, await getNumberSetting("messaging.maxMessagesPerMinute"), 60);

  const body = sanitizeText(rawBody).slice(0, 2000);
  if (!body && !image) throw invalid("Le message est vide.");
  let attachment: { storageKey: string; mimeType: string; sizeBytes: number; width: number; height: number } | null = null;
  if (image) {
    if (!(await isEnabled("messaging.attachments"))) throw precondition("Les pièces jointes sont désactivées.");
    const processed = await processImage(image, { largeMax: 1600, thumbMax: 400 });
    const id = crypto.randomUUID();
    const storageKey = newStorageKey("messages", id, "webp");
    await putObject(storageKey, processed.large, "image/webp");
    attachment = { storageKey, mimeType: "image/webp", sizeBytes: processed.large.byteLength, width: processed.width, height: processed.height };
  }
  const riskFlags: MessageRiskFlag[] = analyzeMessage(body, trustedHosts());
  const now = new Date();
  const isBuyer = conversation.buyerId === user.id;

  const message = await db.$transaction(async (tx) => {
    const m = await tx.message.create({
      data: { conversationId, senderId: user.id, body, riskFlags, attachments: attachment ? { create: attachment } : undefined },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now, lastMessagePreview: truncate(body || "📷 Photo", 140), ...(isBuyer ? { buyerLastReadAt: now } : { sellerLastReadAt: now }) },
    });
    await notify(tx, recipientId, {
      type: "NEW_MESSAGE",
      title: `Nouveau message — ${truncate(conversation.listing.title, 60)}`,
      body: `${user.profile?.displayName ?? "Un membre"} vous a écrit. Répondez depuis votre messagerie Tamurt Market.`,
      link: `/compte/messages/${conversationId}`,
      inApp: false,
      emailDedupeKey: `msg:${conversationId}:${recipientId}:${Math.floor(now.getTime() / 900_000)}`,
    });
    return m;
  });
  await track("message.sent", { userId: user.id, properties: { flagged: riskFlags.length > 0 } });
  return message;
}

export async function listConversations(user: Pick<CurrentUser, "id">) {
  const rows = await db.conversation.findMany({
    where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: {
      listing: { select: { id: true, title: true, publicId: true, slug: true, priceAmount: true, currency: true, status: true, images: { take: 1, orderBy: { sortOrder: "asc" }, select: { id: true } } } },
      buyer: { select: { id: true, profile: { select: { displayName: true, handle: true, avatarKey: true } } } },
      seller: { select: { id: true, profile: { select: { displayName: true, handle: true, avatarKey: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { senderId: true, createdAt: true } },
    },
  });
  return rows.map((c) => {
    const isBuyer = c.buyerId === user.id;
    const lastRead = isBuyer ? c.buyerLastReadAt : c.sellerLastReadAt;
    const last = c.messages[0];
    return {
      id: c.id,
      role: isBuyer ? ("BUYER" as const) : ("SELLER" as const),
      counterpart: isBuyer ? c.seller : c.buyer,
      listing: c.listing,
      lastMessageAt: c.lastMessageAt,
      preview: c.lastMessagePreview,
      unread: !!last && last.senderId !== user.id && (!lastRead || last.createdAt > lastRead),
    };
  });
}

/** Conversation complète pour un participant ; la consultation marque les messages comme lus. */
export async function getConversation(user: Pick<CurrentUser, "id">, conversationId: string) {
  const c = await db.conversation.findUnique({
    where: { id: conversationId },
    include: {
      listing: { select: { id: true, title: true, publicId: true, slug: true, priceAmount: true, currency: true, status: true, sellerId: true, images: { take: 1, orderBy: { sortOrder: "asc" }, select: { id: true } } } },
      buyer: { select: { id: true, createdAt: true, profile: { select: { displayName: true, handle: true, avatarKey: true, ratingSum: true, ratingCount: true } } } },
      seller: { select: { id: true, createdAt: true, profile: { select: { displayName: true, handle: true, avatarKey: true, ratingSum: true, ratingCount: true } } } },
      messages: { where: { isHidden: false }, orderBy: { createdAt: "asc" }, take: 300, include: { attachments: { select: { id: true, width: true, height: true } } } },
    },
  });
  if (!c || (c.buyerId !== user.id && c.sellerId !== user.id)) throw notFound("Conversation introuvable.");
  const isBuyer = c.buyerId === user.id;
  await db.conversation.update({ where: { id: c.id }, data: isBuyer ? { buyerLastReadAt: new Date() } : { sellerLastReadAt: new Date() } });
  const counterpartId = isBuyer ? c.sellerId : c.buyerId;
  const block = await isBlockedBetween(user.id, counterpartId);
  return { conversation: c, isBuyer, counterpart: isBuyer ? c.seller : c.buyer, block };
}

export async function setBlock(user: Pick<CurrentUser, "id">, targetUserId: string, blocked: boolean) {
  if (targetUserId === user.id) throw invalid("Action impossible.");
  const target = await db.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
  if (!target) throw notFound();
  if (blocked) await db.userBlock.upsert({ where: { blockerId_blockedId: { blockerId: user.id, blockedId: targetUserId } }, create: { blockerId: user.id, blockedId: targetUserId }, update: {} });
  else await db.userBlock.deleteMany({ where: { blockerId: user.id, blockedId: targetUserId } });
}

/** Pièce jointe : accessible aux seuls participants (ou au personnel habilité, journalisé). */
export async function getAttachmentForViewer(attachmentId: string, viewer: Pick<CurrentUser, "id" | "isStaff" | "roles">) {
  const a = await db.messageAttachment.findUnique({
    where: { id: attachmentId },
    select: { storageKey: true, mimeType: true, message: { select: { conversation: { select: { id: true, buyerId: true, sellerId: true } } } } },
  });
  if (!a) return null;
  const conv = a.message.conversation;
  if (conv.buyerId === viewer.id || conv.sellerId === viewer.id) return a;
  return null;
}

/** Lecture par la modération (signalement, litige) : permission dédiée et journal d'audit obligatoire. */
export async function staffReadConversation(staff: Pick<CurrentUser, "id" | "roles">, conversationId: string, reason: string) {
  const c = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 500 }, listing: { select: { title: true, publicId: true } } },
  });
  if (!c) throw notFound();
  await audit({ actorId: staff.id, actorRoles: staff.roles, action: "conversation.staff_read", targetType: "conversation", targetId: c.id, metadata: { reason } });
  return c;
}
