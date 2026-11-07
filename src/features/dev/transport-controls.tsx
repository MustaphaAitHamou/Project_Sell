"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { emitTransportEventAction, setTransportSimulatorAction } from "./actions";

export function SimulatorModeButtons({ mode, corridorLive }: { mode: string; corridorLive: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (input: Parameters<typeof setTransportSimulatorAction>[0]) =>
    start(async () => {
      const res = await setTransportSimulatorAction(input);
      if (!res.ok) toast.error(res.error);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap gap-2">
      {(["normal", "down", "slow"] as const).map((m) => (
        <Button key={m} variant={mode === m ? "primary" : "outline"} size="sm" disabled={pending} onClick={() => run({ mode: m })}>
          {m === "normal" ? "Fonctionnement normal" : m === "down" ? "Simuler une panne (503)" : "Simuler une lenteur (délai dépassé)"}
        </Button>
      ))}
      <Button variant={corridorLive ? "destructive" : "outline"} size="sm" disabled={pending} onClick={() => run({ corridorLive: !corridorLive })}>
        {corridorLive ? "Refermer le corridor (TEST_ONLY)" : "Ouvrir le corridor (tests automatisés uniquement)"}
      </Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run({ resetBreaker: true })}>
        Réarmer le disjoncteur
      </Button>
    </div>
  );
}

const EVENTS = [
  ["transport.shipment.collected", "Colis récupéré"],
  ["transport.shipment.in_transit", "En transit"],
  ["transport.shipment.customs_hold", "Contrôle douanier"],
  ["transport.shipment.out_for_delivery", "En livraison"],
  ["transport.shipment.delivered", "Livré"],
  ["transport.shipment.issue_reported", "Incident"],
  ["transport.reservation.cancelled", "Annulation Transport"],
] as const;

export function TransportEventButtons({ reservationId }: { reservationId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-1.5">
      {EVENTS.map(([type, label]) => (
        <Button
          key={type}
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await emitTransportEventAction({ reservationId, type });
              if (!res.ok) toast.error(res.error);
              else toast.success(`Webhook ${type} : ${String(res.data.body.outcome ?? res.data.status)}`);
              router.refresh();
            })
          }
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
