"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { emitShippingEventAction } from "./actions";

const EVENTS = [
  ["HANDED_OVER", "Dépôt du colis"],
  ["IN_TRANSIT", "En transit"],
  ["OUT_FOR_DELIVERY", "En livraison"],
  ["DELIVERED", "Livré"],
  ["EXCEPTION", "Incident"],
] as const;

/** Simulation des événements du transporteur national (webhooks signés), développement uniquement. */
export function ShippingSimulatorButtons({ shipmentId }: { shipmentId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-1.5">
      {EVENTS.map(([status, label]) => (
        <Button
          key={status}
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await emitShippingEventAction({ shipmentId, status });
              if (!res.ok) toast.error(res.error);
              else toast.success(`Événement transporteur : ${label}`);
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
