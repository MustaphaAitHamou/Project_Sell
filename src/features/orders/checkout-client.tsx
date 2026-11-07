"use client";
import { Lock } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { createOrderAction } from "./actions";

/** Sélecteurs (mode de remise, adresse) : rechargent l'aperçu calculé côté serveur. */
export function CheckoutOption({ href, selected, children }: { href: string; selected: boolean; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => router.replace(href, { scroll: false })}
      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-start text-sm transition-colors ${selected ? "border-primary bg-primary-soft/50" : "border-border hover:bg-muted"}`}
    >
      <span className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-primary" : "border-border-strong"}`}>{selected ? <span className="size-2 rounded-full bg-primary" /> : null}</span>
      <span className="grid flex-1 gap-0.5">{children}</span>
    </button>
  );
}

export function PlaceOrderButton({ input, label }: { input: Parameters<typeof createOrderAction>[0]; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="lg"
      className="w-full"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await createOrderAction(input);
          if (!res.ok) {
            toast.error(res.error);
            router.refresh();
            return;
          }
          // Redirection vers la page du prestataire (simulateur en développement).
          window.location.href = res.data.redirectUrl;
        })
      }
    >
      <Lock /> {label}
    </Button>
  );
}
