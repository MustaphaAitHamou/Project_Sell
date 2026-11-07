"use client";
import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

/**
 * Modale accessible (Radix : piège du focus, Échap, retour du focus). Sur mobile, elle
 * s'affiche en panneau bas plein largeur ; `side="right"` donne un tiroir latéral.
 */
export function DialogContent({
  className,
  children,
  title,
  description,
  side,
  closeLabel = "Fermer",
}: {
  className?: string;
  children: React.ReactNode;
  title: string;
  description?: string;
  side?: "right" | "left" | "bottom";
  closeLabel?: string;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <D.Content
        className={cn(
          "fixed z-50 grid gap-4 border border-border bg-popover p-5 text-foreground shadow-[var(--shadow-lift)] outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
          side === "right" &&
            "inset-y-0 end-0 h-full w-[min(24rem,92vw)] content-start overflow-y-auto rounded-none border-s pt-[max(1.25rem,env(safe-area-inset-top))] data-[state=open]:slide-in-from-right rtl:data-[state=open]:slide-in-from-left",
          side === "left" &&
            "inset-y-0 start-0 h-full w-[min(22rem,88vw)] content-start overflow-y-auto rounded-none border-e pt-[max(1.25rem,env(safe-area-inset-top))] data-[state=open]:slide-in-from-left rtl:data-[state=open]:slide-in-from-right",
          (!side || side === "bottom") &&
            "inset-x-0 bottom-0 max-h-[90dvh] overflow-y-auto rounded-t-2xl pb-[max(1.25rem,env(safe-area-inset-bottom))] data-[state=open]:slide-in-from-bottom sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:data-[state=open]:zoom-in-95 sm:data-[state=open]:slide-in-from-bottom-0",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="grid gap-1">
            <D.Title className="text-lg font-semibold">{title}</D.Title>
            {description ? <D.Description className="text-sm text-muted-foreground">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          <D.Close className="-m-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label={closeLabel}>
            <X className="size-5" />
          </D.Close>
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}
