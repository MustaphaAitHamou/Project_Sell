import { FlaskConical, MapPin, Truck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter } from "next-intl/server";
import { Alert, Badge, Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { ShippingSimulatorButtons } from "@/features/dev/shipping-controls";
import { Link } from "@/i18n/navigation";
import { devToolsEnabled } from "@/lib/env";
import { formatMoney } from "@/lib/domain/money";
import { requireUserPage } from "@/server/auth/session";
import { getOrderForViewer } from "@/server/services/orders/queries";

export const metadata: Metadata = { title: "Suivi de livraison", robots: { index: false } };

const LABELS: Record<string, string> = {
  PENDING: "En attente de prise en charge",
  LABEL_CREATED: "Étiquette créée",
  HANDED_OVER: "Remis au transporteur",
  IN_TRANSIT: "En cours d'acheminement",
  CUSTOMS_HOLD: "Contrôle douanier",
  OUT_FOR_DELIVERY: "En cours de livraison",
  DELIVERED: "Livré",
  EXCEPTION: "Incident",
  RETURNED: "Retourné",
  CANCELLED: "Annulé",
};

export default async function TrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const user = await requireUserPage(`/commande/${id}/livraison`);
  const result = await getOrderForViewer(user, id).catch(() => null);
  if (!result) notFound();
  const { order } = result;
  const format = await getFormatter();
  const shipment = order.shipment;
  const reservation = order.transportReservations.at(-1);
  return (
    <div className="container-page grid max-w-3xl gap-6 py-6 md:py-10">
      <PageHeader title="Suivi de livraison" description={`Commande ${order.reference}`} actions={<Link href={`/commande/${order.id}`} className="text-sm font-semibold text-primary hover:underline">Retour à la commande</Link>} />
      {reservation ? (
        <Card className="grid gap-1 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <Truck className="size-4" aria-hidden /> Tamurt Transport · corridor {reservation.corridor}
            {reservation.isSimulated ? <Badge tone="warning">simulation</Badge> : null}
          </p>
          <p className="text-muted-foreground">
            Réservation {reservation.externalReservationId} · {reservation.status} · {formatMoney(reservation.amount, reservation.currency)}
          </p>
          <p className="text-xs text-muted-foreground">Tamurt Market conserve sa référence de commande ; Tamurt Transport conserve ses références de réservation et d&apos;expédition.</p>
        </Card>
      ) : null}
      {!shipment ? (
        <EmptyState icon={Truck} title="Pas encore d'expédition" description="Le suivi apparaîtra dès la prise en charge du colis." />
      ) : (
        <Card className="grid gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{LABELS[shipment.status] ?? shipment.status}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {shipment.trackingNumber ? <span>Suivi : {shipment.trackingNumber}</span> : null}
              {shipment.isSimulated ? <Badge tone="warning">transporteur simulé</Badge> : null}
            </div>
          </div>
          <ol className="relative grid gap-4 border-s border-border ps-5">
            {[...shipment.events].reverse().map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -start-[25px] top-1 size-3 rounded-full bg-primary ring-4 ring-card" aria-hidden />
                <p className="text-sm font-medium">{e.description}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {format.dateTime(e.occurredAt, { dateStyle: "medium", timeStyle: "short" })}
                  {e.location ? (
                    <>
                      {" "}
                      · <MapPin className="size-3" aria-hidden /> {e.location}
                    </>
                  ) : null}
                </p>
              </li>
            ))}
          </ol>
          {devToolsEnabled && shipment.isSimulated && shipment.providerCode === "sandbox_national" ? (
            <div className="grid gap-2 rounded-lg border border-dashed border-warning/50 bg-warning-soft/40 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-warning-soft-foreground">
                <FlaskConical className="size-3.5" aria-hidden /> Simulation du transporteur (développement uniquement)
              </p>
              <ShippingSimulatorButtons shipmentId={shipment.id} />
            </div>
          ) : null}
          {devToolsEnabled && shipment.providerCode === "tamurt_transport" ? (
            <Alert tone="info">
              Les événements Tamurt Transport simulés se déclenchent depuis la <Link href="/dev/transport">console du simulateur</Link>.
            </Alert>
          ) : null}
        </Card>
      )}
    </div>
  );
}
