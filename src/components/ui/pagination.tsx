import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Pagination par liens (fonctionne sans JavaScript, indexable). */
export function Pagination({ page, pageCount, hrefFor, label = "Pagination" }: { page: number; pageCount: number; hrefFor: (p: number) => string; label?: string }) {
  if (pageCount <= 1) return null;
  const pages = new Set<number>([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...pages].sort((a, b) => a - b);
  const item = "grid h-10 min-w-10 place-items-center rounded-lg px-3 text-sm font-medium";
  return (
    <nav aria-label={label} className="flex items-center justify-center gap-1">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cn(item, "hover:bg-muted")} aria-label="Page précédente">
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </Link>
      ) : null}
      {sorted.map((p, i) => (
        <span key={p} className="contents">
          {i > 0 && p - sorted[i - 1]! > 1 ? <span className="px-1 text-muted-foreground">…</span> : null}
          <Link href={hrefFor(p)} aria-current={p === page ? "page" : undefined} className={cn(item, p === page ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
            {p}
          </Link>
        </span>
      ))}
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={cn(item, "hover:bg-muted")} aria-label="Page suivante">
          <ChevronRight className="size-4 rtl:rotate-180" />
        </Link>
      ) : null}
    </nav>
  );
}
