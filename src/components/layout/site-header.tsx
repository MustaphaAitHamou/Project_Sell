import { Bell, Heart, MessageCircle, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { avatarUrl, cn } from "@/lib/utils";
import type { CurrentUser } from "@/server/auth/session";
import { getCategoryTree } from "@/server/services/catalog";
import { getHeaderCounts } from "@/server/services/header";
import { SearchBar } from "./search-bar";
import { UserMenu } from "./user-menu";

function IconLink({ href, label, count, children }: { href: string; label: string; count?: number; children: React.ReactNode }) {
  return (
    <Link href={href} className="relative grid size-10 place-items-center rounded-full text-foreground hover:bg-muted" aria-label={count ? `${label} (${count})` : label}>
      {children}
      {count ? (
        <span className="absolute -top-0.5 -end-0.5 min-w-[18px] rounded-full bg-accent px-1 text-center text-[10px] leading-[18px] font-bold text-accent-foreground">{count > 9 ? "9+" : count}</span>
      ) : null}
    </Link>
  );
}

export async function SiteHeader({ user, query }: { user: CurrentUser | null; query?: string }) {
  const t = await getTranslations("nav");
  const [tree, counts] = await Promise.all([getCategoryTree(), user ? getHeaderCounts(user.id) : Promise.resolve(null)]);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="container-page flex h-16 items-center gap-3 md:gap-6">
        <Link href="/" className="shrink-0 rounded-lg" aria-label="Tamurt Market, accueil">
          <Logo />
        </Link>
        <div className="hidden flex-1 md:block">
          <SearchBar defaultValue={query} />
        </div>
        <nav className="ms-auto flex items-center gap-1 md:ms-0" aria-label={t("account")}>
          <Link href="/vendre/nouvelle-annonce" className={cn(buttonVariants({ size: "md" }), "hidden md:inline-flex")}>
            <Plus /> {t("sellCta")}
          </Link>
          {user ? (
            <>
              <span className="hidden md:contents">
                <IconLink href="/compte/favoris" label={t("favorites")}>
                  <Heart className="size-5" />
                </IconLink>
                <IconLink href="/compte/messages" label={t("messages")} count={counts?.unreadConversations}>
                  <MessageCircle className="size-5" />
                </IconLink>
              </span>
              <IconLink href="/compte/notifications" label={t("notifications")} count={counts?.unreadNotifications}>
                <Bell className="size-5" />
              </IconLink>
              <span className="ms-1">
                <UserMenu
                  name={user.profile?.displayName ?? user.name}
                  handle={user.profile?.handle ?? null}
                  avatar={user.profile?.avatarKey ? avatarUrl(user.id, user.profile.avatarKey) : user.image}
                  isStaff={user.isStaff}
                />
              </span>
            </>
          ) : (
            <>
              <Link href="/connexion" className={cn(buttonVariants({ variant: "ghost" }))}>
                {t("signIn")}
              </Link>
              <Link href="/inscription" className={cn(buttonVariants({ variant: "outline" }), "hidden sm:inline-flex")}>
                {t("signUp")}
              </Link>
            </>
          )}
        </nav>
      </div>
      <div className="container-page pb-3 md:hidden">
        <SearchBar defaultValue={query} />
      </div>
      <nav aria-label={t("categories")} className="hidden border-t border-border/70 md:block">
        <ul className="container-page scrollbar-none flex h-11 items-center gap-1 overflow-x-auto text-sm">
          {tree.map((c) => (
            <li key={c.id} className="shrink-0">
              <Link href={`/categorie/${c.slug}`} className="rounded-full px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
