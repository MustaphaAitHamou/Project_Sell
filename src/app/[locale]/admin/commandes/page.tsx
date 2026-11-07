import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { OrderStatusBadge } from "@/components/ui/status-badge";
import { AdminTable } from "@/features/admin/table";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/domain/money";
import { can, requirePermissionPage } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { db } from "@/server/db/client";

export const metadata = { title: "Commandes" };

const PAGE = 30;
const STATUSES: OrderStatus[] = ["CREATED", "PAYMENT_PENDING", "PAID", "SHIPPING_PENDING", "READY_TO_SHIP", "IN_TRANSIT", "DELIVERED", "DISPUTE_WINDOW", "COMPLETED", "CANCELLED", "REFUND_PENDING", "REFUNDED", "DISPUTED"];
const DELIVERY: Record<string, string> = { HAND_DELIVERY: "Main propre", NATIONAL_SHIPPING: "Nationale", TAMURT_TRANSPORT: "Tamurt Transport" };
const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requirePermissionPage("orders.read");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toUpperCase().slice(0, 40);
  const status = STATUSES.includes(sp.statut as OrderStatus) ? (sp.statut as OrderStatus) : undefined;
  const page = Math.max(1, Math.min(200, Number.parseInt(sp.page ?? "1", 10) || 1));
  const where: Prisma.OrderWhereInput = { ...(status ? { status } : {}), ...(q ? { reference: { contains: q } } : {}) };
  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: { id: true, reference: true, status: true, totalAmount: true, buyerFee: true, currency: true, deliveryMethod: true, originCountry: true, destinationCountry: true, isSimulated: true, createdAt: true, buyer: { select: { profile: { select: { displayName: true } } } }, seller: { select: { profile: { select: { displayName: true } } } }, items: { select: { title: true }, take: 1 } },
    }),
    db.order.count({ where }),
  ]);

  // Détail financier d'une commande (registre) : réservé aux rôles financiers.
  const showLedger = can(staff, "payments.read");
  const selectedId = sp.o && /^[0-9a-f-]{36}$/.test(sp.o) ? sp.o : null;
  const selected = selectedId
    ? await db.order.findUnique({
        where: { id: selectedId },
        include: {
          history: { orderBy: { createdAt: "asc" } },
          payments: { orderBy: { createdAt: "asc" } },
          refunds: { orderBy: { createdAt: "asc" } },
          payout: true,
          pricing: true,
          shipment: true,
          transportReservations: { orderBy: { createdAt: "asc" } },
        },
      })
    : null;
  const ledger = selected && showLedger ? await db.ledgerTransaction.findMany({ where: { orderId: selected.id }, orderBy: { occurredAt: "asc" }, include: { entries: true } }) : [];
  if (selected) await audit({ actorId: staff.id, actorRoles: staff.roles, action: "order.staff_view", targetType: "order", targetId: selected.id });

  const qs = (p: number, extra?: string) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (status) u.set("statut", status);
    if (p > 1) u.set("page", String(p));
    if (extra) u.set("o", extra);
    return `/admin/commandes${u.size ? `?${u}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Commandes" description={`${total} commande(s).`} />
      <form className="flex flex-wrap items-end gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Référence (ex. TM-…)" aria-label="Référence" className="w-60" />
        <Select name="statut" defaultValue={status ?? ""} aria-label="Statut" className="w-52">
          <option value="">Tous les statuts</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline">
          <Search /> Filtrer
        </Button>
      </form>

      {selected ? (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="grid gap-1">
              <CardTitle>
                Commande {selected.reference} {selected.isSimulated ? <Badge tone="warning">Simulation</Badge> : null}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {selected.originCountry} → {selected.destinationCountry} · {DELIVERY[selected.deliveryMethod]} · version {selected.version}
              </p>
            </div>
            <div className="flex gap-3 text-sm">
              <Link href={`/commande/${selected.id}`} className="font-medium text-primary hover:underline">
                Vue commande
              </Link>
              <Link href={qs(page)} className="font-medium text-primary hover:underline">
                Fermer
              </Link>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div className="grid content-start gap-3 text-sm">
              {selected.pricing ? (
                <dl className="grid gap-1 rounded-lg border border-border p-3">
                  <div className="flex justify-between">
                    <dt>Articles</dt>
                    <dd>{formatMoney(selected.pricing.itemsSubtotal, selected.currency)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Frais de protection ({selected.pricing.buyerFeeRateBps / 100} %)</dt>
                    <dd>{formatMoney(selected.pricing.buyerFee, selected.currency)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Livraison {selected.pricing.shippingProvider ? `(${selected.pricing.shippingProvider})` : ""}</dt>
                    <dd>{formatMoney(selected.pricing.shippingAmount, selected.currency)}</dd>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <dt>Total payé</dt>
                    <dd>{formatMoney(selected.pricing.totalAmount, selected.currency)}</dd>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <dt>Net vendeur</dt>
                    <dd>{formatMoney(selected.pricing.sellerNetAmount, selected.currency)}</dd>
                  </div>
                  <p className="text-xs text-muted-foreground">Calcul {selected.pricing.calculatorVersion}, figé le {dateFmt.format(selected.pricing.computedAt)}</p>
                </dl>
              ) : null}
              <div>
                <p className="mb-1 font-semibold">Historique (en ajout seul)</p>
                <ol className="grid gap-1">
                  {selected.history.map((h) => (
                    <li key={h.id} className="text-xs">
                      <span className="text-muted-foreground">{dateFmt.format(h.createdAt)}</span> — {h.fromStatus ?? "∅"} → <strong>{h.toStatus}</strong> ({h.actorType}){h.reason ? ` : ${h.reason}` : ""}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <div className="grid content-start gap-3 text-sm">
              <div>
                <p className="mb-1 font-semibold">Paiements</p>
                {selected.payments.map((p) => (
                  <p key={p.id} className="text-xs">
                    {p.provider} · {p.status} · {formatMoney(p.amount, p.currency)}
                    {p.amountRefunded ? ` · remboursé ${formatMoney(p.amountRefunded, p.currency)}` : ""}
                    {p.isDuplicate ? " · DOUBLON (à rembourser)" : ""}
                    {p.isSimulated ? " · simulé" : ""}
                  </p>
                ))}
                {selected.refunds.map((r) => (
                  <p key={r.id} className="text-xs">
                    Remboursement {r.status} · {formatMoney(r.amount, r.currency)} · {r.reason}
                  </p>
                ))}
                {selected.payout ? (
                  <p className="text-xs">
                    Versement vendeur {selected.payout.status} · {formatMoney(selected.payout.amount, selected.payout.currency)}
                    {selected.payout.blockedReason ? ` · ${selected.payout.blockedReason}` : ""}
                  </p>
                ) : null}
              </div>
              {selected.shipment ? (
                <p className="text-xs">
                  Expédition {selected.shipment.providerCode} · {selected.shipment.status} · suivi {selected.shipment.trackingNumber ?? "—"}
                </p>
              ) : null}
              {selected.transportReservations.map((t) => (
                <p key={t.id} className="text-xs">
                  Tamurt Transport {t.corridor} · {t.status} · {formatMoney(t.amount, t.currency)} · réf. {t.externalReservationId}
                  {t.isSimulated ? " · simulateur" : ""}
                </p>
              ))}
              {showLedger && ledger.length ? (
                <div>
                  <p className="mb-1 font-semibold">Registre comptable (double entrée)</p>
                  {ledger.map((t) => (
                    <div key={t.id} className="mb-2 rounded border border-border p-2 text-xs">
                      <p className="font-medium">
                        {t.kind} — {t.description}
                      </p>
                      {t.entries.map((e) => (
                        <p key={e.id} className="flex justify-between tabular-nums">
                          <span>
                            {e.direction === "DEBIT" ? "Débit" : "Crédit"} {e.account}
                          </span>
                          <span>{formatMoney(e.amount, e.currency)}</span>
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <AdminTable
        head={["Référence", "Article", "Acheteur", "Vendeur", "Statut", "Total", "Livraison", "Créée"]}
        empty="Aucune commande."
        rows={orders.map((o) => [
          <Link key="r" href={qs(page, o.id)} className="font-mono font-medium text-primary hover:underline">
            {o.reference}
            {o.isSimulated ? <span className="block font-sans text-[11px] text-warning">simulation</span> : null}
          </Link>,
          <span key="t" className="line-clamp-2 max-w-48">
            {o.items[0]?.title}
          </span>,
          o.buyer.profile?.displayName ?? "—",
          o.seller.profile?.displayName ?? "—",
          <OrderStatusBadge key="s" status={o.status} />,
          formatMoney(o.totalAmount, o.currency),
          `${DELIVERY[o.deliveryMethod]} (${o.originCountry}→${o.destinationCountry})`,
          dateFmt.format(o.createdAt),
        ])}
      />
      <Pagination page={page} pageCount={Math.ceil(total / PAGE)} hrefFor={(p) => qs(p)} />
    </>
  );
}
