"use client";
import { Flag } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/input";
import { reportAction } from "@/features/reports/actions";
import { useRouter } from "@/i18n/navigation";

const REASONS = [
  ["PROHIBITED_ITEM", "Objet interdit ou dangereux"],
  ["COUNTERFEIT", "Contrefaçon"],
  ["SCAM", "Arnaque ou tentative de fraude"],
  ["MISLEADING", "Description trompeuse"],
  ["OFFENSIVE", "Contenu offensant ou haineux"],
  ["SPAM", "Spam ou publicité"],
  ["WRONG_CATEGORY", "Mauvaise catégorie"],
  ["OTHER", "Autre motif"],
] as const;

export function ReportDialog({ targetType, targetId, signedIn, label = "Signaler" }: { targetType: "LISTING" | "USER" | "MESSAGE" | "REVIEW"; targetId: string; signedIn: boolean; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number][0]>("PROHIBITED_ITEM");
  const [details, setDetails] = useState("");
  const [pending, start] = useTransition();
  if (!signedIn)
    return (
      <button type="button" onClick={() => router.push(`/connexion?next=${encodeURIComponent(window.location.pathname)}`)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline">
        <Flag className="size-4" aria-hidden /> {label}
      </button>
    );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline">
        <Flag className="size-4" aria-hidden /> {label}
      </DialogTrigger>
      <DialogContent title={label} description="Votre signalement est examiné par l'équipe de modération. Le membre concerné n'est pas informé de votre identité.">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await reportAction({ targetType, targetId, reason, details: details || undefined });
              if (!res.ok) toast.error(res.error);
              else {
                toast.success("Merci, votre signalement a bien été transmis.");
                setOpen(false);
              }
            });
          }}
        >
          <Field label="Motif" htmlFor="report-reason" required>
            <Select id="report-reason" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
              {REASONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Précisions" htmlFor="report-details" hint="Facultatif — ne transmettez pas de données personnelles inutiles.">
            <Textarea id="report-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} rows={4} />
          </Field>
          <Button type="submit" variant="destructive" loading={pending}>
            Envoyer le signalement
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
