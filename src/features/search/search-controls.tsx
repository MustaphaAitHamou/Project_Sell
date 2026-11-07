"use client";
import { BookmarkPlus, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Label, Select } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { saveSearchAction } from "./actions";

export type FilterState = {
  q: string;
  category: string;
  country: string;
  region: string;
  priceMin: string;
  priceMax: string;
  conditions: string[];
  brand: string;
  delivery: boolean;
  verified: boolean;
  sellerType: string;
  includeSold: boolean;
  sort: string;
};

type Options = {
  categories: { slug: string; name: string; depth: number }[];
  countries: { code: string; name: string; currency: string }[];
  regionsByCountry: Record<string, { id: string; name: string; code: string }[]>;
  brands: { slug: string; name: string }[];
  conditions: { value: string; label: string }[];
};

function toQuery(s: FilterState, basePath: string) {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  if (s.category && !basePath.startsWith("/categorie/")) p.set("categorie", s.category);
  if (s.country) p.set("pays", s.country);
  if (s.region) p.set("region", s.region);
  if (s.priceMin) p.set("prix_min", s.priceMin);
  if (s.priceMax) p.set("prix_max", s.priceMax);
  if (s.conditions.length) p.set("etat", s.conditions.join(","));
  if (s.brand) p.set("marque", s.brand);
  if (s.delivery) p.set("livraison", "1");
  if (s.verified) p.set("verifie", "1");
  if (s.sellerType) p.set("vendeur", s.sellerType);
  if (s.includeSold) p.set("vendus", "1");
  if (s.sort) p.set("tri", s.sort);
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function FilterForm({ initial, options, basePath, onDone, lockCategory }: { initial: FilterState; options: Options; basePath: string; onDone?: () => void; lockCategory: boolean }) {
  const t = useTranslations("search");
  const router = useRouter();
  const [s, setS] = useState(initial);
  const regions = options.regionsByCountry[s.country] ?? [];
  const currency = options.countries.find((c) => c.code === s.country)?.currency;
  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(toQuery(s, basePath));
        onDone?.();
      }}
    >
      {!lockCategory ? (
        <Field label={t("category")} htmlFor="f-cat">
          <Select id="f-cat" value={s.category} onChange={(e) => setS({ ...s, category: e.target.value })}>
            <option value="">{t("allCategories")}</option>
            {options.categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {"  ".repeat(c.depth)}
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label={t("country")} htmlFor="f-country">
        <Select id="f-country" value={s.country} onChange={(e) => setS({ ...s, country: e.target.value, region: "" })}>
          <option value="">{t("allCountries")}</option>
          {options.countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      {s.country ? (
        <Field label={t("region")} htmlFor="f-region">
          <Select id="f-region" value={s.region} onChange={(e) => setS({ ...s, region: e.target.value })}>
            <option value="">{t("allRegions")}</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} — {r.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">
          Prix {currency ? `(${currency})` : ""}
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <Input aria-label={t("priceMin")} placeholder={t("priceMin")} inputMode="decimal" value={s.priceMin} onChange={(e) => setS({ ...s, priceMin: e.target.value })} disabled={!s.country} />
          <Input aria-label={t("priceMax")} placeholder={t("priceMax")} inputMode="decimal" value={s.priceMax} onChange={(e) => setS({ ...s, priceMax: e.target.value })} disabled={!s.country} />
        </div>
        <p className="text-xs text-muted-foreground">{t("currencyFilterNote")}</p>
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">{t("condition")}</legend>
        {options.conditions.map((c) => (
          <label key={c.value} className="flex items-center gap-2 text-sm">
            <Checkbox checked={s.conditions.includes(c.value)} onChange={(e) => setS({ ...s, conditions: e.target.checked ? [...s.conditions, c.value] : s.conditions.filter((x) => x !== c.value) })} />
            {c.label}
          </label>
        ))}
      </fieldset>
      <Field label={t("brand")} htmlFor="f-brand">
        <Select id="f-brand" value={s.brand} onChange={(e) => setS({ ...s, brand: e.target.value })}>
          <option value="">{t("anyBrand")}</option>
          {options.brands.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("sellerType")} htmlFor="f-seller">
        <Select id="f-seller" value={s.sellerType} onChange={(e) => setS({ ...s, sellerType: e.target.value })}>
          <option value="">{t("sellerAll")}</option>
          <option value="particulier">{t("sellerIndividual")}</option>
          <option value="pro">{t("sellerBusiness")}</option>
        </Select>
      </Field>
      <div className="grid gap-2 text-sm">
        <label className="flex items-center gap-2">
          <Checkbox checked={s.delivery} onChange={(e) => setS({ ...s, delivery: e.target.checked })} /> {t("delivery")}
        </label>
        <label className="flex items-center gap-2">
          <Checkbox checked={s.verified} onChange={(e) => setS({ ...s, verified: e.target.checked })} /> {t("verified")}
        </label>
        <label className="flex items-center gap-2">
          <Checkbox checked={s.includeSold} onChange={(e) => setS({ ...s, includeSold: e.target.checked })} /> {t("includeSold")}
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          {t("showResults")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setS({ ...initial, category: lockCategory ? initial.category : "", country: "", region: "", priceMin: "", priceMax: "", conditions: [], brand: "", delivery: false, verified: false, sellerType: "", includeSold: false })}>
          {t("clear")}
        </Button>
      </div>
    </form>
  );
}

export function SearchSidebar(props: { initial: FilterState; options: Options; basePath: string; lockCategory: boolean }) {
  return <FilterForm {...props} />;
}

export function MobileFilters(props: { initial: FilterState; options: Options; basePath: string; activeCount: number; lockCategory: boolean }) {
  const t = useTranslations("search");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="lg:hidden">
          <SlidersHorizontal /> {t("filtersButton")}
          {props.activeCount ? <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{props.activeCount}</span> : null}
        </Button>
      </DialogTrigger>
      <DialogContent title={t("filtersButton")} side="bottom">
        <FilterForm {...props} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function SortSelect({ initial, basePath }: { initial: FilterState; basePath: string }) {
  const t = useTranslations("search");
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="sort" className="sr-only sm:not-sr-only sm:text-sm sm:text-muted-foreground">
        {t("sort")}
      </Label>
      <Select id="sort" className="w-auto" value={initial.sort || (initial.q ? "pertinence" : "recent")} onChange={(e) => router.push(toQuery({ ...initial, sort: e.target.value }, basePath))}>
        {initial.q ? <option value="pertinence">{t("sortRelevance")}</option> : null}
        <option value="recent">{t("sortRecent")}</option>
        <option value="prix_asc">{t("sortPriceAsc")}</option>
        <option value="prix_desc">{t("sortPriceDesc")}</option>
      </Select>
    </div>
  );
}

export function SaveSearchButton({ query, defaultName, signedIn }: { query: string; defaultName: string; signedIn: boolean }) {
  const t = useTranslations("search");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!signedIn) return router.push(`/connexion?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        start(async () => {
          const res = await saveSearchAction({ query, name: defaultName.slice(0, 80) || "Ma recherche" });
          if (!res.ok) toast.error(res.error);
          else toast.success(t("searchSaved"));
        });
      }}
    >
      <BookmarkPlus /> {t("saveSearch")}
    </Button>
  );
}
