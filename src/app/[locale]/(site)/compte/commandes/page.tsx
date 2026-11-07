import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { OrderList } from "@/features/orders/order-list";
import { requireUserPage } from "@/server/auth/session";
import { listBuyerOrders } from "@/server/services/orders/queries";

export const metadata: Metadata = { title: "Mes achats" };

export default async function MyOrdersPage() {
  const user = await requireUserPage("/compte/commandes");
  const rows = await listBuyerOrders(user);
  return (
    <>
      <PageHeader title="Mes achats" description="Suivi, réception, litiges et avis." />
      <OrderList rows={rows} as="buyer" />
    </>
  );
}
