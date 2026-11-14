import { ImageOff, Package } from "lucide-react";
import { getFormatter } from "next-intl/server";
import { Badge, Card, EmptyState } from "@/components/ui/misc";
import { OrderStatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/domain/money";
import { imageUrl } from "@/lib/utils";

type Row = {
  id: string;
  reference: string;
  status: string;
  totalAmount: number;
  sellerNetAmount: number;
  currency: string;
  deliveryMethod: string;
  createdAt: Date;
  isSimulated: boolean;
  items: { title: string; imageKey: string | null }[];
  buyer: { profile: { displayName: string } | null };
  seller: { profile: { displayName: string } | null };
};

export async function OrderList({ rows, as, highlight }: { rows: Row[]; as: "buyer" | "seller"; highlight?: string }) {
  const format = await getFormatter();
  if (rows.length === 0)
    return <EmptyState icon={Package} title={as === "buyer" ? "Aucun achat pour le moment" : "Aucune vente pour le moment"} description={as === "buyer" ? "Vos achats protégés apparaîtront ici." : "Vos ventes apparaîtront ici dès qu'un acheteur aura payé."} />;
  return (
    <ul className="grid gap-3">
      {rows.map((o) => (
        <li key={o.id}>
          <Link href={`/commande/${o.id}`} className="block">
            <Card className={`flex items-center gap-3 p-3 transition-shadow hover:shadow-[var(--shadow-lift)] ${highlight === o.id ? "ring-2 ring-primary-text" : ""}`}>
              <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">{o.items[0]?.imageKey ? <img src={imageUrl(o.items[0].imageKey, "thumb")} alt="" className="size-full object-cover" loading="lazy" /> : <ImageOff className="m-auto mt-4 size-5 text-muted-foreground" aria-hidden />}</div>
              <div className="grid min-w-0 flex-1 gap-0.5">
                <p className="truncate font-semibold">{o.items[0]?.title}</p>
                <p className="text-xs text-muted-foreground">
                  {o.reference} · {format.dateTime(o.createdAt, { dateStyle: "medium" })} · {as === "buyer" ? `vendeur : ${o.seller.profile?.displayName ?? "—"}` : `acheteur : ${o.buyer.profile?.displayName ?? "—"}`}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <OrderStatusBadge status={o.status} />
                  {o.isSimulated ? <Badge tone="warning">simulation</Badge> : null}
                </div>
              </div>
              <p className="shrink-0 text-end font-bold tabular-nums">
                {formatMoney(as === "buyer" ? o.totalAmount : o.sellerNetAmount, o.currency)}
                <span className="block text-[11px] font-normal text-muted-foreground">{as === "buyer" ? "payé" : "pour vous"}</span>
              </p>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
