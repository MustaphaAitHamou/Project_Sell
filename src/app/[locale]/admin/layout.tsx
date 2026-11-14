import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AdminNav } from "@/components/layout/admin-nav";
import { EnvironmentBanner } from "@/components/layout/environment-banner";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Link } from "@/i18n/navigation";
import { adminRequires2fa, usesSimulators } from "@/lib/env";
import { permissionsFor } from "@/lib/domain/permissions";
import { requirePermissionPage } from "@/server/auth/session";
import { db } from "@/server/db/client";

export const metadata = { title: { default: "Administration", template: "%s · Administration Tamurt Market" }, robots: { index: false, follow: false } };

/** Back-office : permission « admin.access » et double authentification (toujours en production). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requirePermissionPage("admin.access");
  const [pending, reports, disputes] = await Promise.all([
    db.listing.count({ where: { status: "PENDING_REVIEW" } }),
    db.report.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
    db.dispute.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
  ]);
  return (
    <div className="min-h-dvh bg-subtle">
      {usesSimulators ? <EnvironmentBanner /> : null}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo compact />
            <span className="font-bold">Administration</span>
          </Link>
          <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
            <ShieldCheck className="size-3.5" aria-hidden /> {staff.roles.join(" · ")} {adminRequires2fa ? "· 2FA" : "· 2FA non exigée (développement)"}
          </span>
          <div className="ms-auto flex items-center gap-3">
            <Link href="/" className="text-sm font-medium text-primary-text hover:underline">
              Retour au site
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <AdminNav permissions={[...permissionsFor(staff.roles)]} counts={{ "/admin/moderation": pending + reports, "/admin/litiges": disputes }} />
        </aside>
        <main id="contenu" className="grid min-w-0 content-start gap-6">
          {children}
        </main>
      </div>
    </div>
  );
}
