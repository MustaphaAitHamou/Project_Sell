import { ArrowRight, MessagesSquare, ShieldCheck, Star, Truck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SearchBar } from "@/components/layout/search-bar";
import { CategoryIcon } from "@/components/listings/category-icon";
import { ListingCard, ListingGrid } from "@/components/listings/listing-card";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/server/auth/session";
import { getCategoryBySlug, getCategoryDescendantIds, getCategoryTree } from "@/server/services/catalog";
import { getFavoriteIds } from "@/server/services/favorites";
import { getLatestListings } from "@/server/services/listings";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale as "fr");
  const t = await getTranslations("home");
  const artisanat = await getCategoryBySlug("artisanat");
  const [user, tree, latest, latestFr, latestDz, artisan] = await Promise.all([
    getCurrentUser(),
    getCategoryTree(),
    getLatestListings({ limit: 10 }),
    getLatestListings({ countryCode: "FR", limit: 5 }),
    getLatestListings({ countryCode: "DZ", limit: 5 }),
    artisanat ? getCategoryDescendantIds(artisanat.id).then((ids) => getLatestListings({ categoryIds: ids, limit: 5 })) : Promise.resolve([]),
  ]);
  const favs = user ? await getFavoriteIds(user.id, [...latest, ...latestFr, ...latestDz, ...artisan].map((l) => l.id)) : new Set<string>();
  const card = (l: (typeof latest)[number], i: number) => <ListingCard key={l.id} listing={l} favorited={favs.has(l.id)} signedIn={!!user} priority={i < 2} />;

  return (
    <div className="grid gap-14 pb-8">
      <section className="relative overflow-hidden border-b border-border bg-[radial-gradient(1200px_500px_at_10%_-10%,var(--primary-soft),transparent_60%),radial-gradient(900px_400px_at_100%_0%,var(--accent-soft),transparent_55%)]">
        <div className="container-page grid gap-8 py-12 md:py-20 lg:grid-cols-[1.25fr_1fr] lg:items-center">
          <div className="grid gap-6 animate-rise">
            <h1 className="max-w-2xl text-3xl leading-tight font-extrabold sm:text-4xl md:text-5xl">{t("heroTitle")}</h1>
            <p className="max-w-xl text-base text-muted-foreground md:text-lg">{t("heroSubtitle")}</p>
            <div className="hidden max-w-xl md:block">
              <SearchBar />
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/vendre/nouvelle-annonce" className={buttonVariants({ size: "lg" })}>
                {t("heroSell")}
              </Link>
              <Link href="/explorer" className={buttonVariants({ size: "lg", variant: "outline" })}>
                Explorer les articles
              </Link>
            </div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              { icon: ShieldCheck, title: t("trust1Title"), text: t("trust1Text") },
              { icon: Star, title: t("trust2Title"), text: t("trust2Text") },
              { icon: MessagesSquare, title: t("trust3Title"), text: t("trust3Text") },
            ].map((item) => (
              <li key={item.title} className="flex gap-3 rounded-xl border border-border bg-card/80 p-4 backdrop-blur">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-soft-foreground">
                  <item.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page grid gap-5" aria-labelledby="cats">
        <div className="flex items-end justify-between gap-4">
          <h2 id="cats" className="text-xl font-bold sm:text-2xl">
            {t("popularCategories")}
          </h2>
          <Link href="/categories" className="text-sm font-semibold text-primary hover:underline">
            Toutes les catégories
          </Link>
        </div>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {tree.slice(0, 16).map((c) => (
            <li key={c.id}>
              <Link href={`/categorie/${c.slug}`} className="flex h-full flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 text-center transition-colors hover:border-primary/40 hover:bg-primary-soft/40">
                <span className="grid size-11 place-items-center rounded-full bg-primary-soft text-primary-soft-foreground">
                  <CategoryIcon name={c.icon} className="size-5" />
                </span>
                <span className="text-xs leading-tight font-medium sm:text-sm">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-page grid gap-5" aria-labelledby="latest">
        <div className="flex items-end justify-between gap-4">
          <h2 id="latest" className="text-xl font-bold sm:text-2xl">
            {t("latest")}
          </h2>
          <Link href="/explorer?tri=recent" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            Voir tout <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </Link>
        </div>
        <ListingGrid>{latest.map(card)}</ListingGrid>
      </section>

      {artisan.length > 0 ? (
        <section className="bg-accent-soft/50 py-10" aria-labelledby="artisan">
          <div className="container-page grid gap-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="grid gap-1">
                <h2 id="artisan" className="text-xl font-bold sm:text-2xl">
                  {t("artisanTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">{t("artisanText")}</p>
              </div>
              <Link href="/categorie/artisanat" className={cn(buttonVariants({ variant: "outline" }), "self-start sm:self-auto")}>
                {t("artisanCta")}
              </Link>
            </div>
            <ListingGrid>{artisan.map(card)}</ListingGrid>
          </div>
        </section>
      ) : null}

      <section className="container-page grid gap-10 lg:grid-cols-2" aria-label="Par pays">
        {[
          { title: t("latestFr"), items: latestFr, href: "/explorer?pays=FR" },
          { title: t("latestDz"), items: latestDz, href: "/explorer?pays=DZ" },
        ].map((block) => (
          <div key={block.title} className="grid content-start gap-4">
            <div className="flex items-end justify-between">
              <h2 className="text-lg font-bold">{block.title}</h2>
              <Link href={block.href} className="text-sm font-semibold text-primary hover:underline">
                Voir tout
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{block.items.slice(0, 3).map(card)}</div>
          </div>
        ))}
      </section>

      <section className="container-page">
        <div className="grid gap-6 overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground sm:p-10 md:grid-cols-[auto_1fr] md:items-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary-foreground/10">
            <Truck className="size-7" aria-hidden />
          </span>
          <div className="grid gap-3">
            <h2 className="text-xl font-bold sm:text-2xl">{t("transportTitle")}</h2>
            <p className="max-w-3xl text-primary-foreground/85">{t("transportText")}</p>
            <Link href="/comment-ca-marche#transport" className="inline-flex w-fit items-center gap-1 font-semibold underline-offset-4 hover:underline">
              {t("transportCta")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section className="container-page">
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="grid gap-1">
            <h2 className="text-xl font-bold">{t("sellTitle")}</h2>
            <p className="text-muted-foreground">{t("sellText")}</p>
          </div>
          <Link href="/vendre/nouvelle-annonce" className={buttonVariants({ size: "lg", variant: "accent" })}>
            {t("sellCta")}
          </Link>
        </div>
      </section>
    </div>
  );
}
