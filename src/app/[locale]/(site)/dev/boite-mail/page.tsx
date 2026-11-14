import { Inbox } from "lucide-react";
import { getFormatter } from "next-intl/server";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui/misc";
import { db } from "@/server/db/client";

export const dynamic = "force-dynamic";

function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a key={i} href={p} className="font-medium break-all text-primary-text underline">
        {p}
      </a>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export default async function DevMailboxPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const { to } = await searchParams;
  const format = await getFormatter();
  const messages = await db.emailMessage.findMany({ where: to ? { to } : {}, orderBy: { createdAt: "desc" }, take: 40 });
  return (
    <div className="grid gap-6">
      <PageHeader title="Boîte mail locale" description="Emails générés par l'application. Aucun email réel n'est envoyé (EMAIL_PROVIDER=outbox)." />
      <Alert tone="warning">Outil de développement : indisponible en production.</Alert>
      {messages.length === 0 ? (
        <EmptyState icon={Inbox} title="Aucun email" description={to ? `Aucun email pour ${to}.` : "Les emails apparaîtront ici."} />
      ) : (
        <ul className="grid gap-3">
          {messages.map((m) => (
            <li key={m.id}>
              <Card className="grid gap-2 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{m.subject}</p>
                  <time className="text-xs text-muted-foreground">{format.dateTime(m.createdAt, { dateStyle: "short", timeStyle: "medium" })}</time>
                </div>
                <p className="text-xs text-muted-foreground">
                  À : <span data-testid="mail-to">{m.to}</span> · modèle « {m.template} » · {m.status}
                </p>
                <pre className="text-sm leading-relaxed whitespace-pre-wrap">{linkify(m.text)}</pre>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
