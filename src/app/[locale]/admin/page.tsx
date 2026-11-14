import { AlertTriangle, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Alert, Card, CardContent, CardHeader, CardTitle, PageHeader, StatCard } from "@/components/ui/misc";
import { AdminTable } from "@/features/admin/table";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/domain/money";
import { usesSimulators } from "@/lib/env";
import { can, requirePermissionPage } from "@/server/auth/session";
import { getDashboardStats } from "@/server/services/admin-stats";

export const metadata = { title: "Tableau de bord" };

const DELIVERY_LABELS: Record<string, string> = { HAND_DELIVERY: "Remise en main propre", NATIONAL_SHIPPING: "Livraison nationale", TAMURT_TRANSPORT: "Tamurt Transport" };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const staff = await requirePermissionPage("admin.access");
  const { erreur } = await searchParams;
  const stats = await getDashboardStats(30);
  const t = await getTranslations("orderStatus");
  const showFinance = can(staff, "stats.read");

  const currencies = [...new Set([...stats.gmv, ...stats.revenue, ...stats.pspFees, ...stats.refunds].map((x) => x.currency))].sort();
  const pick = (list: { currency: string; amount: number }[], c: string) => list.find((x) => x.currency === c)?.amount ?? 0;

  const queues = [
    { label: "Annonces à valider", value: stats.queues.pendingReview, href: "/admin/moderation", show: can(staff, "listings.moderate") },
    { label: "Signalements ouverts", value: stats.queues.openReports, href: "/admin/moderation#signalements", show: can(staff, "reports.handle") },
    { label: "Litiges en cours", value: stats.openDisputes, href: "/admin/litiges", show: can(staff, "disputes.manage") },
    { label: "Tâches en échec", value: stats.queues.failedJobs, href: "/admin/transport#taches", show: can(staff, "transport.read") },
    { label: "Webhooks en échec", value: stats.queues.failedWebhooks, href: "/admin/paiements#webhooks", show: can(staff, "payments.read") },
  ].filter((q) => q.show);

  return (
    <>
      <PageHeader title="Tableau de bord" description="Activité des 30 derniers jours et files de traitement." />
      {erreur === "permission" ? (
        <Alert tone="danger" title="Accès refusé">
          Votre rôle ne donne pas accès à cette section. Les droits financiers et de configuration sont réservés aux rôles Finance et Administration.
        </Alert>
      ) : null}
      {usesSimulators ? (
        <Alert tone="warning" title="Environnement de simulation">
          Les paiements, versements et expéditions de cet environnement sont simulés : aucun montant affiché ne correspond à de l&apos;argent réel.
        </Alert>
      ) : null}

      <section aria-labelledby="queues" className="grid gap-3">
        <h2 id="queues" className="text-lg font-bold">
          À traiter
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {queues.map((q) => (
            <Link key={q.label} href={q.href} className="group rounded-xl focus-visible:outline-2 focus-visible:outline-ring">
              <StatCard
                label={q.label}
                value={
                  <span className="flex items-center gap-2">
                    {q.value}
                    {q.value > 0 ? <AlertTriangle className="size-4 text-warning" aria-label="Action requise" /> : null}
                  </span>
                }
                hint={
                  <span className="inline-flex items-center gap-1 text-primary-text group-hover:underline">
                    Ouvrir <ArrowRight className="size-3" aria-hidden />
                  </span>
                }
              />
            </Link>
          ))}
        </div>
      </section>

      {showFinance ? (
        <>
          <section aria-labelledby="activity" className="grid gap-3">
            <h2 id="activity" className="text-lg font-bold">
              Activité
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Membres" value={stats.users} hint={`${stats.newUsers} nouveaux sur 30 jours`} />
              <StatCard label="Membres actifs (30 j)" value={stats.activeUsers} hint="Au moins une session" />
              <StatCard label="Annonces en ligne" value={stats.activeListings} hint={`${stats.listings} annonces au total`} />
              <StatCard label="Conversion paiement" value={stats.checkoutConversion === null ? "—" : `${stats.checkoutConversion.toLocaleString("fr-FR")} %`} hint="Paiements réussis / paiements commencés" />
            </div>
          </section>

          <section aria-labelledby="money" className="grid gap-3">
            <h2 id="money" className="text-lg font-bold">
              Volumes et revenus (30 jours, par devise)
            </h2>
            <Alert tone="info">
              Le <strong>volume d&apos;affaires (GMV)</strong> correspond au prix des articles vendus et revient aux vendeurs : ce n&apos;est pas le chiffre d&apos;affaires de Tamurt Market. Le{" "}
              <strong>chiffre d&apos;affaires</strong> correspond aux frais de protection acquis (registre comptable). Le <strong>revenu net estimé</strong> déduit les frais des prestataires de paiement ; ce n&apos;est pas un bénéfice
              (hébergement, personnel, assurance, etc. non inclus). Les devises ne sont jamais additionnées entre elles.
            </Alert>
            <AdminTable
              head={["Devise", "Ventes conclues", "Volume d'affaires (GMV)", "Chiffre d'affaires plateforme", "Frais prestataires", "Revenu net estimé", "Remboursements"]}
              empty="Aucune transaction sur la période."
              rows={currencies.map((c) => {
                const revenue = pick(stats.revenue, c);
                const fees = pick(stats.pspFees, c);
                const refunds = stats.refunds.find((r) => r.currency === c);
                return [
                  <strong key="c">{c}</strong>,
                  stats.gmv.find((g) => g.currency === c)?.count ?? 0,
                  formatMoney(pick(stats.gmv, c), c),
                  formatMoney(revenue, c),
                  formatMoney(fees, c),
                  <span key="n" className={revenue - fees < 0 ? "font-semibold text-destructive" : "font-semibold"}>
                    {formatMoney(revenue - fees, c)}
                  </span>,
                  refunds ? `${formatMoney(refunds.amount, c)} (${refunds.count})` : "—",
                ];
              })}
            />
          </section>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Commandes par statut</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-1.5 text-sm">
                  {Object.entries(stats.ordersByStatus).length === 0 ? <p className="text-muted-foreground">Aucune commande.</p> : null}
                  {Object.entries(stats.ordersByStatus).map(([status, count]) => (
                    <div key={status} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{t(status as "PAID")}</dt>
                      <dd className="font-semibold tabular-nums">{count}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Corridors (commandes payées, 30 j)</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-1.5 text-sm">
                  {stats.byCountry.length === 0 ? <p className="text-muted-foreground">Aucune commande payée.</p> : null}
                  {stats.byCountry.map((b) => (
                    <div key={b.corridor} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{b.corridor}</dt>
                      <dd className="font-semibold tabular-nums">{b.count}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Modes de livraison (30 j)</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-1.5 text-sm">
                  {stats.deliveries.length === 0 ? <p className="text-muted-foreground">Aucune commande payée.</p> : null}
                  {stats.deliveries.map((d) => (
                    <div key={d.method} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{DELIVERY_LABELS[d.method] ?? d.method}</dt>
                      <dd className="font-semibold tabular-nums">{d.count}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Alert tone="info">Les indicateurs financiers sont réservés aux rôles Finance et Administration.</Alert>
      )}
    </>
  );
}
