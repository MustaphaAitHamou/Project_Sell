"use client";
import { CheckCircle2, CreditCard, PackageCheck, Printer, Star, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { cancelUnpaidOrderAction, confirmHandoverAction, confirmReceiptAction, createLabelAction, retryPaymentAction, reviewAction, sellerCancelAction } from "./actions";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = <T,>(fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>, success?: string, after?: (d: T) => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      if (success) toast.success(success);
      after?.(res.data);
      router.refresh();
    });
  return { pending, run };
}

export function BuyerPaymentActions({ orderId }: { orderId: string }) {
  const { pending, run } = useRun();
  return (
    <div className="flex flex-wrap gap-2">
      <Button loading={pending} onClick={() => run(() => retryPaymentAction({ orderId }), undefined, (d) => (window.location.href = d.redirectUrl))}>
        <CreditCard /> Payer maintenant
      </Button>
      <Button variant="ghost" disabled={pending} onClick={() => window.confirm("Annuler cette commande ? L'article sera remis en vente.") && run(() => cancelUnpaidOrderAction({ orderId }), "Commande annulée.")}>
        <XCircle /> Annuler
      </Button>
    </div>
  );
}

export function HandoverCodeForm({ orderId }: { orderId: string }) {
  const [code, setCode] = useState("");
  const { pending, run } = useRun();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => confirmHandoverAction({ orderId, code }), "Remise confirmée. L'acheteur dispose d'une période de vérification.");
      }}
    >
      <Field label="Code de remise communiqué par l'acheteur" htmlFor="handover" className="w-56">
        <Input id="handover" inputMode="numeric" autoComplete="off" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="6 chiffres" />
      </Field>
      <Button type="submit" loading={pending} disabled={code.length !== 6}>
        <PackageCheck /> Confirmer la remise
      </Button>
    </form>
  );
}

export function CreateLabelButton({ orderId }: { orderId: string }) {
  const { pending, run } = useRun();
  return (
    <Button loading={pending} onClick={() => run(() => createLabelAction({ orderId }), "Étiquette créée (simulation).")}>
      <Printer /> Générer l&apos;étiquette d&apos;expédition
    </Button>
  );
}

export function ConfirmReceiptButton({ orderId, final }: { orderId: string; final: boolean }) {
  const { pending, run } = useRun();
  return (
    <Button
      variant={final ? "primary" : "secondary"}
      loading={pending}
      onClick={() =>
        window.confirm(final ? "Confirmer que l'article est conforme ? La vente sera clôturée et le vendeur payé." : "Confirmer que vous avez reçu l'article ?") &&
        run(() => confirmReceiptAction({ orderId }), final ? "Merci ! La transaction est terminée." : "Réception enregistrée.")
      }
    >
      <CheckCircle2 /> {final ? "Tout est conforme" : "J'ai reçu l'article"}
    </Button>
  );
}

export function SellerCancelForm({ orderId }: { orderId: string }) {
  const [reason, setReason] = useState("");
  const [relist, setRelist] = useState(true);
  const { pending, run } = useRun();
  return (
    <details className="rounded-xl border border-border p-4 text-sm">
      <summary className="cursor-pointer font-semibold text-destructive">Annuler la vente (remboursement intégral de l&apos;acheteur)</summary>
      <form
        className="mt-3 grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => sellerCancelAction({ orderId, reason, relist }), "Vente annulée ; l'acheteur sera remboursé.");
        }}
      >
        <Field label="Motif" htmlFor="cancel-reason" required>
          <Textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} />
        </Field>
        <label className="flex items-center gap-2">
          <Checkbox checked={relist} onChange={(e) => setRelist(e.target.checked)} /> Remettre l&apos;article en vente
        </label>
        <p className="text-xs text-muted-foreground">Les annulations répétées dégradent votre taux de ventes menées à terme.</p>
        <Button type="submit" variant="destructive" loading={pending} disabled={reason.trim().length < 5}>
          Annuler la vente
        </Button>
      </form>
    </details>
  );
}

export function ReviewForm({ orderId, subject }: { orderId: string; subject: string }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const { pending, run } = useRun();
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => reviewAction({ orderId, rating, comment: comment || undefined }), "Merci pour votre avis !");
      }}
    >
      <p className="text-sm font-semibold">Évaluer {subject}</p>
      <div className="flex gap-1" role="radiogroup" aria-label="Note">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} sur 5`} onClick={() => setRating(n)}>
            <Star className={cn("size-7", n <= rating ? "fill-rating text-rating" : "text-border-strong")} />
          </button>
        ))}
      </div>
      <Textarea aria-label="Commentaire" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={1000} placeholder="Votre expérience (facultatif)" />
      <Button type="submit" loading={pending} className="w-fit">
        Publier l&apos;avis
      </Button>
    </form>
  );
}
