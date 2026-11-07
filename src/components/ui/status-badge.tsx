import { getTranslations } from "next-intl/server";
import { Badge } from "./misc";

const ORDER_TONES: Record<string, "neutral" | "primary" | "success" | "warning" | "danger" | "info"> = {
  CREATED: "neutral",
  PAYMENT_PENDING: "warning",
  PAID: "info",
  SHIPPING_PENDING: "warning",
  READY_TO_SHIP: "info",
  IN_TRANSIT: "info",
  DELIVERED: "primary",
  DISPUTE_WINDOW: "primary",
  COMPLETED: "success",
  CANCELLED: "neutral",
  REFUND_PENDING: "warning",
  REFUNDED: "neutral",
  DISPUTED: "danger",
};
const LISTING_TONES: Record<string, "neutral" | "primary" | "success" | "warning" | "danger" | "info"> = {
  DRAFT: "neutral",
  PENDING_REVIEW: "warning",
  ACTIVE: "success",
  RESERVED: "info",
  SOLD: "primary",
  SUSPENDED: "danger",
  REJECTED: "danger",
  ARCHIVED: "neutral",
  DELETED: "neutral",
};

export async function OrderStatusBadge({ status }: { status: string }) {
  const t = await getTranslations("orderStatus");
  return <Badge tone={ORDER_TONES[status] ?? "neutral"}>{t(status as "PAID")}</Badge>;
}

export async function ListingStatusBadge({ status }: { status: string }) {
  const t = await getTranslations("listingStatus");
  return <Badge tone={LISTING_TONES[status] ?? "neutral"}>{t(status as "ACTIVE")}</Badge>;
}
