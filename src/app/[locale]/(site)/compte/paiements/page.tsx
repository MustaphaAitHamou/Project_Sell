import type { Metadata } from "next";
import { getFormatter } from "next-intl/server";
import { Alert, Badge, Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { EnablePayoutsButton } from "@/features/account/client";
import { Link } from "@/i18n/navigation";
import { getActivePaymentProvider } from "@/integrations/payment-providers/registry";
import { formatMoney } from "@/lib/domain/money";
import { requireUserPage } from "@/server/auth/session";
import { db } from "@/server/db/client";

export const metadata: Metadata = { title: "Paiements et versements" };

const PAYOUT = { PENDING: "Programmé", BLOCKED: "Bloqué", PROCESSING: "En cours", PAID: "Versé", FAILED: "Échec", CANCELLED: "Annulé" } as const;

export default async function PaymentsPage() {
  const user = await requireUserPage("/compte/paiements");
  const provider = getActivePaymentProvider();
  const [account, payouts, format] = await Promise.all([
    db.payoutAccount.findFirst({ where: { userId: user.id } }),
    db.payout.findMany({ where: { sellerId: user.id }, orderBy: { createdAt: "desc" }, take: 50, include: { order: { select: { reference: true, id: true } } } }),
    getFormatter(),
  ]);
  const country = user.profile?.countryCode ?? "FR";
  const supported = provider?.capabilities.payoutCountries.includes(country) ?? false;
  return (
    <>
      <PageHeader title="Paiements et versements" description="Le prix de vos ventes vous est versé après la clôture de chaque vente (période de vérification écoulée, sans litige)." />
      <Card className="grid gap-3 p-5">
        <h2 className="font-bold">Compte de versement</h2>
        {!provider ? (
          <Alert tone="warning">Aucun prestataire de paiement n&apos;est configuré : les versements ne sont pas disponibles.</Alert>
        ) : account ? (
          <p className="text-sm">
            Compte {account.providerAccountId} · {account.countryCode} · {account.currency} · <Badge tone={account.payoutsEnabled ? "success" : "warning"}>{account.payoutsEnabled ? "versements actifs" : "en attente"}</Badge>
            {account.isSimulated ? <Badge tone="warning" className="ms-1">simulation</Badge> : null}
          </p>
        ) : supported ? (
          <>
            <p className="text-sm text-muted-foreground">
              {provider.isSandbox
                ? "Environnement de démonstration : le compte de versement est simulé (aucune donnée bancaire n'est demandée)."
                : "Vous serez redirigé vers notre prestataire de paiement agréé pour vérifier votre identité et renseigner vos coordonnées bancaires."}
            </p>
            <EnablePayoutsButton />
          </>
        ) : (
          <Alert tone="warning" title="Versements indisponibles vers votre pays">
            Les versements vers les vendeurs résidant {country === "DZ" ? "en Algérie" : "dans votre pays"} ne sont pas encore pris en charge : aucun prestataire de paiement agréé n&apos;est contractualisé pour ce flux. Les annonces restent publiables en mode petites annonces.
          </Alert>
        )}
      </Card>
      <section className="grid gap-3">
        <h2 className="text-lg font-bold">Versements</h2>
        {payouts.length === 0 ? (
          <EmptyState title="Aucun versement" description="Les versements apparaîtront après vos premières ventes clôturées." />
        ) : (
          <ul className="grid gap-2">
            {payouts.map((p) => (
              <li key={p.id}>
                <Card className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span>
                    <Link href={`/commande/${p.order.id}`} className="font-semibold hover:underline">
                      {p.order.reference}
                    </Link>{" "}
                    · {format.dateTime(p.createdAt, { dateStyle: "medium" })}
                    {p.blockedReason ? <span className="block text-xs text-warning-soft-foreground">{p.blockedReason}</span> : null}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-bold tabular-nums">{formatMoney(p.amount, p.currency)}</span>
                    <Badge tone={p.status === "PAID" ? "success" : p.status === "BLOCKED" || p.status === "FAILED" ? "warning" : "neutral"}>{PAYOUT[p.status]}</Badge>
                    {p.isSimulated ? <Badge tone="warning">simulé</Badge> : null}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
