import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Note sur 5 (arrondie à la demi-étoile pour l'affichage), avec équivalent textuel. */
export function Rating({ sum, count, className, showCount = true, label }: { sum: number; count: number; className?: string; showCount?: boolean; label: string }) {
  if (count === 0) return null;
  const avg = sum / count;
  const rounded = Math.round(avg * 2) / 2;
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm", className)} title={label}>
      <span className="sr-only">{label}</span>
      <span className="flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={cn("size-3.5", i <= rounded ? "fill-accent text-accent" : i - 0.5 === rounded ? "fill-accent/50 text-accent" : "text-border-strong")} />
        ))}
      </span>
      <span className="font-semibold tabular-nums" aria-hidden>
        {avg.toFixed(1).replace(".", ",")}
      </span>
      {showCount ? (
        <span className="text-muted-foreground tabular-nums" aria-hidden>
          ({count})
        </span>
      ) : null}
    </span>
  );
}
