"use client";
import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/misc";
import { useRouter } from "@/i18n/navigation";
import { deleteAddressAction } from "./actions";

export function AddressList({ addresses }: { addresses: { id: string; text: string; isDefault: boolean }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!addresses.length) return <p className="text-sm text-muted-foreground">Aucune adresse enregistrée.</p>;
  return (
    <ul className="grid gap-2">
      {addresses.map((a) => (
        <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
          <span>
            {a.text} {a.isDefault ? <Badge tone="primary">par défaut</Badge> : null}
          </span>
          <button
            type="button"
            aria-label="Supprimer l'adresse"
            disabled={pending}
            className="rounded-md p-1.5 text-destructive hover:bg-destructive-soft"
            onClick={() =>
              start(async () => {
                const res = await deleteAddressAction({ addressId: a.id });
                if (!res.ok) toast.error(res.error);
                router.refresh();
              })
            }
          >
            <Trash2 className="size-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
