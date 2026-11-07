import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui/misc";
import { FunnelChart } from "@/features/admin/funnel-chart";
import { AdminTable } from "@/features/admin/table";
import { requirePermissionPage } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { getFunnels } from "@/server/services/admin-stats";

export const metadata = { title: "Statistiques" };

const EVENT_LABELS: Record<string, string> = {
  "user.signed_up": "Inscriptions",
  "listing.published": "Annonces publiées",
  "listing.viewed": "Consultations d'annonces (membres)",
  "search.performed": "Recherches",
  "search.no_results": "Recherches sans résultat",
  "checkout.started": "Paiements commencés",
  "payment.succeeded": "Paiements réussis",
  "order.completed": "Ventes conclues",
  "dispute.opened": "Litiges ouverts",
  "transport.quote_requested": "Devis Tamurt Transport demandés",
  "message.sent": "Messages envoyés",
};

export default async function AdminStatsPage() {
  await requirePermissionPage("stats.read");
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [funnels, events, noResults] = await Promise.all([
    getFunnels(90),
    db.analyticsEvent.groupBy({ by: ["name"], where: { createdAt: { gte: since } }, _count: true, orderBy: { _count: { name: "desc" } } }),
    db.$queryRaw<{ q: string; count: bigint }[]>`
      SELECT "properties"->>'q' AS q, count(*) AS count FROM "analytics_event"
      WHERE "name" = 'search.no_results' AND "createdAt" >= ${since} AND "properties"->>'q' IS NOT NULL
      GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
  ]);
  return (
    <>
      <PageHeader title="Statistiques" description="Mesure d'audience minimisée : événements internes sans traceur publicitaire ; les visiteurs anonymes ne sont pas suivis individuellement." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardContent className="pt-5">
            <FunnelChart title="Parcours vendeur (inscrits des 90 derniers jours)" steps={funnels.seller} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <FunnelChart title="Parcours acheteur (inscrits des 90 derniers jours)" steps={funnels.buyer} note="Les visiteurs anonymes ne sont pas comptés (pas de traceur sans consentement)." />
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="events" className="grid gap-3">
          <h2 id="events" className="text-lg font-bold">
            Événements (30 jours)
          </h2>
          <AdminTable className="[&_table]:min-w-0" head={["Événement", "Nombre"]} empty="Aucun événement." rows={events.map((e) => [EVENT_LABELS[e.name] ?? <code key="c" className="text-xs">{e.name}</code>, <span key="n" className="tabular-nums">{e._count}</span>])} />
        </section>
        <Card>
          <CardHeader>
            <CardTitle>Recherches sans résultat (30 jours)</CardTitle>
          </CardHeader>
          <CardContent>
            {noResults.length === 0 ? <p className="text-sm text-muted-foreground">Aucune.</p> : null}
            <ol className="grid gap-1 text-sm">
              {noResults.map((r) => (
                <li key={r.q} className="flex justify-between gap-3">
                  <span>« {r.q} »</span>
                  <span className="tabular-nums">{Number(r.count)}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">Utile pour enrichir le catalogue, les synonymes et les variantes orthographiques (kabyle, arabe, français).</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
