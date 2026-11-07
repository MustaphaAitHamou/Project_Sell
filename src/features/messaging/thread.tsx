"use client";
import { AlertTriangle, ImagePlus, Send, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { compressImage } from "@/features/listings/image-upload";
import { sendMessageAction, setBlockAction } from "./actions";

export type ThreadMessage = { id: string; mine: boolean; system: boolean; body: string; createdAt: string; riskFlags: string[]; attachments: { id: string; width: number | null; height: number | null }[] };

function RiskWarning({ flags }: { flags: string[] }) {
  const t = useTranslations("messaging");
  const msgs = [
    flags.includes("off_platform_payment") && t("warningPayment"),
    flags.includes("credential_request") && t("warningCredentials"),
    (flags.includes("external_link") || flags.includes("suspicious_link")) && t("warningLink"),
    (flags.includes("phone_number") || flags.includes("email_address")) && t("warningContact"),
  ].filter(Boolean) as string[];
  if (!msgs.length) return null;
  return (
    <div className="mt-1.5 flex gap-1.5 rounded-md bg-warning-soft px-2 py-1.5 text-[12px] text-warning-soft-foreground" role="note">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{msgs.join(" ")}</span>
    </div>
  );
}

/** Fil de discussion : actualisation périodique (20 s) sans connexion persistante. */
export function Thread({ conversationId, messages, canSend, counterpartId, blockedByMe }: { conversationId: string; messages: ThreadMessage[]; canSend: boolean; counterpartId: string; blockedByMe: boolean }) {
  const t = useTranslations("messaging");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [messages.length]);
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(id);
  }, [router]);

  const send = () =>
    start(async () => {
      const data = new FormData();
      data.set("conversationId", conversationId);
      data.set("body", body);
      if (image) data.set("image", await compressImage(image, 1600, 0.82), "photo.jpg");
      const res = await sendMessageAction(data);
      if (!res.ok) return void toast.error(res.error);
      setBody("");
      setImage(null);
      router.refresh();
    });

  return (
    <div className="grid gap-3">
      <ol className="grid max-h-[60dvh] gap-2 overflow-y-auto rounded-xl border border-border bg-subtle p-3" aria-live="polite">
        {messages.map((m) => (
          <li key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start", m.system && "justify-center")}>
            <div className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-xs", m.system ? "bg-info-soft text-info-soft-foreground" : m.mine ? "rounded-ee-md bg-primary text-primary-foreground" : "rounded-es-md bg-card")}>
              {m.body ? <p className="break-words whitespace-pre-line">{m.body}</p> : null}
              {m.attachments.map((a) => (
                <a key={a.id} href={`/api/files/messages/${a.id}`} target="_blank" rel="noreferrer" className="mt-1 block overflow-hidden rounded-lg">
                  <img src={`/api/files/messages/${a.id}`} alt="Photo jointe" className="max-h-60 w-auto" loading="lazy" />
                </a>
              ))}
              <p className={cn("mt-1 text-[10px]", m.mine ? "text-primary-foreground/75" : "text-muted-foreground")}>{new Date(m.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</p>
              {!m.mine ? <RiskWarning flags={m.riskFlags} /> : null}
            </div>
          </li>
        ))}
        <div ref={end} />
      </ol>
      {canSend ? (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim() || image) send();
          }}
        >
          {image ? (
            <p className="flex items-center gap-2 text-xs">
              📷 {image.name}
              <button type="button" onClick={() => setImage(null)} aria-label="Retirer la photo">
                <X className="size-3.5" />
              </button>
            </p>
          ) : null}
          <div className="flex items-end gap-2">
            <Button type="button" variant="outline" size="icon" onClick={() => file.current?.click()} aria-label="Joindre une photo">
              <ImagePlus />
            </Button>
            <Textarea
              aria-label={t("placeholder")}
              placeholder={t("placeholder")}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              maxLength={2000}
              className="min-h-11"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (body.trim() || image) send();
                }
              }}
            />
            <Button type="submit" size="icon" loading={pending} aria-label={t("send")} disabled={!body.trim() && !image}>
              <Send />
            </Button>
          </div>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-hidden tabIndex={-1} onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
          <p className="text-[11px] text-muted-foreground">{t("warningPayment")}</p>
        </form>
      ) : (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{blockedByMe ? t("blocked") : t("blockedByOther")}</p>
      )}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            start(async () => {
              const res = await setBlockAction({ userId: counterpartId, blocked: !blockedByMe, conversationId });
              if (!res.ok) toast.error(res.error);
              router.refresh();
            })
          }
        >
          {blockedByMe ? t("unblock") : t("block")}
        </Button>
      </div>
    </div>
  );
}
