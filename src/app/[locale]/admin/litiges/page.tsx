import { Gavel } from "lucide-react";
import { Select } from "@/components/ui/input";
import { Badge, EmptyState, PageHeader } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { AdminTable } from "@/features/admin/table";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/domain/money";
import { nowMs } from "@/lib/time";
import { requirePermissionPage } from "@/server/auth/session";
import { DISPUTE_REASONS, listDisputesForStaff } from "@/server/services/disputes";

export const metadata = { title: "Litiges" };

const DISPUTE_STATUS: Record<string, string> = { OPEN: "Ouvert", AWAITING_SELLER: "Attente vendeur", AWAITING_BUYER: "Attente acheteur", UNDER_REVIEW: "À examiner", RESOLVED: "Décision rendue", CLOSED: "Clos" };
const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

export default async function AdminDisputesPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  await requirePermissionPage("disputes.manage");
  const { statut } = await searchParams;
  const status = statut && (statut === "ALL" || statut in DISPUTE_STATUS) ? statut : undefined;
  const disputes = await listDisputesForStaff(status);
  const now = nowMs();
  return (
    <>
      <PageHeader title="Litiges" description="Les plus anciens d'abord. Les décisions sont motivées et notifiées aux deux parties." />
      <form className="flex flex-wrap items-end gap-2">
        <Select name="statut" defaultValue={status ?? ""} aria-label="Statut" className="w-52">
          <option value="">En cours</option>
          <option value="ALL">Tous</option>
          {Object.entries(DISPUTE_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline">
          Filtrer
        </Button>
      </form>
      {disputes.length === 0 ? (
        <EmptyState icon={Gavel} title="Aucun litige" />
      ) : (
        <AdminTable
          head={["Commande", "Motif", "Ouvert par", "Statut", "Montant", "Ouvert le", "Échéance vendeur"]}
          rows={disputes.map((d) => [
            <Link key="r" href={`/admin/litiges/${d.id}`} className="font-mono font-medium text-primary-text hover:underline">
              {d.order.reference}
              {d.order.isSimulated ? <span className="block font-sans text-[11px] text-warning">simulation</span> : null}
            </Link>,
            DISPUTE_REASONS.find((r) => r.value === d.reason)?.label ?? d.reason,
            d.openedBy.profile?.displayName ?? "—",
            <Badge key="s" tone={d.status === "UNDER_REVIEW" ? "danger" : d.status === "RESOLVED" || d.status === "CLOSED" ? "neutral" : "warning"}>
              {DISPUTE_STATUS[d.status]}
            </Badge>,
            formatMoney(d.order.totalAmount, d.order.currency),
            dateFmt.format(d.createdAt),
            d.sellerRespondBy ? <span key="e" className={d.status === "AWAITING_SELLER" && d.sellerRespondBy.getTime() < now ? "font-semibold text-destructive" : ""}>{dateFmt.format(d.sellerRespondBy)}</span> : "—",
          ])}
        />
      )}
    </>
  );
}
