import { Alert, Badge, Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { SimulatorModeButtons, TransportEventButtons } from "@/features/dev/transport-controls";
import { listSimulatorReservations, simulatorState } from "@/integrations/tamurt-transport/simulator";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/domain/money";
import { requireUserPage } from "@/server/auth/session";
import { getTransportStatus } from "@/server/services/transport";

export const dynamic = "force-dynamic";

export default async function DevTransportPage() {
  const user = await requireUserPage("/dev/transport", { onboarded: false });
  const status = await getTransportStatus();
  const state = simulatorState();
  const reservations = env.TRANSPORT_INTEGRATION === "simulator" ? listSimulatorReservations() : [];
  return (
    <div className="grid gap-6">
      <PageHeader title="Simulateur Tamurt Transport" description="Contrat d'API partenaire v1 simulé localement : trajets, voyageurs et prix fictifs." />
      <Alert tone="warning">Outil de développement. Aucune réservation ni expédition réelle. Indisponible en production.</Alert>
      <Card className="grid gap-3 p-5 text-sm">
        <p>
          Intégration : <Badge tone="info">{status.mode}</Badge> · disjoncteur : <Badge tone={status.circuitOpen ? "danger" : "success"}>{status.circuitOpen ? "ouvert" : "fermé"}</Badge> · santé :{" "}
          <Badge tone={status.health?.status === "UP" ? "success" : status.health?.status === "DOWN" ? "danger" : "neutral"}>{status.health?.status ?? "inconnue"}</Badge>
        </p>
        {user.isStaff ? <SimulatorModeButtons mode={state.mode} corridorLive={state.corridorLive} /> : <p className="text-muted-foreground">Réservé au personnel : connectez-vous avec un compte d&apos;administration de démonstration pour piloter le simulateur.</p>}
      </Card>
      <section className="grid gap-3">
        <h2 className="text-lg font-bold">Réservations simulées</h2>
        {reservations.length === 0 ? (
          <EmptyState title="Aucune réservation" description="Les réservations apparaissent lorsqu'une commande éligible réserve un trajet (corridor ouvert en test)." />
        ) : (
          reservations.map((r) => (
            <Card key={r.reservationId} className="grid gap-2 p-4 text-sm">
              <p className="font-semibold">
                {r.reservationId} · <Badge>{r.status}</Badge> · {formatMoney(r.price.amount, r.price.currency)}
              </p>
              <p className="text-muted-foreground">
                Commande Market : {r.partnerOrderId} · expédition : {r.shipment?.shipmentId ?? "—"} ({r.shipment?.status ?? "—"})
              </p>
              {user.isStaff ? <TransportEventButtons reservationId={r.reservationId} /> : null}
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
