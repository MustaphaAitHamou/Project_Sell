import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "PAID", label: "Payée" },
  { key: "SHIPPING", label: "Remise / expédition" },
  { key: "IN_TRANSIT", label: "Acheminement" },
  { key: "DELIVERED", label: "Reçue" },
  { key: "COMPLETED", label: "Terminée" },
] as const;

const RANK: Record<string, number> = { CREATED: -1, PAYMENT_PENDING: -1, PAID: 0, SHIPPING_PENDING: 0, READY_TO_SHIP: 1, IN_TRANSIT: 2, DELIVERED: 3, DISPUTE_WINDOW: 3, DISPUTED: 3, REFUND_PENDING: 3, COMPLETED: 4 };

export function OrderTimeline({ status, handDelivery }: { status: string; handDelivery: boolean }) {
  if (["CANCELLED", "REFUNDED"].includes(status)) return null;
  const rank = RANK[status] ?? -1;
  const steps = handDelivery ? STEPS.filter((s) => s.key !== "IN_TRANSIT") : STEPS;
  return (
    <ol className="grid gap-2 sm:flex sm:items-center sm:gap-0" aria-label="Avancement de la commande">
      {steps.map((s, i) => {
        const r = STEPS.findIndex((x) => x.key === s.key);
        const done = rank >= r;
        return (
          <li key={s.key} className="flex items-center gap-2 sm:flex-1">
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs font-bold", done ? "border-primary bg-primary text-primary-foreground" : "border-border-strong text-muted-foreground")}>
              {done ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
            <span className={cn("text-sm", done ? "font-semibold" : "text-muted-foreground")}>{s.label}</span>
            {i < steps.length - 1 ? <span className={cn("hidden h-0.5 flex-1 sm:mx-2 sm:block", rank > r ? "bg-primary" : "bg-border")} /> : null}
          </li>
        );
      })}
    </ol>
  );
}
