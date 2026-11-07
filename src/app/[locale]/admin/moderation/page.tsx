import { Flag, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { ListingModeration, ReportControls } from "@/features/admin/client";
import { Link } from "@/i18n/navigation";
import { listingPath } from "@/lib/domain/ids";
import { formatMoney } from "@/lib/domain/money";
import { imageUrl } from "@/lib/utils";
import { can, requirePermissionPage } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { db } from "@/server/db/client";
import { detectSensitiveKeywords } from "@/server/services/listings";

export const metadata = { title: "Modération" };

const REASONS: Record<string, string> = {
  PROHIBITED_ITEM: "Article interdit",
  COUNTERFEIT: "Contrefaçon",
  SCAM: "Arnaque / fraude",
  MISLEADING: "Trompeur",
  OFFENSIVE: "Contenu choquant",
  SPAM: "Spam",
  WRONG_CATEGORY: "Mauvaise catégorie",
  OTHER: "Autre",
};
const TARGETS: Record<string, string> = { LISTING: "Annonce", USER: "Membre", MESSAGE: "Message", REVIEW: "Avis" };

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

export default async function ModerationPage() {
  const staff = await requirePermissionPage("admin.access");
  const canListings = can(staff, "listings.moderate");
  const canReports = can(staff, "reports.handle");
  const canReadMessages = can(staff, "messages.read_for_moderation");
  if (!canListings && !canReports) notFound();

  const [pending, reports] = await Promise.all([
    canListings
      ? db.listing.findMany({
          where: { status: "PENDING_REVIEW" },
          orderBy: { updatedAt: "asc" },
          take: 50,
          include: {
            images: { orderBy: { sortOrder: "asc" }, take: 4, select: { id: true } },
            category: { select: { name: true, requiresReview: true } },
            seller: { select: { createdAt: true, profile: { select: { displayName: true, handle: true, salesCount: true, sellerType: true } }, _count: { select: { reportsMade: true } } } },
          },
        })
      : [],
    canReports
      ? db.report.findMany({ where: { status: { in: ["OPEN", "IN_REVIEW"] } }, orderBy: { createdAt: "asc" }, take: 100, include: { reporter: { select: { profile: { select: { displayName: true } } } } } })
      : [],
  ]);

  // Aperçu de chaque cible signalée (chargé par type, sans exposer de coordonnées).
  const ids = (type: string) => reports.filter((r) => r.targetType === type).map((r) => r.targetId);
  const [listings, messages, reviews, users] = await Promise.all([
    db.listing.findMany({ where: { id: { in: ids("LISTING") } }, select: { id: true, title: true, status: true, slug: true, publicId: true, priceAmount: true, currency: true } }),
    db.message.findMany({ where: { id: { in: canReadMessages ? ids("MESSAGE") : [] } }, select: { id: true, body: true, isHidden: true, riskFlags: true, senderId: true } }),
    db.review.findMany({ where: { id: { in: ids("REVIEW") } }, select: { id: true, rating: true, comment: true, status: true } }),
    db.user.findMany({ where: { id: { in: ids("USER") } }, select: { id: true, status: true, profile: { select: { displayName: true, handle: true } } } }),
  ]);
  // Lecture d'un message privé signalé : réservée à la modération et journalisée.
  if (messages.length) await audit({ actorId: staff.id, actorRoles: staff.roles, action: "message.staff_view", targetType: "message", metadata: { messageIds: messages.map((m) => m.id), context: "report" } });
  const byId = new Map<string, unknown>([...listings, ...messages, ...reviews, ...users].map((x) => [x.id, x]));
  const reportCounts = new Map<string, number>();
  for (const r of reports) reportCounts.set(r.targetId, (reportCounts.get(r.targetId) ?? 0) + 1);

  return (
    <>
      <PageHeader title="Modération" description="Décisions humaines, motivées et notifiées. Les membres peuvent demander un réexamen ; aucune exclusion n'est automatique." />

      {canListings ? (
        <section aria-labelledby="pending" className="grid gap-3">
          <h2 id="pending" className="text-lg font-bold">
            Annonces à valider ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Aucune annonce en attente" description="Les annonces des catégories sensibles ou contenant des mots-clés à risque apparaîtront ici." />
          ) : (
            <div className="grid gap-3">
              {pending.map((l) => {
                const keywords = detectSensitiveKeywords(`${l.title} ${l.description} ${l.brandName ?? ""}`);
                return (
                  <Card key={l.id} className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="grid min-w-0 gap-3">
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="flex gap-1.5">
                          {l.images.map((img) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={img.id} src={imageUrl(img.id)} alt="" width={64} height={64} className="size-16 rounded-md border border-border object-cover" />
                          ))}
                        </div>
                        <div className="grid min-w-0 flex-1 gap-1">
                          <Link href={listingPath(l.slug, l.publicId)} className="font-semibold hover:underline">
                            {l.title}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {formatMoney(l.priceAmount, l.currency)} · {l.category.name} · {l.countryCode} · mis à jour le {dateFmt.format(l.updatedAt)}
                          </p>
                          <p className="text-sm">
                            Vendeur :{" "}
                            <Link href={`/admin/utilisateurs?u=${l.sellerId}`} className="font-medium text-primary hover:underline">
                              {l.seller.profile?.displayName ?? "—"}
                            </Link>{" "}
                            <span className="text-muted-foreground">
                              ({l.seller.profile?.sellerType === "BUSINESS" ? "pro" : "particulier"}, {l.seller.profile?.salesCount ?? 0} vente{(l.seller.profile?.salesCount ?? 0) > 1 ? "s" : ""}, inscrit le {dateFmt.format(l.seller.createdAt)})
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {l.category.requiresReview ? <Badge tone="warning">Catégorie à vérification</Badge> : null}
                        {keywords.map((k) => (
                          <Badge key={k} tone="danger">
                            Mot-clé : {k}
                          </Badge>
                        ))}
                        {(reportCounts.get(l.id) ?? 0) > 0 ? <Badge tone="danger">{reportCounts.get(l.id)} signalement(s)</Badge> : null}
                      </div>
                      <p className="line-clamp-4 text-sm whitespace-pre-line text-muted-foreground">{l.description}</p>
                    </div>
                    <ListingModeration listingId={l.id} status={l.status} />
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {canReports ? (
        <section aria-labelledby="signalements" id="signalements" className="grid gap-3">
          <h2 id="signalements-title" className="text-lg font-bold">
            Signalements ouverts ({reports.length})
          </h2>
          {reports.length === 0 ? (
            <EmptyState icon={Flag} title="Aucun signalement ouvert" />
          ) : (
            <div className="grid gap-3">
              {reports.map((r) => {
                const target = byId.get(r.targetId) as Record<string, unknown> | undefined;
                return (
                  <Card key={r.id} className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="grid min-w-0 gap-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="danger">{REASONS[r.reason] ?? r.reason}</Badge>
                        <Badge tone="neutral">{TARGETS[r.targetType] ?? r.targetType}</Badge>
                        <span className="text-muted-foreground">
                          par {r.reporter.profile?.displayName ?? "membre"} · {dateFmt.format(r.createdAt)}
                        </span>
                      </div>
                      {r.details ? <p className="whitespace-pre-line">« {r.details} »</p> : null}
                      <div className="rounded-lg border border-border bg-subtle p-3">
                        {r.targetType === "MESSAGE" && !canReadMessages ? (
                          <p className="text-muted-foreground">Message privé : consultation réservée à l&apos;équipe de modération.</p>
                        ) : !target ? (
                          <p className="text-muted-foreground">Contenu introuvable (supprimé).</p>
                        ) : r.targetType === "LISTING" ? (
                          <Link href={listingPath(String(target.slug), String(target.publicId))} className="font-medium hover:underline">
                            {String(target.title)} — {formatMoney(Number(target.priceAmount), String(target.currency))} ({String(target.status)})
                          </Link>
                        ) : r.targetType === "MESSAGE" ? (
                          <div className="grid gap-1">
                            <p className="whitespace-pre-line">{String(target.body)}</p>
                            {(target.riskFlags as string[]).length ? <p className="text-xs text-destructive">Indices de risque détectés : {(target.riskFlags as string[]).join(", ")}</p> : null}
                            {target.isHidden ? <Badge tone="neutral">Déjà masqué</Badge> : null}
                          </div>
                        ) : r.targetType === "REVIEW" ? (
                          <p>
                            {String(target.rating)}/5 — {String(target.comment ?? "(sans commentaire)")} ({String(target.status)})
                          </p>
                        ) : (
                          <Link href={`/admin/utilisateurs?u=${r.targetId}`} className="font-medium hover:underline">
                            {String((target.profile as { displayName?: string } | null)?.displayName ?? "Membre")} ({String(target.status)})
                          </Link>
                        )}
                      </div>
                    </div>
                    <ReportControls reportId={r.id} targetType={r.targetType} targetId={r.targetId} canModerateListing={canListings} listingStatus={r.targetType === "LISTING" ? (target?.status as string | undefined) : undefined} />
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
