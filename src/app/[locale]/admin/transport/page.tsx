import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Alert, Badge, Card, PageHeader, StatCard } from "@/components/ui/misc";
import { AdminTable } from "@/features/admin/table";
import { TRANSPORT_API_VERSION } from "@/integrations/tamurt-transport/contract";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/domain/money";
import { devToolsEnabled } from "@/lib/env";
import { requirePermissionPage } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { getTransportStatus } from "@/server/services/transport";

export const metadata = { title: "Transport" };

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" });
const RES_TONES = { HELD: "warning", CONFIRMED: "success", CANCELLED: "neutral", EXPIRED: "neutral", FAILED: "danger" } as const;

export default async function AdminTransportPage() {
  await requirePermissionPage("transport.read");
  const [status, reservations, events, failedJobs, byStatus, providers] = await Promise.all([
    getTransportStatus(),
    db.transportReservation.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { order: { select: { id: true, reference: true, status: true } } } }),
    db.integrationEvent.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    db.job.findMany({ where: { status: "FAILED" }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, type: true, attempts: true, maxAttempts: true, lastError: true, updatedAt: true } }),
    db.transportReservation.groupBy({ by: ["status"], _count: true }),
    db.shippingProvider.findMany({ orderBy: { code: "asc" } }),
  ]);
  const h = status.health;
  const healthy = status.mode !== "disabled" && !status.circuitOpen && (h?.status ?? "UNKNOWN") !== "DOWN";
  return (
    <>
      <PageHeader title="Tamurt Transport et livraisons" description={`Contrat d'intégration ${TRANSPORT_API_VERSION} (couplage faible : Market reste utilisable si Transport est indisponible).`} />
      {status.simulated ? (
        <Alert tone="warning" title="Simulateur de Tamurt Transport">
          Aucune API partenaire de Tamurt Transport n&apos;existe encore : les devis et réservations proviennent d&apos;un simulateur conforme au contrat proposé. Le corridor France ⇄ Algérie y est marqué « test uniquement ».
          {devToolsEnabled ? (
            <>
              {" "}
              <Link href="/dev/transport">Piloter le simulateur</Link>
            </>
          ) : null}
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Intégration"
          value={
            <span className="flex items-center gap-2">
              {healthy ? <CheckCircle2 className="size-5 text-success" aria-hidden /> : <AlertTriangle className="size-5 text-warning" aria-hidden />}
              {status.mode === "disabled" ? "Désactivée" : status.simulated ? "Simulateur" : "API réelle"}
            </span>
          }
          hint={status.circuitOpen ? "Disjoncteur ouvert : appels suspendus temporairement" : `État : ${h?.status ?? "inconnu"}`}
        />
        <StatCard label="Échecs consécutifs" value={h?.consecutiveFailures ?? 0} hint={h?.lastError ? `Dernière erreur : ${h.lastError.slice(0, 80)}` : "—"} />
        <StatCard label="Dernier succès" value={h?.lastSuccessAt ? dateFmt.format(h.lastSuccessAt) : "—"} hint={h?.lastFailureAt ? `Dernier échec : ${dateFmt.format(h.lastFailureAt)}` : undefined} />
        <StatCard label="Réservations" value={byStatus.reduce((s, b) => s + b._count, 0)} hint={byStatus.map((b) => `${b.status} ${b._count}`).join(" · ") || "Aucune"} />
      </div>

      <section aria-labelledby="reservations" className="grid gap-3">
        <h2 id="reservations" className="text-lg font-bold">
          Réservations Tamurt Transport
        </h2>
        <AdminTable
          head={["Créée", "Commande", "Corridor", "Statut", "Montant", "Réf. Transport", "Expiration du blocage"]}
          empty="Aucune réservation."
          rows={reservations.map((r) => [
            dateFmt.format(r.createdAt),
            r.order ? (
              <Link key="o" href={`/admin/commandes?o=${r.order.id}`} className="font-mono text-primary-text hover:underline">
                {r.order.reference}
              </Link>
            ) : (
              "—"
            ),
            r.corridor,
            <Badge key="s" tone={RES_TONES[r.status]}>
              {r.status}
              {r.isSimulated ? " · sim." : ""}
            </Badge>,
            formatMoney(r.amount, r.currency),
            <code key="e" className="text-xs">
              {r.externalReservationId}
            </code>,
            dateFmt.format(r.holdExpiresAt),
          ])}
        />
      </section>

      <section aria-labelledby="events" className="grid gap-3">
        <h2 id="events" className="flex items-center gap-2 text-lg font-bold">
          <Activity className="size-4" aria-hidden /> Journal des échanges (40 derniers)
        </h2>
        <AdminTable
          head={["Date", "Système", "Sens", "Opération", "Statut", "HTTP", "Durée", "Tentative", "Erreur"]}
          empty="Aucun échange."
          rows={events.map((e) => [
            dateFmt.format(e.createdAt),
            e.system,
            e.direction === "OUTBOUND" ? "sortant" : "entrant",
            <code key="o" className="text-xs">
              {e.operation}
            </code>,
            <Badge key="s" tone={e.status === "PROCESSED" ? "success" : e.status === "FAILED" || e.status === "DEAD" ? "danger" : "neutral"}>
              {e.status}
            </Badge>,
            e.httpStatus ?? "—",
            e.durationMs !== null ? `${e.durationMs} ms` : "—",
            e.attempt,
            <span key="x" className="text-xs text-destructive">
              {e.error?.slice(0, 120) ?? ""}
            </span>,
          ])}
        />
      </section>

      <section aria-labelledby="taches" id="taches" className="grid gap-3">
        <h2 id="taches-title" className="text-lg font-bold">
          Tâches en échec définitif ({failedJobs.length})
        </h2>
        <AdminTable
          head={["Mise à jour", "Type", "Tentatives", "Dernière erreur"]}
          empty="Aucune tâche en échec."
          rows={failedJobs.map((j) => [dateFmt.format(j.updatedAt), <code key="t" className="text-xs">{j.type}</code>, `${j.attempts}/${j.maxAttempts}`, <span key="e" className="text-xs text-destructive">{j.lastError?.slice(0, 160) ?? ""}</span>])}
        />
      </section>

      <section aria-labelledby="carriers" className="grid gap-3">
        <h2 id="carriers" className="text-lg font-bold">
          Transporteurs
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {providers.map((p) => (
            <Card key={p.code} className="grid gap-1 p-4 text-sm">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {p.name}
                <Badge tone={p.isEnabled ? "success" : "neutral"}>{p.isEnabled ? "Activé" : "Non activé"}</Badge>
                {p.isSandbox ? <Badge tone="warning">Simulation</Badge> : null}
              </p>
              <p className="text-muted-foreground">
                {p.supportedCountries.join(", ") || "—"} {p.supportsCrossBorder ? "· international" : "· national"}
              </p>
              {p.notes ? <p className="text-xs text-muted-foreground">{p.notes}</p> : null}
            </Card>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">L&apos;activation d&apos;un transporteur réel nécessite un contrat commercial et des identifiants d&apos;API : elle se fait par configuration après validation.</p>
      </section>
    </>
  );
}
