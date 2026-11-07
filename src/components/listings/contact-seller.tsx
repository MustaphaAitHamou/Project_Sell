"use client";
import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { startConversationAction } from "@/features/messaging/actions";
import { useRouter } from "@/i18n/navigation";

const SUGGESTIONS = ["Bonjour, l'article est-il toujours disponible ?", "Bonjour, pouvez-vous m'envoyer une photo supplémentaire ?", "Bonjour, où peut-on se retrouver pour une remise en main propre ?"];

export function ContactSellerButton({ listingId, signedIn, variant = "outline", className }: { listingId: string; signedIn: boolean; variant?: "outline" | "primary"; className?: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  if (!signedIn)
    return (
      <Button variant={variant} size="lg" className={className} onClick={() => router.push(`/connexion?next=${encodeURIComponent(window.location.pathname)}`)}>
        <MessageCircle /> {t("listing.contactSeller")}
      </Button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="lg" className={className}>
          <MessageCircle /> {t("listing.contactSeller")}
        </Button>
      </DialogTrigger>
      <DialogContent title={t("listing.contactSeller")} description="Vos coordonnées ne sont jamais communiquées au vendeur.">
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await startConversationAction({ listingId, body });
              if (!res.ok) {
                toast.error(res.fieldErrors?.body?.[0] ?? res.error);
                return;
              }
              setOpen(false);
              router.push(`/compte/messages/${res.data.conversationId}`);
            });
          }}
        >
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => setBody(s)} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted">
                {s}
              </button>
            ))}
          </div>
          <label htmlFor="contact-body" className="sr-only">
            Message
          </label>
          <Textarea id="contact-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} required placeholder={t("messaging.placeholder")} rows={5} />
          <p className="text-xs text-muted-foreground">{t("messaging.warningPayment")}</p>
          <Button type="submit" loading={pending} disabled={!body.trim()}>
            {t("messaging.send")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
