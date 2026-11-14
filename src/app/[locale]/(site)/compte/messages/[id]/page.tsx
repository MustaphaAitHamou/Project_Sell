import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Price } from "@/components/listings/price";
import { ReportDialog } from "@/components/listings/report-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/misc";
import { Thread } from "@/features/messaging/thread";
import { Link } from "@/i18n/navigation";
import { listingPath } from "@/lib/domain/ids";
import { avatarUrl, imageUrl } from "@/lib/utils";
import { requireUserPage } from "@/server/auth/session";
import { getConversation } from "@/server/services/messaging";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const user = await requireUserPage(`/compte/messages/${id}`);
  const data = await getConversation(user, id).catch(() => null);
  if (!data) notFound();
  const { conversation: c, counterpart, block } = data;
  const name = counterpart.profile?.displayName ?? "Membre";
  const lastIncoming = [...c.messages].reverse().find((m) => m.senderId && m.senderId !== user.id);
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={name} src={counterpart.profile?.avatarKey ? avatarUrl(counterpart.id, counterpart.profile.avatarKey) : null} size={44} />
          <div>
            <h1 className="text-lg font-bold">{name}</h1>
            {counterpart.profile?.handle ? (
              <Link href={`/vendeur/${counterpart.profile.handle}`} className="text-xs text-primary-text hover:underline">
                Voir le profil
              </Link>
            ) : null}
          </div>
        </div>
        <Link href="/compte/messages" className="text-sm font-medium text-primary-text hover:underline">
          Toutes les conversations
        </Link>
      </div>
      <Card className="flex items-center gap-3 p-3">
        <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted">{c.listing.images[0] ? <img src={imageUrl(c.listing.images[0].id, "thumb")} alt="" className="size-full object-cover" /> : null}</div>
        <div className="min-w-0 flex-1">
          <Link href={listingPath(c.listing.slug, c.listing.publicId)} className="truncate text-sm font-semibold hover:underline">
            {c.listing.title}
          </Link>
          <Price amount={c.listing.priceAmount} currency={c.listing.currency} className="block text-sm" />
        </div>
      </Card>
      <Thread
        conversationId={c.id}
        counterpartId={counterpart.id}
        blockedByMe={!!block?.byMe}
        canSend={!block && c.status === "OPEN"}
        messages={c.messages.map((m) => ({ id: m.id, mine: m.senderId === user.id, system: m.kind === "SYSTEM", body: m.body, createdAt: m.createdAt.toISOString(), riskFlags: m.riskFlags, attachments: m.attachments }))}
      />
      {lastIncoming ? (
        <div className="flex justify-end">
          <ReportDialog targetType="MESSAGE" targetId={lastIncoming.id} signedIn label="Signaler le dernier message reçu" />
        </div>
      ) : null}
    </>
  );
}
