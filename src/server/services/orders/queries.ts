import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { hasPermission } from "@/lib/domain/permissions";
import { ORDER_FUNDS_HELD_STATES } from "@/lib/domain/order-state";
import type { CurrentUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { db } from "@/server/db/client";
import { notFound } from "@/server/security/errors";

export const orderDetailInclude = {
  items: true,
  pricing: true,
  history: { orderBy: { createdAt: "asc" } },
  payments: { orderBy: { createdAt: "asc" }, select: { id: true, status: true, amount: true, currency: true, provider: true, isSimulated: true, isDuplicate: true, failureMessage: true, createdAt: true, succeededAt: true, amountRefunded: true } },
  refunds: { orderBy: { createdAt: "asc" }, select: { id: true, amount: true, currency: true, status: true, reason: true, createdAt: true } },
  payout: { select: { id: true, amount: true, currency: true, status: true, blockedReason: true, paidAt: true, isSimulated: true } },
  shipment: { include: { events: { orderBy: { occurredAt: "asc" } } } },
  transportReservations: { orderBy: { createdAt: "asc" }, select: { id: true, status: true, amount: true, currency: true, corridor: true, holdExpiresAt: true, confirmedAt: true, externalReservationId: true, externalShipmentId: true, isSimulated: true } },
  disputes: { orderBy: { createdAt: "desc" }, select: { id: true, status: true, reason: true, resolution: true, createdAt: true } },
  reviews: { select: { id: true, authorId: true, rating: true, comment: true, authorRole: true, createdAt: true } },
  listing: { select: { id: true, publicId: true, slug: true, title: true, status: true, images: { take: 1, orderBy: { sortOrder: "asc" }, select: { id: true } } } },
  buyer: { select: { id: true, profile: { select: { displayName: true, handle: true } } } },
  seller: { select: { id: true, profile: { select: { displayName: true, handle: true } } } },
} satisfies Prisma.OrderInclude;

export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

/**
 * Commande vue par l'une des parties ou par le personnel habilité (lecture journalisée).
 * L'adresse de livraison n'est communiquée au vendeur qu'une fois le paiement confirmé.
 */
export async function getOrderForViewer(user: Pick<CurrentUser, "id" | "roles">, orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: orderDetailInclude });
  if (!order) throw notFound("Commande introuvable.");
  const role = order.buyerId === user.id ? "BUYER" : order.sellerId === user.id ? "SELLER" : hasPermission(user.roles, "orders.read") ? "STAFF" : null;
  if (!role) throw notFound("Commande introuvable.");
  if (role === "STAFF") await audit({ actorId: user.id, actorRoles: user.roles, action: "order.staff_view", targetType: "order", targetId: order.id });
  const addressVisible = role !== "SELLER" || (ORDER_FUNDS_HELD_STATES as readonly string[]).includes(order.status) || order.status === "COMPLETED";
  return { order: { ...order, shippingAddress: addressVisible ? order.shippingAddress : null }, role };
}

const listSelect = {
  id: true,
  reference: true,
  status: true,
  totalAmount: true,
  sellerNetAmount: true,
  currency: true,
  deliveryMethod: true,
  createdAt: true,
  isSimulated: true,
  items: { select: { title: true, imageKey: true } },
  buyer: { select: { profile: { select: { displayName: true } } } },
  seller: { select: { profile: { select: { displayName: true } } } },
} satisfies Prisma.OrderSelect;

export async function listBuyerOrders(user: Pick<CurrentUser, "id">) {
  return db.order.findMany({ where: { buyerId: user.id }, orderBy: { createdAt: "desc" }, take: 100, select: listSelect });
}

export async function listSellerOrders(user: Pick<CurrentUser, "id">) {
  return db.order.findMany({ where: { sellerId: user.id, status: { notIn: ["CREATED"] } }, orderBy: { createdAt: "desc" }, take: 100, select: listSelect });
}
