import { CheckCircle2, XCircle } from "lucide-react";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui/misc";
import { PayoutRetryButton, ReplayWebhooksButton } from "@/features/admin/client";
import { AdminTable } from "@/features/admin/table";
import { PLANNED_PAYMENT_PROVIDERS } from "@/integrations/payment-providers/types";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/domain/money";
import { env } from "@/lib/env";
import { can, requirePermissionPage } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { LEDGER_ACCOUNTS } from "@/server/services/ledger";

export const metadata = { title: "Paiements" };

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });
const PAYOUT_TONES = { PENDING: "warning", BLOCKED: "danger", PROCESSING: "info", PAID: "success", FAILED: "danger", CANCELLED: "neutral" } as const;

export default async function AdminPaymentsPage() {
  const staff = await requirePermissionPage("payments.read");
  const [payments, refunds, payouts, webhooks, balances, unbalanced, duplicates] = await Promise.all([
    db.payment.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { order: { select: { id: true, reference: true } } } }),
    db.refund.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { order: { select: { id: true, reference: true } } } }),
    db.payout.findMany({ where: { status: { not: "PAID" } }, orderBy: { createdAt: "desc" }, take: 50, include: { order: { select: { id: true, reference: true } }, seller: { select: { profile: { select: { displayName: true } } } } } }),
    db.webhookEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 30, select: { id: true, source: true, eventId: true, eventType: true, status: true, signatureValid: true, attempts: true, lastError: true, receivedAt: true } }),
    // Soldes par compte et devise (débit positif). Tout le registre doit s'équilibrer.
    db.$queryRaw<{ account: string; currency: string; balance: bigint }[]>`
      SELECT "account", "currency", SUM(CASE WHEN "direction" = 'DEBIT' THEN "amount" ELSE -"amount" END) AS balance
      FROM "ledger_entry" GROUP BY "account", "currency" ORDER BY "currency", "account"`,
    db.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM (
        SELECT "transactionId" FROM "ledger_entry" GROUP BY "transactionId"
        HAVING SUM(CASE WHEN "direction" = 'DEBIT' THEN "amount" ELSE -"amount" END) <> 0
      ) t`,
    db.payment.count({ where: { isDuplicate: true } }),
  ]);
  const currencies = [...new Set(balances.map((b) => b.currency))];
  const globalBalanced = currencies.every((c) => balances.filter((b) => b.currency === c).reduce((s, b) => s + Number(b.balance), 0) === 0);
  const unbalancedCount = Number(unbalanced[0]?.count ?? 0);
  const canPayouts = can(staff, "payouts.manage");

  return (
    <>
      <PageHeader title="Paiements" description="Encaissements, remboursements, versements et registre comptable (montants en unités minimales, double entrée)." />

      <section aria-labelledby="providers" className="grid gap-3">
        <h2 id="providers" className="text-lg font-bold">
          Prestataires
        </h2>
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="p-4 text-sm">
            <p className="font-semibold">Prestataire actif : {env.PAYMENT_PROVIDER === "sandbox" ? "bac à sable (simulation)" : "aucun (achat intégré désactivé)"}</p>
            <p className="mt-1 text-muted-foreground">
              {env.PAYMENT_PROVIDER === "sandbox" ? "Aucun argent réel n'est encaissé ni versé. Interdit en production." : "Les annonces restent consultables ; l'achat intégré est indisponible."}
            </p>
          </Card>
          {PLANNED_PAYMENT_PROVIDERS.map((p) => (
            <Card key={p.code} className="p-4 text-sm">
              <p className="flex items-center gap-2 font-semibold">
                {p.label} <Badge tone={p.status === "PLANNED" ? "info" : "neutral"}>{p.status === "PLANNED" ? "Étudié, non intégré" : "Non disponible"}</Badge>
              </p>
              <p className="mt-1 text-muted-foreground">{p.notes}</p>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="ledger" className="grid gap-3">
        <h2 id="ledger" className="text-lg font-bold">
          Registre comptable
        </h2>
        {globalBalanced && unbalancedCount === 0 ? (
          <Alert tone="success" title="Registre équilibré">
            Chaque transaction est équilibrée (débits = crédits) et le registre est en ajout seul (corrections par écritures inverses).
          </Alert>
        ) : (
          <Alert tone="danger" title="Déséquilibre détecté">
            {unbalancedCount} transaction(s) déséquilibrée(s). Gelez les versements et prévenez l&apos;équipe technique.
          </Alert>
        )}
        <AdminTable
          head={["Devise", "Compte", "Solde (débit +)"]}
          empty="Registre vide."
          rows={balances.map((b) => [
            b.currency,
            <code key="a" className="text-xs">
              {b.account}
              {(LEDGER_ACCOUNTS as readonly string[]).includes(b.account) ? "" : " (inconnu)"}
            </code>,
            <span key="v" className="tabular-nums">
              {formatMoney(Number(b.balance), b.currency)}
            </span>,
          ])}
        />
        {duplicates > 0 ? <Alert tone="warning">{duplicates} paiement(s) en double détecté(s) : enregistrés en « encaissements non affectés » et remboursés automatiquement.</Alert> : null}
      </section>

      <section aria-labelledby="payouts" className="grid gap-3">
        <h2 id="payouts" className="text-lg font-bold">
          Versements vendeurs non effectués ({payouts.length})
        </h2>
        <AdminTable
          head={["Commande", "Vendeur", "Montant", "Statut", "Motif", "Créé", canPayouts ? "Action" : ""]}
          empty="Aucun versement en attente."
          rows={payouts.map((p) => [
            <Link key="o" href={`/admin/commandes?o=${p.order.id}`} className="font-mono text-primary-text hover:underline">
              {p.order.reference}
            </Link>,
            p.seller.profile?.displayName ?? "—",
            formatMoney(p.amount, p.currency),
            <Badge key="s" tone={PAYOUT_TONES[p.status]}>
              {p.status}
              {p.isSimulated ? " · simulé" : ""}
            </Badge>,
            <span key="r" className="text-xs">
              {p.blockedReason ?? p.failureMessage ?? "—"}
            </span>,
            dateFmt.format(p.createdAt),
            canPayouts && ["BLOCKED", "FAILED", "PENDING"].includes(p.status) ? <PayoutRetryButton key="b" payoutId={p.id} /> : null,
          ])}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Derniers paiements</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1.5 text-sm">
            {payments.length === 0 ? <p className="text-muted-foreground">Aucun paiement.</p> : null}
            {payments.map((p) => (
              <p key={p.id} className="flex flex-wrap justify-between gap-2">
                <Link href={`/admin/commandes?o=${p.order.id}`} className="font-mono text-primary-text hover:underline">
                  {p.order.reference}
                </Link>
                <span>
                  {p.status} · {formatMoney(p.amount, p.currency)}
                  {p.isDuplicate ? " · doublon" : ""}
                  {p.isSimulated ? " · simulé" : ""}
                </span>
              </p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Derniers remboursements</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-1.5 text-sm">
            {refunds.length === 0 ? <p className="text-muted-foreground">Aucun remboursement.</p> : null}
            {refunds.map((r) => (
              <p key={r.id} className="flex flex-wrap justify-between gap-2">
                <Link href={`/admin/commandes?o=${r.order.id}`} className="font-mono text-primary-text hover:underline">
                  {r.order.reference}
                </Link>
                <span>
                  {r.status} · {formatMoney(r.amount, r.currency)}
                </span>
              </p>
            ))}
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="webhooks" id="webhooks" className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="webhooks-title" className="text-lg font-bold">
            Webhooks reçus
          </h2>
          <ReplayWebhooksButton />
        </div>
        <AdminTable
          head={["Reçu", "Source", "Type", "Identifiant", "Signature", "Statut", "Tentatives", "Erreur"]}
          empty="Aucun webhook reçu."
          rows={webhooks.map((w) => [
            dateFmt.format(w.receivedAt),
            w.source,
            <code key="t" className="text-xs">
              {w.eventType}
            </code>,
            <code key="i" className="text-xs break-all">
              {w.eventId}
            </code>,
            w.signatureValid ? <CheckCircle2 key="v" className="size-4 text-success" aria-label="Signature valide" /> : <XCircle key="v" className="size-4 text-destructive" aria-label="Signature invalide" />,
            <Badge key="s" tone={w.status === "PROCESSED" ? "success" : w.status === "FAILED" ? "danger" : "neutral"}>
              {w.status}
            </Badge>,
            w.attempts,
            <span key="e" className="text-xs text-destructive">
              {w.lastError ?? ""}
            </span>,
          ])}
        />
      </section>
    </>
  );
}
