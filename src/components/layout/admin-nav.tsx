"use client";
import { BarChart3, ClipboardList, Cog, CreditCard, Gavel, LayoutDashboard, Package, ScrollText, ShieldAlert, Truck, Users } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, perm: "admin.access", exact: true },
  { href: "/admin/moderation", label: "Modération", icon: ShieldAlert, perm: ["listings.moderate", "reports.handle"] },
  { href: "/admin/annonces", label: "Annonces", icon: ClipboardList, perm: "listings.read_all" },
  { href: "/admin/utilisateurs", label: "Utilisateurs", icon: Users, perm: "users.read" },
  { href: "/admin/commandes", label: "Commandes", icon: Package, perm: "orders.read" },
  { href: "/admin/litiges", label: "Litiges", icon: Gavel, perm: "disputes.manage" },
  { href: "/admin/paiements", label: "Paiements", icon: CreditCard, perm: "payments.read" },
  { href: "/admin/transport", label: "Transport", icon: Truck, perm: "transport.read" },
  { href: "/admin/statistiques", label: "Statistiques", icon: BarChart3, perm: "stats.read" },
  { href: "/admin/configuration", label: "Configuration", icon: Cog, perm: "settings.read" },
  { href: "/admin/audit", label: "Audit", icon: ScrollText, perm: "audit.read" },
] as const;

export function AdminNav({ permissions, counts }: { permissions: string[]; counts: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Administration">
      <ul className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:grid lg:gap-0.5 lg:px-0">
        {ITEMS.filter((i) => (Array.isArray(i.perm) ? i.perm : [i.perm]).some((p) => permissions.includes(p))).map((item) => {
          const active = "exact" in item ? pathname === item.href : pathname.startsWith(item.href);
          const count = counts[item.href];
          return (
            <li key={item.href} className="shrink-0">
              <Link href={item.href} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap", active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                <item.icon className="size-4" aria-hidden /> {item.label}
                {count ? <span className={cn("ms-auto rounded-full px-1.5 text-[11px] font-bold", active ? "bg-primary-foreground/20" : "bg-accent text-accent-foreground")}>{count}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
