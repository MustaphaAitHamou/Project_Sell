import { ArrowRight, MessagesSquare, ShieldCheck, Star } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  CATEGORY_TILE_COLORS,
  ChatStepSpot,
  MarketHeroIllustration,
  PhotoStepSpot,
  ShipStepSpot,
  TransportSpot,
} from "@/components/illustrations/market-scenes";
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
    <div className="grid gap-12 pb-8">
      {/* Accueil : une promesse courte, deux actions, et l'illustration du colis qui change de mains. */}
      <section className="relative overflow-hidden">
        <div className="container-page grid gap-8 pt-8 pb-2 md:pt-12 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div className="grid gap-6 animate-rise">
            <h1 className="max-w-2xl text-3xl leading-tight font-extrabold sm:text-4xl md:text-5xl">{t("heroTitle")}</h1>
            <p className="max-w-xl text-base text-muted-foreground md:text-lg">{t("heroSubtitle")}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/vendre/nouvelle-annonce" className={buttonVariants({ size: "lg" })}>
                {t("heroSell")}
              </Link>
              <Link href="/explorer" className={buttonVariants({ size: "lg", variant: "outline" })}>
                {t("exploreCta")}
              </Link>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-muted-foreground" aria-label={t("trustLabel")}>
              {[
                { icon: ShieldCheck, label: t("trust1Title") },
                { icon: Star, label: t("trust2Title") },
                { icon: MessagesSquare, label: t("trust3Title") },
              ].map((item) => (
                <li key={item.label} className="inline-flex items-center gap-1.5">
                  <item.icon className="size-4 text-primary-text" aria-hidden />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
          <MarketHeroIllustration className="mx-auto max-w-[520px]" />
        </div>
      </section>

      <section className="container-page grid gap-5" aria-labelledby="cats">
        <div className="flex items-end justify-between gap-4">
          <h2 id="cats" className="text-xl font-bold sm:text-2xl">
            {t("popularCategories")}
          </h2>
          <Link href="/categories" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-text hover:underline">
            {t("allCategories")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </Link>
        </div>
        {/* Huit catégories en tuiles colorées (fond teinté selon le thème) ; le reste est à un clic. */}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tree.slice(0, 8).map((c, i) => (
            <li key={c.id}>
              <Link
                href={`/categorie/${c.slug}`}
                style={{ "--tile": CATEGORY_TILE_COLORS[i % CATEGORY_TILE_COLORS.length] } as React.CSSProperties}
                className="group flex h-full items-center gap-3 rounded-2xl bg-[color-mix(in_srgb,var(--tile)_16%,var(--card))] p-4 transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--tile)] text-white shadow-sm transition-transform group-hover:rotate-[-6deg] motion-reduce:transition-none">
                  <CategoryIcon name={c.icon} className="size-6" />
                </span>
                <span className="text-sm leading-tight font-semibold sm:text-[15px]">{c.name}</span>
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
          <Link href="/explorer?tri=recent" className="inline-flex items-center gap-1 text-sm font-semibold text-primary-text hover:underline">
            {t("seeAll")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </Link>
        </div>
        <ListingGrid>{latest.map(card)}</ListingGrid>
      </section>

      {/* Vendre en trois étapes, chacune illustrée. */}
      <section className="container-page" aria-labelledby="steps">
        <div className="grid gap-8 rounded-3xl border border-border bg-card p-6 sm:p-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h2 id="steps" className="text-2xl font-extrabold sm:text-3xl">
              {t("stepsTitle")}
            </h2>
            <Link href="/vendre/nouvelle-annonce" className={cn(buttonVariants(), "self-start sm:self-auto")}>
              {t("sellCta")}
            </Link>
          </div>
          <ol className="grid gap-6 md:grid-cols-3">
            {[
              { art: <PhotoStepSpot className="w-40" />, title: t("step1Title"), text: t("step1Text") },
              { art: <ChatStepSpot className="w-40" />, title: t("step2Title"), text: t("step2Text") },
              { art: <ShipStepSpot className="w-40" />, title: t("step3Title"), text: t("step3Text") },
            ].map((step, i) => (
              <li key={step.title} className="grid justify-items-center gap-3 text-center">
                {step.art}
                <p className="text-xs font-bold tracking-widest text-primary-text uppercase">{i + 1}</p>
                <h3 className="text-lg font-bold">{step.title}</h3>
                <p className="max-w-xs text-sm text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
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
              <Link href={block.href} className="text-sm font-semibold text-primary-text hover:underline">
                {t("seeAll")}
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{block.items.slice(0, 3).map(card)}</div>
          </div>
        ))}
      </section>

      <section className="container-page">
        <div className="grid gap-6 overflow-hidden rounded-3xl bg-[image:var(--brand-gradient)] p-6 text-brand-ink sm:p-10 md:grid-cols-[auto_1fr] md:items-center">
          <TransportSpot className="mx-auto w-48 md:w-56" />
          <div className="grid gap-3">
            <h2 className="text-xl font-bold sm:text-2xl">{t("transportTitle")}</h2>
            <p className="max-w-3xl text-brand-ink/85">{t("transportText")}</p>
            <Link href="/comment-ca-marche#transport" className="inline-flex w-fit items-center gap-1 font-semibold underline-offset-4 hover:underline">
              {t("transportCta")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
