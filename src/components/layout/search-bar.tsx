"use client";
import { Clock, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "tm.recentSearches";

/** Historique local, respectueux de la vie privée : stocké uniquement sur l'appareil. */
function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function rememberSearch(q: string) {
  const term = q.trim();
  if (term.length < 2) return;
  try {
    const next = [term, ...readRecent().filter((x) => x.toLowerCase() !== term.toLowerCase())].slice(0, 6);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // stockage indisponible (navigation privée) : sans conséquence
  }
}

export function SearchBar({ defaultValue = "", className, autoFocus }: { defaultValue?: string; className?: string; autoFocus?: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const listId = useId();
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => setValue(defaultValue), [defaultValue]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const submit = (q: string) => {
    rememberSearch(q);
    setOpen(false);
    router.push(q.trim() ? `/recherche?q=${encodeURIComponent(q.trim())}` : "/explorer");
  };

  return (
    <form
      ref={ref}
      role="search"
      action="/recherche"
      className={cn("relative w-full", className)}
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
    >
      <label htmlFor={`${listId}-input`} className="sr-only">
        {t("nav.searchLabel")}
      </label>
      <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        id={`${listId}-input`}
        name="q"
        type="search"
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="search"
        maxLength={120}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => {
          setRecent(readRecent());
          setOpen(true);
        }}
        placeholder={t("nav.searchPlaceholder")}
        className="h-11 w-full rounded-full border border-input bg-card ps-10 pe-24 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/25"
        aria-controls={open && recent.length ? listId : undefined}
      />
      <button type="submit" className="absolute end-1.5 top-1/2 h-8 -translate-y-1/2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary-hover">
        {t("common.search")}
      </button>
      {open && recent.length > 0 && !value ? (
        <div id={listId} className="absolute inset-x-0 top-[calc(100%+6px)] z-40 rounded-xl border border-border bg-popover p-2 shadow-[var(--shadow-lift)]">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-xs font-semibold text-muted-foreground">{t("search.recent")}</p>
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => {
                try {
                  localStorage.removeItem(STORAGE_KEY);
                } catch {}
                setRecent([]);
              }}
            >
              {t("search.clearRecent")}
            </button>
          </div>
          <ul>
            {recent.map((r) => (
              <li key={r}>
                <button type="button" onClick={() => submit(r)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start text-sm hover:bg-muted">
                  <Clock className="size-4 text-muted-foreground" aria-hidden />
                  <span className="truncate">{r}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="px-2 pt-1 text-[11px] text-muted-foreground">{t("search.recentPrivacy")}</p>
        </div>
      ) : null}
      {value ? (
        <button type="button" aria-label={t("common.reset")} onClick={() => setValue("")} className="absolute end-[5.4rem] top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted">
          <X className="size-3.5" />
        </button>
      ) : null}
    </form>
  );
}
