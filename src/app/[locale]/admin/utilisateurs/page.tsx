import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { UserRoleControl, UserStatusControl } from "@/features/admin/client";
import { AdminTable } from "@/features/admin/table";
import { Link } from "@/i18n/navigation";
import { assignableRoles } from "@/lib/domain/permissions";
import { can, requirePermissionPage } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { db } from "@/server/db/client";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Utilisateurs" };

const PAGE = 30;
const STATUS_TONES = { ACTIVE: "success", SUSPENDED: "warning", BANNED: "danger", DELETED: "neutral" } as const;
const STATUS_LABELS: Record<string, string> = { ACTIVE: "Actif", SUSPENDED: "Suspendu", BANNED: "Exclu", DELETED: "Supprimé" };
const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" });
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const staff = await requirePermissionPage("users.read");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const status = ["ACTIVE", "SUSPENDED", "BANNED", "DELETED"].includes(sp.statut ?? "") ? (sp.statut as "ACTIVE") : undefined;
  const staffOnly = sp.personnel === "1";
  const page = Math.max(1, Math.min(200, Number.parseInt(sp.page ?? "1", 10) || 1));

  const where: Prisma.UserWhereInput = {
    ...(status ? { status } : {}),
    ...(staffOnly ? { roles: { some: {} } } : {}),
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { profile: { handle: { contains: q.toLowerCase().replace(/^@/, "") } } },
            { profile: { displayName: { contains: q, mode: "insensitive" } } },
            ...(/^[0-9a-f-]{36}$/.test(q) ? [{ id: q }] : []),
          ],
        }
      : {}),
  };
  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: { id: true, email: true, status: true, createdAt: true, emailVerified: true, twoFactorEnabled: true, roles: { select: { role: true } }, profile: { select: { displayName: true, handle: true, sellerType: true, countryCode: true, salesCount: true } }, _count: { select: { listings: true, ordersAsBuyer: true } } },
    }),
    db.user.count({ where }),
  ]);

  const selectedId = sp.u && /^[0-9a-f-]{36}$/.test(sp.u) ? sp.u : null;
  const selected = selectedId
    ? await db.user.findUnique({
        where: { id: selectedId },
        include: {
          roles: true,
          profile: true,
          business: { select: { legalName: true, verificationStatus: true } },
          verifications: { select: { type: true, status: true, verifiedAt: true } },
          _count: { select: { listings: true, ordersAsBuyer: true, ordersAsSeller: true, reportsMade: true, disputesOpened: true } },
        },
      })
    : null;
  const [moderationHistory, reportsAgainst] = selected
    ? await Promise.all([
        db.moderationAction.findMany({ where: { targetType: "user", targetId: selected.id }, orderBy: { createdAt: "desc" }, take: 20 }),
        db.report.count({ where: { targetType: "USER", targetId: selected.id } }),
      ])
    : [[], 0];
  if (selected) await audit({ actorId: staff.id, actorRoles: staff.roles, action: "user.staff_view", targetType: "user", targetId: selected.id });

  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (status) u.set("statut", status);
    if (staffOnly) u.set("personnel", "1");
    if (p > 1) u.set("page", String(p));
    return `/admin/utilisateurs${u.size ? `?${u}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Utilisateurs" description={`${total} compte(s). Les coordonnées privées (téléphone, adresses) ne sont pas affichées ici.`} />
      <form className="flex flex-wrap items-end gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="E-mail, nom, @pseudo ou identifiant" aria-label="Rechercher un membre" className="w-72" />
        <Select name="statut" defaultValue={status ?? ""} aria-label="Statut" className="w-40">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="personnel" value="1" defaultChecked={staffOnly} className="accent-primary" /> Personnel uniquement
        </label>
        <Button type="submit" variant="outline">
          <Search /> Filtrer
        </Button>
      </form>

      {selected ? (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div className="grid gap-1">
              <CardTitle>
                {selected.profile?.displayName ?? selected.name} {selected.profile ? <span className="text-sm font-normal text-muted-foreground">@{selected.profile.handle}</span> : null}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {selected.email} · inscrit le {dateFmt.format(selected.createdAt)} · {selected.emailVerified ? "e-mail vérifié" : "e-mail non vérifié"} · 2FA {selected.twoFactorEnabled ? "active" : "inactive"}
              </p>
            </div>
            <Link href={qs(page)} className="text-sm font-medium text-primary hover:underline">
              Fermer
            </Link>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-3">
            <div className="grid content-start gap-2 text-sm">
              <p>
                Statut : <Badge tone={STATUS_TONES[selected.status]}>{STATUS_LABELS[selected.status]}</Badge>
              </p>
              {selected.statusReason ? <p className="text-muted-foreground">Motif : {selected.statusReason}</p> : null}
              <p>
                Rôles : {selected.roles.length ? selected.roles.map((r) => r.role).join(", ") : "aucun (membre)"}
              </p>
              <p>
                Type : {selected.profile?.sellerType === "BUSINESS" ? `professionnel${selected.business ? ` — ${selected.business.legalName}` : ""}` : "particulier"}
              </p>
              <p>
                Vérifications : {selected.verifications.length ? selected.verifications.map((v) => `${v.type} (${v.status})`).join(", ") : "aucune"}
              </p>
              <p>
                {selected._count.listings} annonce(s) · {selected._count.ordersAsBuyer} achat(s) · {selected._count.ordersAsSeller} vente(s) · {selected.profile?.disputesLostCount ?? 0} litige(s) perdu(s) · {reportsAgainst} signalement(s) reçu(s)
              </p>
              {selected.profile ? (
                <Link href={`/vendeur/${selected.profile.handle}`} className="font-medium text-primary hover:underline">
                  Profil public
                </Link>
              ) : null}
            </div>
            <div className="grid content-start gap-4">
              {can(staff, "users.suspend") && selected.status !== "DELETED" && selected.id !== staff.id ? <UserStatusControl userId={selected.id} status={selected.status} canBan={can(staff, "users.ban")} /> : null}
              {can(staff, "users.roles.assign") ? <UserRoleControl userId={selected.id} roles={selected.roles.map((r) => r.role)} assignable={assignableRoles(staff.roles)} /> : null}
            </div>
            <div className="grid content-start gap-2">
              <p className="text-sm font-semibold">Historique de modération</p>
              {moderationHistory.length === 0 ? <p className="text-sm text-muted-foreground">Aucune décision.</p> : null}
              <ol className="grid gap-2 text-sm">
                {moderationHistory.map((m) => (
                  <li key={m.id} className="rounded-lg border border-border p-2">
                    <p className="font-medium">{m.action}</p>
                    <p className="text-muted-foreground">{m.reason}</p>
                    <p className="text-xs text-muted-foreground">{dateTimeFmt.format(m.createdAt)}</p>
                  </li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {selected && selected.roles.some((r) => r.role === "SUPER_ADMIN") && !staff.roles.includes("SUPER_ADMIN") ? <Alert tone="warning">Compte super-administrateur : seules les actions d&apos;un super-administrateur sont possibles.</Alert> : null}

      <AdminTable
        head={["Membre", "E-mail", "Statut", "Rôles", "Pays", "Annonces", "Achats", "Inscription"]}
        empty="Aucun membre ne correspond."
        rows={users.map((u) => [
          <Link key="n" href={`${qs(page)}${qs(page).includes("?") ? "&" : "?"}u=${u.id}`} className="font-medium text-primary hover:underline">
            {u.profile?.displayName ?? "(profil incomplet)"}
            {u.profile ? <span className="block text-xs font-normal text-muted-foreground">@{u.profile.handle}</span> : null}
          </Link>,
          <span key="e" className="text-xs">
            {u.email}
            {!u.emailVerified ? <span className="block text-warning">non vérifié</span> : null}
          </span>,
          <Badge key="s" tone={STATUS_TONES[u.status]}>
            {STATUS_LABELS[u.status]}
          </Badge>,
          u.roles.map((r) => r.role).join(", ") || "—",
          u.profile?.countryCode ?? "—",
          u._count.listings,
          u._count.ordersAsBuyer,
          dateFmt.format(u.createdAt),
        ])}
      />
      <Pagination page={page} pageCount={Math.ceil(total / PAGE)} hrefFor={qs} />
    </>
  );
}
