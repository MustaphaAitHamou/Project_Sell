"use client";
import { CreditCard, RotateCcw, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { replayPaymentWebhookAction, simulatePaymentAction } from "./actions";

export function SandboxPaymentButtons({ sessionId, orderId, alreadyPaid }: { sessionId: string; orderId: string; alreadyPaid: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [paid, setPaid] = useState(alreadyPaid);
  const run = (outcome: "success" | "failure") =>
    start(async () => {
      const res = await simulatePaymentAction({ sessionId, outcome });
      if (!res.ok) return void toast.error(res.error);
      if (outcome === "success") {
        setPaid(true);
        toast.success("Paiement simulé confirmé par webhook signé.");
        router.push(`/commande/${orderId}?paiement=ok`);
      } else toast.warning("Paiement refusé (simulation). Vous pouvez réessayer.");
    });
  return (
    <div className="grid gap-3">
      <Button size="lg" onClick={() => run("success")} loading={pending} disabled={paid}>
        <CreditCard /> Payer (succès simulé)
      </Button>
      <Button size="lg" variant="destructive-outline" onClick={() => run("failure")} disabled={pending || paid}>
        <XCircle /> Simuler un refus de paiement
      </Button>
      <Button
        variant="ghost"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await replayPaymentWebhookAction({ sessionId });
            if (!res.ok) return void toast.error(res.error);
            toast.info(`Webhook rejoué : ${res.data.body.duplicate ? "reconnu comme doublon, aucun effet" : JSON.stringify(res.data.body)}`);
          })
        }
      >
        <RotateCcw /> Rejouer le dernier webhook (test d&apos;idempotence)
      </Button>
    </div>
  );
}
