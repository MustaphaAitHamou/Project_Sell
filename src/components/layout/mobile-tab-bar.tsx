"use client";
import { Home, MessageCircle, Plus, Search, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Barre d'onglets mobile : accès en un geste aux usages principaux. */
export function MobileTabBar({ unread, signedIn }: { unread: number; signedIn: boolean }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const tabs = [
    { href: "/", label: t("home"), icon: Home, match: (p: string) => p === "/" },
    { href: "/explorer", label: t("explore"), icon: Search, match: (p: string) => p.startsWith("/explorer") || p.startsWith("/recherche") || p.startsWith("/categorie") },
    { href: "/vendre/nouvelle-annonce", label: t("sell"), icon: Plus, match: (p: string) => p.startsWith("/vendre"), primary: true },
    { href: "/compte/messages", label: t("messages"), icon: MessageCircle, match: (p: string) => p.startsWith("/compte/messages"), badge: unread },
    { href: signedIn ? "/compte" : "/connexion", label: signedIn ? t("account") : t("signIn"), icon: User, match: (p: string) => p === "/compte" || (p.startsWith("/compte/") && !p.startsWith("/compte/messages")) },
  ];
  return (
    <nav aria-label={t("home")} className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn("relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}
              >
                {tab.primary ? (
                  <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-md">
                    <tab.icon className="size-5" aria-hidden />
                  </span>
                ) : (
                  <tab.icon className="size-5" aria-hidden />
                )}
                <span className={tab.primary ? "sr-only" : undefined}>{tab.label}</span>
                {tab.badge ? (
                  <span className="absolute top-2 start-[calc(50%+4px)] min-w-4 rounded-full bg-accent px-1 text-center text-[10px] leading-4 font-bold text-accent-foreground">{tab.badge > 9 ? "9+" : tab.badge}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
