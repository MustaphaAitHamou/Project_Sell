"use client";
import { Paperclip, Send } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Select, Textarea } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { disputeEvidenceAction, disputeMessageAction, openDisputeAction, withdrawDisputeAction } from "./actions";

const REASONS = [
  ["NOT_RECEIVED", "Article non reçu"],
  ["DAMAGED", "Article endommagé"],
  ["NOT_AS_DESCRIBED", "Article non conforme à la description"],
  ["COUNTERFEIT", "Contrefaçon suspectée"],
  ["MISLEADING", "Description trompeuse"],
  ["LOST", "Colis perdu"],
  ["WRONG_RECIPIENT", "Livré à une autre personne"],
  ["OTHER", "Autre problème"],
] as const;

export function OpenDisputeForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState<(typeof REASONS)[number][0]>("NOT_AS_DESCRIBED");
  const [description, setDescription] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await openDisputeAction({ orderId, reason, description });
          if (!res.ok) return void toast.error(res.fieldErrors?.description?.[0] ?? res.error);
          toast.success("Litige ouvert. Le vendeur est prévenu.");
          router.refresh();
        });
      }}
    >
      <Field label="Motif" htmlFor="d-reason" required>
        <Select id="d-reason" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
          {REASONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Décrivez le problème" htmlFor="d-desc" hint="Soyez précis : ce que vous avez constaté, quand, et ce que vous attendez. Vous pourrez ajouter des photos ensuite." required>
        <Textarea id="d-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={6} maxLength={4000} />
      </Field>
      <Button type="submit" variant="destructive" loading={pending} disabled={description.trim().length < 20}>
        Ouvrir le litige
      </Button>
    </form>
  );
}

export function DisputeComposer({ disputeId, staff }: { disputeId: string; staff: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [staffOnly, setStaffOnly] = useState(false);
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-3">
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await disputeMessageAction({ disputeId, body, staffOnly });
            if (!res.ok) return void toast.error(res.error);
            setBody("");
            router.refresh();
          });
        }}
      >
        <Textarea aria-label="Message" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={4000} placeholder="Votre message au dossier…" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          {staff ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={staffOnly} onChange={(e) => setStaffOnly(e.target.checked)} /> Note interne (invisible des parties)
            </label>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => file.current?.click()} disabled={pending}>
              <Paperclip /> Ajouter une preuve
            </Button>
            <Button type="submit" size="sm" loading={pending} disabled={!body.trim()}>
              <Send /> Envoyer
            </Button>
          </div>
        </div>
      </form>
      <input
        ref={file}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="sr-only"
        aria-label="Ajouter une preuve"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const data = new FormData();
          data.set("disputeId", disputeId);
          data.set("file", f);
          start(async () => {
            const res = await disputeEvidenceAction(data);
            if (!res.ok) return void toast.error(res.error);
            toast.success("Preuve ajoutée au dossier.");
            router.refresh();
          });
        }}
      />
    </div>
  );
}

export function WithdrawDisputeButton({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      onClick={() =>
        window.confirm("Retirer ce litige ? La commande reprendra son cours normal.") &&
        start(async () => {
          const res = await withdrawDisputeAction({ disputeId });
          if (!res.ok) return void toast.error(res.error);
          router.refresh();
        })
      }
    >
      Retirer le litige
    </Button>
  );
}
