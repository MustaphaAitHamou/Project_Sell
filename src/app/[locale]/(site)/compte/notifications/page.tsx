import { Bell } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter } from "next-intl/server";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { requireUserPage } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { markNotificationsRead } from "@/server/services/account-settings";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUserPage("/compte/notifications");
  const [items, format] = await Promise.all([db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 }), getFormatter()]);
  // Consulter la liste vaut lecture (les éléments non lus restent signalés sur cet affichage).
  await markNotificationsRead(user.id);
  return (
    <>
      <PageHeader title="Notifications" />
      {items.length === 0 ? (
        <EmptyState icon={Bell} title="Aucune notification" />
      ) : (
        <ul className="grid gap-2">
          {items.map((n) => {
            const content = (
              <Card className={cn("grid gap-0.5 p-4", !n.readAt && "border-primary/40 bg-primary-soft/30")}>
                <p className="flex items-center justify-between gap-2 text-sm font-semibold">
                  {n.title}
                  <time className="shrink-0 text-xs font-normal text-muted-foreground">{format.relativeTime(n.createdAt)}</time>
                </p>
                <p className="text-sm text-muted-foreground">{n.body}</p>
              </Card>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link}>{content}</Link> : content}</li>;
          })}
        </ul>
      )}
    </>
  );
}
