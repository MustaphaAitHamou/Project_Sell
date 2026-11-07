"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("common");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const options = [
    { value: "light", label: t("themeLight"), icon: Sun },
    { value: "dark", label: t("themeDark"), icon: Moon },
    { value: "system", label: t("themeSystem"), icon: Monitor },
  ] as const;
  return (
    <div role="radiogroup" aria-label={t("toggleTheme")} className={cn("inline-flex rounded-full border border-border bg-card p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={mounted && theme === o.value}
          title={o.label}
          onClick={() => setTheme(o.value)}
          className={cn("grid size-8 place-items-center rounded-full text-muted-foreground transition-colors", mounted && theme === o.value && "bg-primary-soft text-primary-soft-foreground")}
        >
          <o.icon className="size-4" aria-hidden />
          <span className="sr-only">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
