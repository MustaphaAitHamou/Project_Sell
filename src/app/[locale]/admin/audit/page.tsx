import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { AdminTable } from "@/features/admin/table";
import type { Prisma } from "@/generated/prisma/client";
import { requirePermissionPage } from "@/server/auth/session";
import { db } from "@/server/db/client";

export const metadata = { title: "Journal d'audit" };

const PAGE = 50;
const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" });

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermissionPage("audit.read");
  const sp = await searchParams;
  const action = (sp.action ?? "").trim().replace(/[^a-z0-9._-]/gi, "").slice(0, 60);
  const target = (sp.cible ?? "").trim().replace(/[^0-9a-zA-Z_-]/g, "").slice(0, 64);
  const page = Math.max(1, Math.min(500, Number.parseInt(sp.page ?? "1", 10) || 1));
  const where: Prisma.AuditLogWhereInput = { ...(action ? { action: { startsWith: action } } : {}), ...(target ? { OR: [{ targetId: target }, { actorId: target }] } : {}) };
  const [logs, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { actor: { select: { email: true, profile: { select: { displayName: true } } } } } }),
    db.auditLog.count({ where }),
  ]);
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (action) u.set("action", action);
    if (target) u.set("cible", target);
    if (p > 1) u.set("page", String(p));
    return `/admin/audit${u.size ? `?${u}` : ""}`;
  };
  return (
    <>
      <PageHeader title="Journal d'audit" description="Journal en ajout seul (modification et suppression interdites en base). Les adresses IP sont stockées sous forme d'empreinte." />
      <form className="flex flex-wrap items-end gap-2" role="search">
        <Input name="action" defaultValue={action} placeholder="Action (ex. moderation., flag., order.)" aria-label="Action" className="w-64" />
        <Input name="cible" defaultValue={target} placeholder="Identifiant de cible ou d'auteur" aria-label="Cible" className="w-72" />
        <Button type="submit" variant="outline">
          <Search /> Filtrer
        </Button>
      </form>
      <AdminTable
        head={["Date", "Auteur", "Rôles", "Action", "Cible", "Détails"]}
        empty="Aucune entrée."
        rows={logs.map((l) => [
          <span key="d" className="text-xs whitespace-nowrap">
            {dateFmt.format(l.createdAt)}
          </span>,
          l.actor ? (l.actor.profile?.displayName ?? l.actor.email) : "Système",
          <span key="r" className="text-xs">
            {l.actorRoles.join(", ") || "—"}
          </span>,
          <code key="a" className="text-xs">
            {l.action}
          </code>,
          <span key="t" className="text-xs">
            {l.targetType}
            {l.targetId ? <span className="block font-mono text-muted-foreground">{l.targetId}</span> : null}
          </span>,
          l.metadata ? (
            <details key="m" className="max-w-sm text-xs">
              <summary className="cursor-pointer text-primary">Voir</summary>
              <pre className="mt-1 overflow-x-auto rounded bg-subtle p-2 whitespace-pre-wrap">{JSON.stringify(l.metadata, null, 2)}</pre>
            </details>
          ) : (
            "—"
          ),
        ])}
      />
      <Pagination page={page} pageCount={Math.ceil(total / PAGE)} hrefFor={qs} />
    </>
  );
}
