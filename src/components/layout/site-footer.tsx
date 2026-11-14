import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "./theme-toggle";

export async function SiteFooter() {
  const t = await getTranslations();
  const columns = [
    {
      title: t("footer.discover"),
      links: [
        { href: "/explorer", label: t("nav.explore") },
        { href: "/categories", label: t("nav.categories") },
        { href: "/vendre", label: t("nav.sell") },
        { href: "/comment-ca-marche", label: t("nav.howItWorks") },
      ],
    },
    {
      title: t("footer.help"),
      links: [
        { href: "/centre-aide", label: t("nav.help") },
        { href: "/protection-acheteur", label: t("nav.buyerProtection") },
        { href: "/objets-interdits", label: t("footer.prohibited") },
        { href: "/contact", label: t("footer.contact") },
      ],
    },
    {
      title: t("footer.legal"),
      links: [
        { href: "/conditions", label: t("footer.terms") },
        { href: "/confidentialite", label: t("footer.privacy") },
        { href: "/mentions-legales", label: t("footer.legalNotice") },
      ],
    },
  ];
  return (
    <footer className="mt-16 border-t border-border bg-card pb-24 md:pb-0">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="grid content-start gap-4">
          <Logo />
          <p className="text-lg leading-snug font-extrabold text-balance text-primary-text">{t("footer.slogan")}</p>
          <p className="max-w-xs text-sm text-muted-foreground">{t("footer.tagline")}</p>
          <div className="rounded-lg border border-border bg-subtle p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">{t("footer.ecosystem")} · {t("footer.transport")}</p>
            <p>{t("footer.transportNote")}</p>
          </div>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <p className="mb-3 text-sm font-semibold">{col.title}</p>
            <ul className="grid gap-2 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-muted-foreground hover:text-foreground hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-5 text-xs text-muted-foreground sm:flex-row">
          <p>{t("footer.rights", { year: new Date().getFullYear() })}</p>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
