import { AlertTriangle, KeyRound, MessageCircle, ShieldCheck, Truck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/misc";
import { OrderStatusBadge } from "@/components/ui/status-badge";
import { BuyerPaymentActions, ConfirmReceiptButton, CreateLabelButton, HandoverCodeForm, ReviewForm, SellerCancelForm } from "@/features/orders/order-actions";
import { OrderTimeline } from "@/features/orders/order-timeline";
import { Link } from "@/i18n/navigation";
import { listingPath } from "@/lib/domain/ids";
import { formatMoney } from "@/lib/domain/money";
import { cn, imageUrl } from "@/lib/utils";
import { requireUserPage } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { getHandoverCode } from "@/server/services/orders/fulfillment";
import { getOrderForViewer } from "@/server/services/orders/queries";

export const metadata: Metadata = { title: "Commande", robots: { index: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ paiement?: string }> };

export default async function OrderPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { paiement } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const user = await requireUserPage(`/commande/${id}`);
  const result = await getOrderForViewer(user, id).catch(() => null);
  if (!result) notFound();
  const { order, role } = result;
  const [t, format] = await Promise.all([getTranslations(), getFormatter()]);
  const isBuyer = role === "BUYER";
  const isSeller = role === "SELLER";
  const handoverCode = isBuyer ? await getHandoverCode(user, id) : null;
  const myReview = order.reviews.find((r) => r.authorId === user.id);
  const conversation = await db.conversation.findFirst({ where: { orderId: order.id }, select: { id: true } });
  const address = order.shippingAddress as null | { fullName: string; line1: string; line2?: string | null; postalCode?: string | null; city: string; countryCode: string; phone?: string | null };
  const p = order.pricing!;
  const counterpart = isBuyer ? order.seller.profile?.displayName : order.buyer.profile?.displayName;
  const openDispute = order.disputes.find((d) => !["RESOLVED", "CLOSED"].includes(d.status));

  return (
    <div className="container-page grid max-w-5xl gap-6 py-6 md:py-10">
      <PageHeader
        title={`Commande ${order.reference}`}
        description={`${isBuyer ? "Achat auprès de" : isSeller ? "Vente à" : "Commande entre"} ${counterpart ?? "un membre"} · ${format.dateTime(order.createdAt, { dateStyle: "long" })}`}
        actions={<OrderStatusBadge status={order.status} />}
      />
      {order.isSimulated ? <Alert tone="warning">Commande passée avec des simulateurs (paiement et/ou livraison) : aucune transaction réelle.</Alert> : null}
      {paiement === "ok" && order.status !== "PAYMENT_PENDING" ? <Alert tone="success">Paiement confirmé. Le vendeur a été prévenu.</Alert> : null}
      {paiement === "annule" ? <Alert tone="info">Paiement interrompu. Vous pouvez réessayer tant que la réservation est active.</Alert> : null}

      <Card className="p-5">
        <OrderTimeline status={order.status} handDelivery={order.deliveryMethod === "HAND_DELIVERY"} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)]">
        <div className="grid content-start gap-5">
          {/* Actions selon le rôle et l'état — toutes revérifiées côté serveur. */}
          {isBuyer && order.status === "PAYMENT_PENDING" ? (
            <Card className="grid gap-3 p-5">
              <p className="font-semibold">Paiement en attente</p>
              <p className="text-sm text-muted-foreground">
                L&apos;article vous est réservé jusqu&apos;au {order.reservationExpiresAt ? format.dateTime(order.reservationExpiresAt, { timeStyle: "short", dateStyle: "short" }) : "—"}.
              </p>
              <BuyerPaymentActions orderId={order.id} />
            </Card>
          ) : null}

          {isBuyer && handoverCode ? (
            <Card className="grid gap-3 border-primary/30 bg-primary-soft/40 p-5">
              <p className="flex items-center gap-2 font-semibold">
                <KeyRound className="size-5 text-primary-text" aria-hidden /> Votre code de remise
              </p>
              <p className="font-mono text-3xl font-bold tracking-[0.3em]" data-testid="handover-code">
                {handoverCode}
              </p>
              <p className="text-sm text-muted-foreground">Ne le communiquez au vendeur qu&apos;au moment de la remise, après avoir vérifié l&apos;article. Il confirme ainsi l&apos;échange.</p>
            </Card>
          ) : null}

          {isSeller && order.status === "SHIPPING_PENDING" && order.deliveryMethod === "HAND_DELIVERY" ? (
            <Card className="grid gap-3 p-5">
              <p className="font-semibold">Remise en main propre</p>
              <p className="text-sm text-muted-foreground">Convenez d&apos;un rendez-vous dans un lieu public. Lors de l&apos;échange, demandez à l&apos;acheteur son code de remise et saisissez-le ici.</p>
              <HandoverCodeForm orderId={order.id} />
            </Card>
          ) : null}

          {isSeller && order.status === "SHIPPING_PENDING" && order.deliveryMethod === "NATIONAL_SHIPPING" ? (
            <Card className="grid gap-3 p-5">
              <p className="font-semibold">Expédition</p>
              <p className="text-sm text-muted-foreground">Générez l&apos;étiquette, emballez soigneusement l&apos;article et déposez le colis. Le suivi est mis à jour par le transporteur.</p>
              <CreateLabelButton orderId={order.id} />
            </Card>
          ) : null}

          {isSeller && ["PAID", "SHIPPING_PENDING", "READY_TO_SHIP"].includes(order.status) && (!order.shipment || ["PENDING", "LABEL_CREATED"].includes(order.shipment.status)) ? <SellerCancelForm orderId={order.id} /> : null}

          {isBuyer && order.status === "IN_TRANSIT" ? (
            <Card className="grid gap-3 p-5">
              <p className="font-semibold">Colis en route</p>
              <p className="text-sm text-muted-foreground">Vous avez déjà reçu l&apos;article ? Confirmez-le pour ouvrir la période de vérification.</p>
              <ConfirmReceiptButton orderId={order.id} final={false} />
            </Card>
          ) : null}

          {isBuyer && order.status === "DISPUTE_WINDOW" ? (
            <Card className="grid gap-3 p-5">
              <p className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="size-5 text-primary-text" aria-hidden /> Vérifiez votre article
              </p>
              <p className="text-sm text-muted-foreground">
                Sans action de votre part, la vente sera clôturée le {order.disputeWindowEndsAt ? format.dateTime(order.disputeWindowEndsAt, { dateStyle: "long", timeStyle: "short" }) : "—"} et le vendeur sera payé.
              </p>
              <div className="flex flex-wrap gap-2">
                <ConfirmReceiptButton orderId={order.id} final />
                <Link href={`/commande/${order.id}/litige`} className={buttonVariants({ variant: "destructive-outline" })}>
                  <AlertTriangle /> Signaler un problème
                </Link>
              </div>
            </Card>
          ) : null}

          {isBuyer && ["SHIPPING_PENDING", "READY_TO_SHIP", "IN_TRANSIT"].includes(order.status) ? (
            <p className="text-sm text-muted-foreground">
              Un problème ? <Link href={`/commande/${order.id}/litige`} className="font-medium text-primary-text underline">Ouvrir un litige</Link> (article non reçu après le délai prévu, etc.).
            </p>
          ) : null}

          {openDispute ? (
            <Alert tone="danger" title="Litige en cours">
              Le versement au vendeur est suspendu pendant l&apos;examen. <Link href={`/commande/${order.id}/litige`}>Voir le dossier</Link>
            </Alert>
          ) : null}

          {order.status === "COMPLETED" && (isBuyer || isSeller) && !myReview ? (
            <Card className="p-5">
              <ReviewForm orderId={order.id} subject={counterpart ?? "ce membre"} />
            </Card>
          ) : null}
          {myReview ? <Alert tone="success">Vous avez laissé un avis ({myReview.rating}/5). Merci !</Alert> : null}

          <Card className="flex items-center gap-4 p-4">
            <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted">{order.listing.images[0] ? <img src={imageUrl(order.listing.images[0].id, "thumb")} alt="" className="size-full object-cover" /> : null}</div>
            <div className="min-w-0 flex-1">
              <Link href={listingPath(order.listing.slug, order.listing.publicId)} className="truncate font-semibold hover:underline">
                {order.items[0]?.title}
              </Link>
              <p className="text-sm text-muted-foreground">{t(`delivery.${order.deliveryMethod}`)}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {order.deliveryMethod !== "HAND_DELIVERY" ? (
                <Link href={`/commande/${order.id}/livraison`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <Truck /> Suivi
                </Link>
              ) : null}
              {conversation ? (
                <Link href={`/compte/messages/${conversation.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <MessageCircle /> Messages
                </Link>
              ) : null}
            </div>
          </Card>

          {address && (isBuyer || isSeller || role === "STAFF") ? (
            <Card className="grid gap-1 p-4 text-sm">
              <p className="font-semibold">Adresse de livraison</p>
              <p>{address.fullName}</p>
              <p className="text-muted-foreground">
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}, {address.postalCode} {address.city} ({address.countryCode})
              </p>
              {address.phone && isSeller ? <p className="text-muted-foreground">Tél. {address.phone}</p> : null}
            </Card>
          ) : isSeller && order.deliveryMethod !== "HAND_DELIVERY" ? (
            <p className="text-sm text-muted-foreground">L&apos;adresse de livraison vous sera communiquée après confirmation du paiement.</p>
          ) : null}

          <details className="rounded-xl border border-border bg-card p-4 text-sm">
            <summary className="cursor-pointer font-semibold">Historique de la commande</summary>
            <ol className="mt-3 grid gap-2">
              {order.history.map((h) => (
                <li key={h.id} className="flex flex-wrap justify-between gap-2 border-b border-border pb-2 last:border-0">
                  <span>
                    {t(`orderStatus.${h.toStatus}`)}
                    {h.reason ? <span className="text-muted-foreground"> — {h.reason}</span> : null}
                  </span>
                  <time className="text-xs text-muted-foreground">{format.dateTime(h.createdAt, { dateStyle: "short", timeStyle: "short" })}</time>
                </li>
              ))}
            </ol>
          </details>
        </div>

        <aside className="grid content-start gap-4">
          <Card className="grid gap-2 p-5 text-sm">
            <p className="text-base font-bold">Montants</p>
            <div className="flex justify-between">
              <span>{t("pricing.items")}</span>
              <span className="tabular-nums">{formatMoney(p.itemsSubtotal, p.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("pricing.buyerFee", { rate: `${p.buyerFeeRateBps / 100} %` })}</span>
              <span className="tabular-nums">{formatMoney(p.buyerFee, p.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("pricing.shipping")}</span>
              <span className="tabular-nums">{formatMoney(p.shippingAmount, p.currency)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-bold">
              <span>Total payé par l&apos;acheteur</span>
              <span className="tabular-nums">{formatMoney(p.totalAmount, p.currency)}</span>
            </div>
            {isSeller || role === "STAFF" ? (
              <div className="flex justify-between rounded-lg bg-subtle p-2 font-semibold">
                <span>{t("pricing.sellerReceives")}</span>
                <span className="tabular-nums">{formatMoney(p.sellerNetAmount, p.currency)}</span>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">Calcul figé à la commande (version {p.calculatorVersion}).</p>
          </Card>
          {order.payments.length ? (
            <Card className="grid gap-2 p-5 text-sm">
              <p className="font-bold">Paiements</p>
              {order.payments.map((pay) => (
                <div key={pay.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="tabular-nums">{formatMoney(pay.amount, pay.currency)}</span>
                  <span className="flex items-center gap-1">
                    <Badge tone={pay.status === "SUCCEEDED" ? "success" : pay.status === "FAILED" ? "danger" : "neutral"}>{pay.status === "SUCCEEDED" ? "réussi" : pay.status === "FAILED" ? "refusé" : pay.status === "REQUIRES_ACTION" ? "en attente" : pay.status.toLowerCase()}</Badge>
                    {pay.isSimulated ? <Badge tone="warning">simulé</Badge> : null}
                    {pay.isDuplicate ? <Badge tone="info">doublon remboursé</Badge> : null}
                  </span>
                </div>
              ))}
              {order.refunds.map((r) => (
                <p key={r.id} className="text-muted-foreground">
                  Remboursement {formatMoney(r.amount, r.currency)} — {r.status === "SUCCEEDED" ? "effectué" : r.status === "PENDING" ? "en cours" : "échoué"}
                </p>
              ))}
            </Card>
          ) : null}
          {(isSeller || role === "STAFF") && order.payout ? (
            <Card className={cn("grid gap-1 p-5 text-sm", order.payout.status === "BLOCKED" && "border-warning/40")}>
              <p className="font-bold">Versement vendeur</p>
              <p>
                {formatMoney(order.payout.amount, order.payout.currency)} · {order.payout.status === "PAID" ? "versé" : order.payout.status === "BLOCKED" ? "bloqué" : order.payout.status === "PROCESSING" ? "en cours" : order.payout.status === "PENDING" ? "programmé" : order.payout.status.toLowerCase()}
                {order.payout.isSimulated ? " (simulation)" : ""}
              </p>
              {order.payout.blockedReason ? (
                <p className="text-warning-soft-foreground">
                  {order.payout.blockedReason} <Link href="/compte/paiements" className="underline">Configurer</Link>
                </p>
              ) : null}
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
