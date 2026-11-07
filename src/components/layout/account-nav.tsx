"use client";
import { Bell, CreditCard, Heart, LayoutDashboard, MapPin, MessageCircle, Package, Settings, ShieldCheck, ShoppingBag, Tag, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/compte", key: "overview", icon: LayoutDashboard, exact: true },
  { href: "/compte/annonces", key: "listings", icon: Tag },
  { href: "/compte/ventes", key: "sales", icon: Package },
  { href: "/compte/commandes", key: "orders", icon: ShoppingBag },
  { href: "/compte/messages", key: "messages", icon: MessageCircle },
  { href: "/compte/favoris", key: "favorites", icon: Heart },
  { href: "/compte/notifications", key: "notifications", icon: Bell },
  { href: "/compte/paiements", key: "payments", icon: CreditCard },
  { href: "/compte/profil", key: "profile", icon: User },
  { href: "/compte/coordonnees", key: "contact", icon: MapPin },
  { href: "/compte/verification", key: "verification", icon: ShieldCheck },
  { href: "/compte/parametres", key: "settings", icon: Settings },
] as const;

export function AccountNav({ unread }: { unread: { messages: number; notifications: number } }) {
  const t = useTranslations("account");
  const pathname = usePathname();
  return (
    <nav aria-label={t("title")}>
      <ul className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:grid md:gap-0.5 md:px-0">
        {ITEMS.map((item) => {
          const active = "exact" in item ? pathname === item.href : pathname.startsWith(item.href);
          const count = item.key === "messages" ? unread.messages : item.key === "notifications" ? unread.notifications : 0;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  active ? "bg-primary-soft text-primary-soft-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="size-4" aria-hidden />
                {t(item.key)}
                {count ? <span className="ms-auto rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-foreground">{count}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
