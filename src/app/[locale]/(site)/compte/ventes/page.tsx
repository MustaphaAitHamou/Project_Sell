import type { Metadata } from "next";
import { Alert, PageHeader } from "@/components/ui/misc";
import { OrderList } from "@/features/orders/order-list";
import { Link } from "@/i18n/navigation";
import { requireUserPage } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { listSellerOrders } from "@/server/services/orders/queries";

export const metadata: Metadata = { title: "Mes ventes" };

export default async function MySalesPage({ searchParams }: { searchParams: Promise<{ commande?: string }> }) {
  const { commande } = await searchParams;
  const user = await requireUserPage("/compte/ventes");
  const [rows, account] = await Promise.all([listSellerOrders(user), db.payoutAccount.findFirst({ where: { userId: user.id } })]);
  return (
    <>
      <PageHeader title="Mes ventes" description="Remettez ou expédiez les articles vendus ; le versement suit la clôture de la vente." />
      {!account && rows.length > 0 ? (
        <Alert tone="warning" title="Configurez vos versements">
          Sans compte de versement, les montants dus restent bloqués. <Link href="/compte/paiements">Configurer</Link>
        </Alert>
      ) : null}
      <OrderList rows={rows} as="seller" highlight={commande} />
    </>
  );
}
