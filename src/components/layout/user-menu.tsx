"use client";
import { Heart, LayoutDashboard, LogOut, MessageCircle, Package, Settings, Shield, ShoppingBag, Tag, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";

export function UserMenu({ name, handle, avatar, isStaff }: { name: string; handle: string | null; avatar: string | null; isStaff: boolean }) {
  const t = useTranslations("nav");
  const router = useRouter();
  const [pending, start] = useTransition();
  const items = [
    { href: "/compte", label: t("account"), icon: LayoutDashboard },
    { href: "/compte/annonces", label: t("myListings"), icon: Tag },
    { href: "/compte/ventes", label: t("mySales"), icon: Package },
    { href: "/compte/commandes", label: t("myOrders"), icon: ShoppingBag },
    { href: "/compte/favoris", label: t("favorites"), icon: Heart },
    { href: "/compte/messages", label: t("messages"), icon: MessageCircle },
    { href: "/compte/parametres", label: t("settings"), icon: Settings },
  ] as const;
  return (
    <Dropdown>
      <DropdownTrigger className="rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={t("account")}>
        <Avatar name={name} src={avatar} size={36} />
      </DropdownTrigger>
      <DropdownContent>
        <DropdownLabel>
          <span className="block truncate font-semibold text-foreground">{name}</span>
          {handle ? <span className="block truncate">@{handle}</span> : null}
        </DropdownLabel>
        <DropdownSeparator />
        {handle ? (
          <DropdownItem asChild>
            <Link href={`/vendeur/${handle}`}>
              <User /> Profil public
            </Link>
          </DropdownItem>
        ) : null}
        {items.map((it) => (
          <DropdownItem key={it.href} asChild>
            <Link href={it.href}>
              <it.icon /> {it.label}
            </Link>
          </DropdownItem>
        ))}
        {isStaff ? (
          <>
            <DropdownSeparator />
            <DropdownItem asChild>
              <Link href="/admin">
                <Shield /> {t("admin")}
              </Link>
            </DropdownItem>
          </>
        ) : null}
        <DropdownSeparator />
        <DropdownItem
          disabled={pending}
          onSelect={(e) => {
            e.preventDefault();
            start(async () => {
              await authClient.signOut();
              router.push("/");
              router.refresh();
            });
          }}
        >
          <LogOut /> {t("signOut")}
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}
