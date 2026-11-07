import { getTranslations } from "next-intl/server";
import { EnvironmentBanner } from "@/components/layout/environment-banner";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { usesSimulators } from "@/lib/env";
import { getCurrentUser } from "@/server/auth/session";
import { getHeaderCounts } from "@/server/services/header";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [user, t] = await Promise.all([getCurrentUser(), getTranslations("common")]);
  const counts = user ? await getHeaderCounts(user.id) : null;
  return (
    <>
      <a href="#contenu" className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:start-4 focus:top-4">
        {t("skipToContent")}
      </a>
      {usesSimulators ? <EnvironmentBanner /> : null}
      <SiteHeader user={user} />
      <main id="contenu" className="min-h-[60vh]">
        {children}
      </main>
      <SiteFooter />
      <MobileTabBar unread={counts?.unreadConversations ?? 0} signedIn={!!user} />
    </>
  );
}
