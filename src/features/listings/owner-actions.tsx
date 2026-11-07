"use client";
import { Archive, CheckCircle2, MoreVertical, PencilLine, RotateCcw, Send, Trash2, Undo2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Link, useRouter } from "@/i18n/navigation";
import { listingStatusAction } from "./actions";

type Op = "publish" | "archive" | "reactivate" | "markSold" | "withdraw" | "delete";

export function ListingOwnerActions({ listingId, status }: { listingId: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (op: Op, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => {
      const res = await listingStatusAction({ listingId, op });
      if (!res.ok) toast.error(res.error);
      else toast.success("Annonce mise à jour.");
      router.refresh();
    });
  };
  const editable = ["DRAFT", "PENDING_REVIEW", "REJECTED", "ACTIVE", "ARCHIVED"].includes(status);
  return (
    <Dropdown>
      <DropdownTrigger className="grid size-9 place-items-center rounded-lg hover:bg-muted" aria-label="Actions sur l'annonce" disabled={pending}>
        <MoreVertical className="size-4" />
      </DropdownTrigger>
      <DropdownContent>
        {editable ? (
          <DropdownItem asChild>
            <Link href={`/vendre/${listingId}/modifier`}>
              <PencilLine /> Modifier
            </Link>
          </DropdownItem>
        ) : null}
        {status === "DRAFT" || status === "REJECTED" ? (
          <DropdownItem onSelect={() => run("publish")}>
            <Send /> Publier
          </DropdownItem>
        ) : null}
        {status === "ARCHIVED" ? (
          <DropdownItem onSelect={() => run("reactivate")}>
            <RotateCcw /> Remettre en ligne
          </DropdownItem>
        ) : null}
        {status === "PENDING_REVIEW" ? (
          <DropdownItem onSelect={() => run("withdraw")}>
            <Undo2 /> Retirer de la vérification
          </DropdownItem>
        ) : null}
        {status === "ACTIVE" ? (
          <>
            <DropdownItem onSelect={() => run("archive")}>
              <Archive /> Désactiver
            </DropdownItem>
            <DropdownItem onSelect={() => run("markSold", "Marquer cet article comme vendu en dehors de Tamurt Market ? Cette vente ne sera pas couverte par la protection acheteur.")}>
              <CheckCircle2 /> Vendu hors plateforme
            </DropdownItem>
          </>
        ) : null}
        {["DRAFT", "PENDING_REVIEW", "REJECTED", "ACTIVE", "ARCHIVED", "SUSPENDED"].includes(status) ? (
          <>
            <DropdownSeparator />
            <DropdownItem className="text-destructive data-[highlighted]:bg-destructive-soft" onSelect={() => run("delete", "Supprimer définitivement cette annonce ?")}>
              <Trash2 /> Supprimer
            </DropdownItem>
          </>
        ) : null}
      </DropdownContent>
    </Dropdown>
  );
}
