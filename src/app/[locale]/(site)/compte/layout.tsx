import { AccountNav } from "@/components/layout/account-nav";
import { requireUserPage } from "@/server/auth/session";
import { getHeaderCounts } from "@/server/services/header";

export const metadata = { robots: { index: false, follow: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserPage("/compte");
  const counts = await getHeaderCounts(user.id);
  return (
    <div className="container-page grid gap-6 py-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10 md:py-10">
      <aside className="md:sticky md:top-36 md:self-start">
        <AccountNav unread={{ messages: counts.unreadConversations, notifications: counts.unreadNotifications }} />
      </aside>
      <div className="grid min-w-0 content-start gap-6">{children}</div>
    </div>
  );
}
