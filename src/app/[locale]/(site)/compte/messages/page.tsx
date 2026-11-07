import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter } from "next-intl/server";
import { Avatar } from "@/components/ui/avatar";
import { Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";
import { avatarUrl, cn, imageUrl } from "@/lib/utils";
import { requireUserPage } from "@/server/auth/session";
import { listConversations } from "@/server/services/messaging";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const user = await requireUserPage("/compte/messages");
  const [rows, format] = await Promise.all([listConversations(user), getFormatter()]);
  return (
    <>
      <PageHeader title="Messages" description="Vos échanges avec les acheteurs et vendeurs. Vos coordonnées restent privées." />
      {rows.length === 0 ? (
        <EmptyState icon={MessageCircle} title="Aucune conversation" description="Contactez un vendeur depuis une annonce pour commencer." />
      ) : (
        <ul className="grid gap-2">
          {rows.map((c) => {
            const name = c.counterpart.profile?.displayName ?? "Membre";
            return (
              <li key={c.id}>
                <Link href={`/compte/messages/${c.id}`}>
                  <Card className={cn("flex items-center gap-3 p-3 transition-colors hover:bg-subtle", c.unread && "border-primary/40")}>
                    <Avatar name={name} src={c.counterpart.profile?.avatarKey ? avatarUrl(c.counterpart.id, c.counterpart.profile.avatarKey) : null} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate text-sm", c.unread ? "font-bold" : "font-medium")}>
                        {name} <span className="font-normal text-muted-foreground">· {c.role === "BUYER" ? "vous achetez" : "vous vendez"}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{c.listing.title}</p>
                      <p className={cn("truncate text-sm", c.unread ? "text-foreground" : "text-muted-foreground")}>{c.preview}</p>
                    </div>
                    <div className="grid shrink-0 justify-items-end gap-1">
                      <time className="text-[11px] text-muted-foreground">{format.relativeTime(c.lastMessageAt)}</time>
                      <div className="size-10 overflow-hidden rounded-md bg-muted">{c.listing.images[0] ? <img src={imageUrl(c.listing.images[0].id, "thumb")} alt="" className="size-full object-cover" loading="lazy" /> : null}</div>
                    </div>
                    {c.unread ? <span className="size-2.5 rounded-full bg-accent" aria-label="Non lu" /> : null}
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
