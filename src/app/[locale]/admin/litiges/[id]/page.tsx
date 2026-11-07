import { FileText, ImageIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui/misc";
import { ResolveDisputeForm } from "@/features/admin/client";
import { DisputeComposer } from "@/features/orders/dispute-forms";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/domain/money";
import { can, requirePermissionPage } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { getSetting } from "@/server/settings";
import { DISPUTE_REASONS, getDisputeForViewer } from "@/server/services/disputes";

export const metadata = { title: "Litige" };

const STATUS: Record<string, string> = { OPEN: "Ouvert", AWAITING_SELLER: "Attente vendeur", AWAITING_BUYER: "Attente acheteur", UNDER_REVIEW: "À examiner", RESOLVED: "Décision rendue", CLOSED: "Clos" };
const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

export default async function AdminDisputePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const staff = await requirePermissionPage("disputes.manage");
  const result = await getDisputeForViewer(staff, id).catch(() => null);
  if (!result) notFound();
  const { dispute } = result;
  const order = dispute.order;
  const [shipment, transport, sellerStats, buyerStats, caps] = await Promise.all([
    db.shipment.findUnique({ where: { orderId: order.id }, include: { events: { orderBy: { occurredAt: "asc" } } } }),
    db.transportReservation.findMany({ where: { orderId: order.id }, select: { status: true, corridor: true, externalReservationId: true, isSimulated: true } }),
    db.userProfile.findUnique({ where: { userId: order.sellerId }, select: { salesCount: true, sellerCancelledCount: true, disputesLostCount: true, ratingSum: true, ratingCount: true } }),
    db.dispute.count({ where: { openedById: order.buyerId } }),
    getSetting("support.maxRefundMinor"),
  ]);
  const closed = ["RESOLVED", "CLOSED"].includes(dispute.status);
  const cap = (caps as unknown as Record<string, number>)?.[order.currency] ?? 0;
  const canRefundAny = can(staff, "payments.refund");
  return (
    <>
      <PageHeader
        title={`Litige — ${order.reference}`}
        description={`${DISPUTE_REASONS.find((r) => r.value === dispute.reason)?.label ?? dispute.reason} · ouvert le ${dateFmt.format(dispute.createdAt)}`}
        actions={
          <>
            <Badge tone={closed ? "neutral" : "danger"}>{STATUS[dispute.status]}</Badge>
            <Link href={`/admin/commandes?o=${order.id}`} className="text-sm font-semibold text-primary hover:underline">
              Dossier de la commande
            </Link>
          </>
        }
      />
      {order.isSimulated ? <Alert tone="warning">Commande de simulation : tout remboursement est exécuté par le prestataire de test, sans argent réel.</Alert> : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Échanges et preuves</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <ol className="grid gap-3">
                {dispute.messages.map((m) => (
                  <li key={m.id} className={`rounded-lg p-3 text-sm ${m.visibility === "STAFF_ONLY" ? "border border-dashed border-warning bg-warning-soft/40" : m.authorRole === "STAFF" ? "bg-info-soft" : "bg-subtle"}`}>
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">
                      {m.authorRole === "BUYER" ? `Acheteur (${order.buyer.profile?.displayName ?? "—"})` : m.authorRole === "SELLER" ? `Vendeur (${order.seller.profile?.displayName ?? "—"})` : "Équipe Tamurt Market"}
                      {m.visibility === "STAFF_ONLY" ? " · note interne (invisible des parties)" : ""} · {dateFmt.format(m.createdAt)}
                    </p>
                    <p className="whitespace-pre-line">{m.body}</p>
                  </li>
                ))}
              </ol>
              {dispute.evidence.length ? (
                <ul className="flex flex-wrap gap-2">
                  {dispute.evidence.map((e) => (
                    <li key={e.id}>
                      <a href={`/api/files/disputes/${e.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-muted">
                        {e.mimeType === "application/pdf" ? <FileText className="size-3.5" aria-hidden /> : <ImageIcon className="size-3.5" aria-hidden />} {e.fileName} ({e.uploaderId === order.buyerId ? "acheteur" : e.uploaderId === order.sellerId ? "vendeur" : "support"})
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Aucune pièce jointe.</p>
              )}
              {!closed ? <DisputeComposer disputeId={dispute.id} staff /> : null}
            </CardContent>
          </Card>
        </div>
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Contexte</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <p>
                Article : <strong>{order.items[0]?.title}</strong>
              </p>
              <p>
                Total payé : {formatMoney(order.totalAmount, order.currency)} (article {formatMoney(order.itemsSubtotal, order.currency)}, frais {formatMoney(order.buyerFee, order.currency)}, livraison {formatMoney(order.shippingAmount, order.currency)})
              </p>
              <p>Statut avant litige : {dispute.previousOrderStatus}</p>
              {shipment ? (
                <div>
                  <p>
                    Expédition {shipment.providerCode} · {shipment.status} · suivi {shipment.trackingNumber ?? "—"}
                  </p>
                  <ol className="mt-1 grid gap-0.5 text-xs text-muted-foreground">
                    {shipment.events.map((e) => (
                      <li key={e.id}>
                        {dateFmt.format(e.occurredAt)} — {e.status}
                        {e.description ? ` : ${e.description}` : ""}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <p>Pas d&apos;expédition enregistrée{order.deliveryMethod === "HAND_DELIVERY" ? " (remise en main propre)" : ""}.</p>
              )}
              {transport.map((t) => (
                <p key={t.externalReservationId}>
                  Tamurt Transport {t.corridor} · {t.status}
                  {t.isSimulated ? " (simulateur)" : ""}
                </p>
              ))}
              <p className="text-muted-foreground">
                Vendeur : {sellerStats?.salesCount ?? 0} ventes, {sellerStats?.sellerCancelledCount ?? 0} annulation(s), {sellerStats?.disputesLostCount ?? 0} litige(s) perdu(s). Acheteur : {buyerStats} litige(s) ouvert(s) au total.
              </p>
            </CardContent>
          </Card>
          {dispute.resolution ? (
            <Alert tone="success" title="Décision rendue">
              {dispute.resolution === "FULL_REFUND" ? "Remboursement intégral" : dispute.resolution === "PARTIAL_REFUND" ? `Remboursement partiel de ${formatMoney(dispute.refundAmount ?? 0, order.currency)}` : "Aucun remboursement"}. {dispute.resolutionNote}
            </Alert>
          ) : null}
          {!closed && can(staff, "disputes.resolve") ? (
            <Card>
              <CardHeader>
                <CardTitle>Décision</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {!canRefundAny ? <p className="text-xs text-muted-foreground">Plafond de remboursement du support : {formatMoney(cap, order.currency)}. Au-delà, l&apos;équipe finance doit valider.</p> : null}
                {order.status !== "DISPUTED" ? <Alert tone="warning">La commande n&apos;est plus au statut « litige » ({order.status}).</Alert> : null}
                <ResolveDisputeForm disputeId={dispute.id} currency={order.currency} itemsSubtotal={order.itemsSubtotal} totalLabel={formatMoney(order.totalAmount, order.currency)} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
