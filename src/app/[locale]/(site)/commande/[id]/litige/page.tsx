import { FileText, ImageIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter } from "next-intl/server";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/misc";
import { DisputeComposer, OpenDisputeForm, WithdrawDisputeButton } from "@/features/orders/dispute-forms";
import { Link } from "@/i18n/navigation";
import { ORDER_DISPUTABLE_STATES } from "@/lib/domain/order-state";
import { formatMoney } from "@/lib/domain/money";
import { requireUserPage } from "@/server/auth/session";
import { DISPUTE_REASONS, getDisputeForViewer } from "@/server/services/disputes";
import { getOrderForViewer } from "@/server/services/orders/queries";

export const metadata: Metadata = { title: "Litige", robots: { index: false } };

const STATUS: Record<string, string> = { OPEN: "Ouvert", AWAITING_SELLER: "En attente du vendeur", AWAITING_BUYER: "En attente de l'acheteur", UNDER_REVIEW: "En cours d'examen", RESOLVED: "Décision rendue", CLOSED: "Clos" };

export default async function DisputePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const user = await requireUserPage(`/commande/${id}/litige`);
  const result = await getOrderForViewer(user, id).catch(() => null);
  if (!result) notFound();
  const { order, role } = result;
  const format = await getFormatter();
  const current = order.disputes[0];
  const dispute = current ? (await getDisputeForViewer(user, current.id)).dispute : null;
  const canOpen = role === "BUYER" && !dispute?.status.match(/^(OPEN|AWAITING_SELLER|AWAITING_BUYER|UNDER_REVIEW)$/) && (ORDER_DISPUTABLE_STATES as readonly string[]).includes(order.status);
  return (
    <div className="container-page grid max-w-3xl gap-6 py-6 md:py-10">
      <PageHeader title="Litige" description={`Commande ${order.reference}`} actions={<Link href={`/commande/${order.id}`} className="text-sm font-semibold text-primary-text hover:underline">Retour à la commande</Link>} />
      <Alert tone="info" title="Protection acheteur Tamurt Market">
        Cette procédure commerciale s&apos;ajoute à vos droits légaux de consommateur (garantie légale de conformité auprès d&apos;un vendeur professionnel, par exemple) et ne les remplace pas. Les échanges et preuves sont accessibles uniquement aux parties et à l&apos;équipe support.
      </Alert>
      {canOpen && (!dispute || ["RESOLVED", "CLOSED"].includes(dispute.status)) ? (
        <Card className="p-5">
          <OpenDisputeForm orderId={order.id} />
        </Card>
      ) : null}
      {!dispute && !canOpen ? <p className="text-sm text-muted-foreground">Aucun litige ne peut être ouvert à ce stade de la commande.</p> : null}
      {dispute ? (
        <Card className="grid gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{DISPUTE_REASONS.find((r) => r.value === dispute.reason)?.label}</p>
            <Badge tone={dispute.status === "RESOLVED" || dispute.status === "CLOSED" ? "neutral" : "danger"}>{STATUS[dispute.status]}</Badge>
          </div>
          {dispute.resolution ? (
            <Alert tone="success" title="Décision">
              {dispute.resolution === "FULL_REFUND" ? "Remboursement intégral" : dispute.resolution === "PARTIAL_REFUND" ? `Remboursement partiel de ${formatMoney(dispute.refundAmount ?? 0, dispute.order.currency)}` : "Aucun remboursement"}. {dispute.resolutionNote}
            </Alert>
          ) : null}
          {dispute.sellerRespondBy && dispute.status === "AWAITING_SELLER" ? <p className="text-sm text-muted-foreground">Réponse du vendeur attendue avant le {format.dateTime(dispute.sellerRespondBy, { dateStyle: "long", timeStyle: "short" })}.</p> : null}
          <ol className="grid gap-3">
            {dispute.messages.map((m) => (
              <li key={m.id} className={`rounded-lg p-3 text-sm ${m.visibility === "STAFF_ONLY" ? "border border-dashed border-warning bg-warning-soft/40" : m.authorRole === "STAFF" ? "bg-info-soft" : "bg-subtle"}`}>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">
                  {m.authorRole === "BUYER" ? "Acheteur" : m.authorRole === "SELLER" ? "Vendeur" : "Équipe Tamurt Market"}
                  {m.visibility === "STAFF_ONLY" ? " · note interne" : ""} · {format.dateTime(m.createdAt, { dateStyle: "short", timeStyle: "short" })}
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
                    {e.mimeType === "application/pdf" ? <FileText className="size-3.5" aria-hidden /> : <ImageIcon className="size-3.5" aria-hidden />} {e.fileName}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {!["RESOLVED", "CLOSED"].includes(dispute.status) ? (
            <>
              <DisputeComposer disputeId={dispute.id} staff={role === "STAFF"} />
              {role === "BUYER" ? (
                <div className="flex justify-end">
                  <WithdrawDisputeButton disputeId={dispute.id} />
                </div>
              ) : null}
            </>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
