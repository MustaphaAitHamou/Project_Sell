import { cn } from "@/lib/utils";

/**
 * Marque Tamurt Market (création originale) : étiquette de prix stylisée dans une tuile
 * vert profond, œillet terre cuite et frise géométrique inspirée des motifs amazighs.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9 shrink-0", className)} aria-hidden>
      <rect width="40" height="40" rx="11" fill="var(--primary)" />
      <path d="M11 13.5A2.5 2.5 0 0 1 13.5 11h8.1a2.5 2.5 0 0 1 1.77.73l6.4 6.4a2.5 2.5 0 0 1 0 3.54l-8.1 8.1a2.5 2.5 0 0 1-3.54 0l-6.4-6.4A2.5 2.5 0 0 1 11 21.6Z" fill="var(--primary-foreground)" />
      <circle cx="16.6" cy="16.6" r="2.3" fill="var(--accent)" />
      <path d="m17.5 24.2 2-2 2 2 2-2" fill="none" stroke="var(--primary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[1.05rem] font-extrabold tracking-tight text-foreground">Tamurt</span>{" "}
          <span className="text-[0.68rem] font-semibold tracking-[0.18em] text-primary uppercase">Market</span>
        </span>
      ) : null}
    </span>
  );
}
