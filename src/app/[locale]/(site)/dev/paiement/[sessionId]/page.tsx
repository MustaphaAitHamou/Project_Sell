import { FlaskConical } from "lucide-react";
import { notFound } from "next/navigation";
import { Alert, Card } from "@/components/ui/misc";
import { SandboxPaymentButtons } from "@/features/dev/sandbox-payment";
import { formatMoney } from "@/lib/domain/money";
import { requireUserPage } from "@/server/auth/session";
import { db } from "@/server/db/client";

export const dynamic = "force-dynamic";

/** Page du prestataire de paiement SIMULÉ (remplace la page hébergée d'un vrai prestataire). */
export default async function SandboxPaymentPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const user = await requireUserPage(`/dev/paiement/${sessionId}`);
  const payment = await db.payment.findUnique({ where: { providerSessionId: sessionId }, include: { order: { include: { pricing: true, items: true } } } });
  if (!payment || payment.order.buyerId !== user.id) notFound();
  const o = payment.order;
  return (
    <div className="mx-auto grid max-w-lg gap-5">
      <div className="flex items-center gap-2 text-warning-soft-foreground">
        <FlaskConical className="size-5" aria-hidden />
        <h1 className="text-2xl font-bold">Paiement simulé</h1>
      </div>
      <Alert tone="warning" title="Aucun débit réel">
        Cette page remplace la page sécurisée d&apos;un prestataire de paiement. Aucune donnée de carte n&apos;est demandée ni stockée. Le résultat est transmis à Tamurt Market sous forme de webhook signé.
      </Alert>
      <Card className="grid gap-2 p-5 text-sm">
        <p className="font-semibold">{o.items[0]?.title}</p>
        <p className="text-muted-foreground">Commande {o.reference}</p>
        <div className="mt-2 grid gap-1 border-t border-border pt-3">
          <div className="flex justify-between">
            <span>Article</span>
            <span className="tabular-nums">{formatMoney(o.itemsSubtotal, o.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span>Protection acheteur</span>
            <span className="tabular-nums">{formatMoney(o.buyerFee, o.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span>Livraison</span>
            <span className="tabular-nums">{formatMoney(o.shippingAmount, o.currency)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
            <span>Montant à payer</span>
            <span className="tabular-nums" data-testid="sandbox-amount">
              {formatMoney(payment.amount, payment.currency)}
            </span>
          </div>
        </div>
      </Card>
      {o.status === "PAYMENT_PENDING" || payment.status === "SUCCEEDED" ? (
        <SandboxPaymentButtons sessionId={sessionId} orderId={o.id} alreadyPaid={payment.status === "SUCCEEDED"} />
      ) : (
        <Alert tone="info">Cette commande n&apos;attend plus de paiement (statut : {o.status}).</Alert>
      )}
    </div>
  );
}
