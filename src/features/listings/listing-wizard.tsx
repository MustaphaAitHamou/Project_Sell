"use client";
import { ArrowLeft, ArrowRight, Check, GripVertical, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert, Badge, Card } from "@/components/ui/misc";
import { useRouter } from "@/i18n/navigation";
import { formatMoney, parseAmountToMinor } from "@/lib/domain/money";
import { cn } from "@/lib/utils";
import { saveListingAction } from "./actions";
import { uploadListingImage, type UploadedImage } from "./image-upload";
import { CONDITIONS, DELIVERY_METHODS, MAX_LISTING_IMAGES, PARCEL_SIZES, type ListingInput } from "./schemas";

export type WizardCategory = { id: string; name: string; parentName: string | null; requiresReview: boolean; conditionRequired: boolean };
export type WizardAttribute = { key: string; label: string; type: "TEXT" | "NUMBER" | "SELECT" | "BOOLEAN"; options: string[]; unit: string | null; isRequired: boolean };
export type WizardCountry = { code: string; name: string; currency: string; regionLabel: string; nationalShipping: boolean };

type Props = {
  mode: "create" | "edit";
  listingId: string | null;
  version?: number;
  status?: string;
  initial: ListingInput & { images: UploadedImage[] };
  categories: WizardCategory[];
  attributes: Record<string, WizardAttribute[]>;
  countries: WizardCountry[];
  regionsByCountry: Record<string, { id: string; name: string; code: string }[]>;
  citiesByRegion: Record<string, { id: string; name: string }[]>;
  brands: string[];
  isBusiness: boolean;
  buyerFeeRateBps: number;
  transportEnabled: boolean;
};

const STEPS = ["stepPhotos", "stepDetails", "stepLocation", "stepDelivery", "stepReview"] as const;

export function ListingWizard(props: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [images, setImages] = useState<UploadedImage[]>(props.initial.images);
  const [uploading, setUploading] = useState(0);
  const [v, setV] = useState<ListingInput>(props.initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const country = props.countries.find((c) => c.code === v.countryCode) ?? props.countries[0]!;
  const category = props.categories.find((c) => c.id === v.categoryId);
  const attrs = (v.categoryId && props.attributes[v.categoryId]) || [];
  const regions = props.regionsByCountry[v.countryCode] ?? [];
  const cities = (v.regionId && props.citiesByRegion[v.regionId]) || [];
  const set = <K extends keyof ListingInput>(k: K, value: ListingInput[K]) => setV((s) => ({ ...s, [k]: value }));
  const priceMinor = parseAmountToMinor(v.price ?? "", country.currency);
  const fee = priceMinor ? Math.floor((priceMinor * props.buyerFeeRateBps + 5000) / 10000) : 0;

  const grouped = useMemo(() => {
    const map = new Map<string, WizardCategory[]>();
    for (const c of props.categories) {
      const key = c.parentName ?? "Autres";
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return [...map.entries()];
  }, [props.categories]);

  const addFiles = async (files: FileList | File[]) => {
    const list = [...files].slice(0, MAX_LISTING_IMAGES - images.length);
    if (list.length === 0) return toast.error(`${MAX_LISTING_IMAGES} photos maximum.`);
    setUploading((n) => n + list.length);
    for (const f of list) {
      try {
        const img = await uploadListingImage(f);
        setImages((s) => [...s, img]);
      } catch (e) {
        toast.error(`${f.name} : ${e instanceof Error ? e.message : "envoi impossible"}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const move = (from: number, to: number) =>
    setImages((s) => {
      if (to < 0 || to >= s.length) return s;
      const next = [...s];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it!);
      return next;
    });

  const validateStep = (i: number): boolean => {
    const e: Record<string, string> = {};
    if (i === 0 && images.length === 0) e.images = "Ajoutez au moins une photo.";
    if (i === 1) {
      if ((v.title ?? "").trim().length < 5) e.title = "5 caractères minimum.";
      if ((v.description ?? "").trim().length < 20) e.description = "20 caractères minimum.";
      if (!v.categoryId) e.categoryId = "Choisissez une catégorie.";
      if (category?.conditionRequired && !v.condition) e.condition = "Indiquez l'état.";
      if (!priceMinor) e.price = "Prix invalide (ex. 49,90).";
      for (const a of attrs) if (a.isRequired && (v.attributes?.[a.key] === undefined || v.attributes?.[a.key] === "")) e[`attributes.${a.key}`] = "Champ requis.";
    }
    if (i === 2 && !v.regionId) e.regionId = `Choisissez votre ${country.regionLabel.toLowerCase()}.`;
    if (i === 3) {
      if (!v.deliveryMethods?.length) e.deliveryMethods = "Choisissez au moins un mode de remise.";
      if ((v.deliveryMethods ?? []).some((m) => m !== "HAND_DELIVERY") && !v.parcelSize) e.parcelSize = "Format requis pour un envoi.";
      if (v.deliveryMethods?.includes("TAMURT_TRANSPORT") && !v.weightGrams) e.weightGrams = "Poids requis pour Tamurt Transport.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goTo = (i: number) => {
    if (i > step) for (let s = step; s < i; s++) if (!validateStep(s)) return setStep(s);
    setStep(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = (publish: boolean) => {
    for (let s = 0; s < 4; s++) if (!validateStep(s)) return setStep(s);
    start(async () => {
      const res = await saveListingAction({ listingId: props.listingId, version: props.version, publish, input: { ...v, imageIds: images.map((i) => i.id) } as never });
      if (!res.ok) {
        const fe = Object.fromEntries(Object.entries(res.fieldErrors ?? {}).map(([k, m]) => [k.replace(/^input\./, ""), m[0]!]));
        setErrors(fe);
        toast.error(res.error);
        const firstStep = Object.keys(fe).some((k) => ["title", "description", "categoryId", "condition", "price"].includes(k) || k.startsWith("attributes")) ? 1 : Object.keys(fe).some((k) => ["countryCode", "regionId", "cityId"].includes(k)) ? 2 : Object.keys(fe).length ? 3 : step;
        setStep(firstStep);
        return;
      }
      const { status, path } = res.data;
      toast.success(status === "ACTIVE" ? "Annonce publiée." : status === "PENDING_REVIEW" ? "Annonce envoyée en vérification." : "Brouillon enregistré.");
      router.push(status === "DRAFT" ? "/compte/annonces" : path);
      router.refresh();
    });
  };

  const err = (k: string) => errors[k];
  const alreadyPublished = props.status && !["DRAFT", "ARCHIVED", "REJECTED"].includes(props.status);

  return (
    <div className="grid gap-6 pb-24 md:pb-0">
      <ol className="grid grid-cols-5 gap-1.5" aria-label="Étapes">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => goTo(i)} className="grid w-full gap-1.5 text-start" aria-current={i === step ? "step" : undefined}>
              <span className={cn("h-1.5 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-border")} />
              <span className={cn("hidden text-xs font-medium sm:block", i === step ? "text-foreground" : "text-muted-foreground")}>
                {i + 1}. {t(`sell.${s}`)}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <h2 className="text-xl font-bold sm:hidden">
        {step + 1}. {t(`sell.${STEPS[step]!}`)}
      </h2>

      {step === 0 ? (
        <Card className="grid gap-4 p-5">
          <div
            className={cn("grid place-items-center gap-3 rounded-xl border-2 border-dashed border-border-strong bg-subtle p-8 text-center transition-colors", "hover:border-primary/50")}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
            }}
          >
            <ImagePlus className="size-8 text-primary-text" aria-hidden />
            <div>
              <p className="font-semibold">Ajoutez vos photos</p>
              <p className="text-sm text-muted-foreground">Glissez-déposez ou choisissez jusqu&apos;à {MAX_LISTING_IMAGES} photos (JPEG, PNG, WebP). Les métadonnées de localisation sont supprimées.</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()} disabled={images.length >= MAX_LISTING_IMAGES}>
              Choisir des photos
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              aria-label="Choisir des photos"
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          {err("images") ? <p className="text-sm font-medium text-destructive">{err("images")}</p> : null}
          {images.length || uploading ? (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5" aria-label="Photos de l'annonce">
              {images.map((img, i) => (
                <li
                  key={img.id}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex !== null) move(dragIndex, i);
                    setDragIndex(null);
                  }}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                >
                  <img src={img.url} alt={`Photo ${i + 1}`} className="size-full object-cover" />
                  {i === 0 ? <Badge tone="primary" className="absolute start-1.5 top-1.5">Couverture</Badge> : null}
                  <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1">
                    <span className="flex gap-1">
                      <button type="button" aria-label="Déplacer vers la gauche" onClick={() => move(i, i - 1)} className="grid size-7 place-items-center rounded-md bg-card/90 shadow-sm" disabled={i === 0}>
                        <ArrowLeft className="size-3.5 rtl:rotate-180" />
                      </button>
                      <button type="button" aria-label="Déplacer vers la droite" onClick={() => move(i, i + 1)} className="grid size-7 place-items-center rounded-md bg-card/90 shadow-sm" disabled={i === images.length - 1}>
                        <ArrowRight className="size-3.5 rtl:rotate-180" />
                      </button>
                    </span>
                    <button type="button" aria-label={`Supprimer la photo ${i + 1}`} onClick={() => setImages((s) => s.filter((x) => x.id !== img.id))} className="grid size-7 place-items-center rounded-md bg-card/90 text-destructive shadow-sm">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <GripVertical className="absolute end-1.5 top-1.5 size-4 text-white opacity-0 drop-shadow group-hover:opacity-100" aria-hidden />
                </li>
              ))}
              {Array.from({ length: uploading }, (_, i) => (
                <li key={`u${i}`} className="grid aspect-square place-items-center rounded-lg border border-border bg-muted">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Envoi en cours" />
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-muted-foreground">Conseil : lumière naturelle, fond neutre, montrez les éventuels défauts. La première photo sert de couverture.</p>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card className="grid gap-5 p-5">
          <Field label="Titre" htmlFor="title" error={err("title")} hint="Ex. « Console PS5 + 2 manettes », « Robe kabyle brodée taille M »." required>
            <Input id="title" value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={100} aria-invalid={!!err("title")} />
          </Field>
          <Field label="Description" htmlFor="description" error={err("description")} hint="État, dimensions, défauts, accessoires inclus… N'indiquez ni téléphone ni adresse." required>
            <Textarea id="description" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={5000} rows={7} aria-invalid={!!err("description")} />
          </Field>
          <Field label="Catégorie" htmlFor="category" error={err("categoryId")} required>
            <Select id="category" value={v.categoryId} onChange={(e) => setV((s) => ({ ...s, categoryId: e.target.value, attributes: {} }))} aria-invalid={!!err("categoryId")}>
              <option value="">Choisir une catégorie…</option>
              {grouped.map(([group, cats]) => (
                <optgroup key={group} label={group}>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.requiresReview ? " (vérifiée avant publication)" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          {category?.requiresReview ? <Alert tone="info">Catégorie réglementée : votre annonce sera vérifiée par l&apos;équipe de modération avant sa mise en ligne.</Alert> : null}
          <div className="grid gap-5 sm:grid-cols-2">
            {category?.conditionRequired !== false ? (
              <Field label="État" htmlFor="condition" error={err("condition")} required>
                <Select id="condition" value={v.condition ?? ""} onChange={(e) => set("condition", (e.target.value || null) as ListingInput["condition"])}>
                  <option value="">Choisir…</option>
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {t(`conditions.${c}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Marque" htmlFor="brand" hint="Facultatif">
              <Input id="brand" list="brands" value={v.brandName ?? ""} onChange={(e) => set("brandName", e.target.value)} maxLength={60} />
              <datalist id="brands">
                {props.brands.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </Field>
          </div>
          {attrs.length ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {attrs.map((a) => {
                const id = `attr-${a.key}`;
                const value = v.attributes?.[a.key];
                const onAttr = (val: string | number | boolean) => setV((s) => ({ ...s, attributes: { ...(s.attributes ?? {}), [a.key]: val } }));
                return a.type === "BOOLEAN" ? (
                  <label key={a.key} className="flex items-center gap-2 text-sm sm:mt-7">
                    <Checkbox checked={value === true} onChange={(e) => onAttr(e.target.checked)} /> {a.label}
                  </label>
                ) : (
                  <Field key={a.key} label={`${a.label}${a.unit ? ` (${a.unit})` : ""}`} htmlFor={id} error={err(`attributes.${a.key}`)} required={a.isRequired}>
                    {a.type === "SELECT" ? (
                      <Select id={id} value={String(value ?? "")} onChange={(e) => onAttr(e.target.value)}>
                        <option value="">Choisir…</option>
                        {a.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input id={id} inputMode={a.type === "NUMBER" ? "decimal" : "text"} value={String(value ?? "")} onChange={(e) => onAttr(e.target.value)} maxLength={120} />
                    )}
                  </Field>
                );
              })}
            </div>
          ) : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={`Prix (${country.currency})`} htmlFor="price" error={err("price")} required>
              <Input id="price" inputMode="decimal" value={v.price} onChange={(e) => set("price", e.target.value)} placeholder={country.currency === "EUR" ? "ex. 49,90" : "ex. 15000"} aria-invalid={!!err("price")} />
            </Field>
            {props.isBusiness ? (
              <Field label="Quantité disponible" htmlFor="quantity" hint="Vendeurs professionnels uniquement.">
                <Input id="quantity" type="number" min={1} max={10000} value={Number(v.quantity ?? 1)} onChange={(e) => set("quantity", Number(e.target.value))} />
              </Field>
            ) : null}
          </div>
          {priceMinor ? (
            <p className="rounded-lg bg-subtle p-3 text-sm text-muted-foreground">
              Vous recevrez <strong className="text-foreground">{formatMoney(priceMinor, country.currency)}</strong>. Lors d&apos;un achat protégé, l&apos;acheteur paie en plus {formatMoney(fee, country.currency)} de frais de protection ({props.buyerFeeRateBps / 100} %) et la livraison éventuelle.
            </p>
          ) : null}
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="grid gap-5 p-5">
          <Field label="Pays" htmlFor="country" required>
            <Select
              id="country"
              value={v.countryCode}
              onChange={(e) => setV((s) => ({ ...s, countryCode: e.target.value, regionId: "", cityId: null, deliveryMethods: (s.deliveryMethods ?? []).filter((m) => m !== "NATIONAL_SHIPPING" || props.countries.find((c) => c.code === e.target.value)?.nationalShipping) }))}
              disabled={props.mode === "edit"}
            >
              {props.countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.currency})
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={country.regionLabel} htmlFor="region" error={err("regionId")} required>
              <Select id="region" value={v.regionId} onChange={(e) => setV((s) => ({ ...s, regionId: e.target.value, cityId: null }))} aria-invalid={!!err("regionId")}>
                <option value="">Choisir…</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.name}
                  </option>
                ))}
              </Select>
            </Field>
            {cities.length ? (
              <Field label="Ville" htmlFor="city">
                <Select id="city" value={v.cityId ?? ""} onChange={(e) => set("cityId", e.target.value || null)}>
                  <option value="">Autre ville (préciser)</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
          {!v.cityId ? (
            <Field label="Commune / localité" htmlFor="locality" hint="Facultatif. N'indiquez jamais votre adresse précise.">
              <Input id="locality" value={v.locality ?? ""} onChange={(e) => set("locality", e.target.value)} maxLength={120} />
            </Field>
          ) : null}
          {props.mode === "edit" ? <p className="text-xs text-muted-foreground">Le pays (et donc la devise) d&apos;une annonce existante ne peut pas être modifié.</p> : null}
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className="grid gap-5 p-5">
          <fieldset className="grid gap-3">
            <legend className="mb-1 text-sm font-medium">Modes de remise proposés *</legend>
            {DELIVERY_METHODS.map((m) => {
              const disabled = (m === "NATIONAL_SHIPPING" && !country.nationalShipping) || (m === "TAMURT_TRANSPORT" && !props.transportEnabled);
              const checked = v.deliveryMethods?.includes(m) ?? false;
              return (
                <label key={m} className={cn("flex items-start gap-3 rounded-xl border border-border p-3", disabled && "opacity-60", checked && "border-primary/40 bg-primary-soft/40")}>
                  <Checkbox
                    className="mt-0.5"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => set("deliveryMethods", e.target.checked ? [...(v.deliveryMethods ?? []), m] : (v.deliveryMethods ?? []).filter((x) => x !== m))}
                  />
                  <span className="grid gap-0.5 text-sm">
                    <span className="font-semibold">
                      {t(`delivery.${m}`)} {disabled ? <Badge>{t("common.notAvailable")}</Badge> : null}
                    </span>
                    <span className="text-muted-foreground">{t(`delivery.${m}_hint`)}</span>
                    {m === "NATIONAL_SHIPPING" && !country.nationalShipping ? <span className="text-xs text-muted-foreground">Aucun transporteur national n&apos;est encore intégré dans ce pays.</span> : null}
                  </span>
                </label>
              );
            })}
            {err("deliveryMethods") ? <p className="text-sm font-medium text-destructive">{err("deliveryMethods")}</p> : null}
          </fieldset>
          {(v.deliveryMethods ?? []).some((m) => m !== "HAND_DELIVERY") ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Format du colis" htmlFor="size" error={err("parcelSize")} required>
                <Select id="size" value={v.parcelSize ?? ""} onChange={(e) => set("parcelSize", (e.target.value || null) as ListingInput["parcelSize"])}>
                  <option value="">Choisir…</option>
                  {PARCEL_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {t(`parcelSize.${s}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Poids emballé (grammes)" htmlFor="weight" error={err("weightGrams")} required={v.deliveryMethods?.includes("TAMURT_TRANSPORT")}>
                <Input id="weight" type="number" min={1} max={100000} value={v.weightGrams == null ? "" : Number(v.weightGrams)} onChange={(e) => set("weightGrams", e.target.value ? Number(e.target.value) : null)} />
              </Field>
            </div>
          ) : null}
          {v.deliveryMethods?.includes("TAMURT_TRANSPORT") ? (
            <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
              <Checkbox className="mt-0.5" checked={!!v.acceptsCrossBorder} onChange={(e) => set("acceptsCrossBorder", e.target.checked)} />
              <span>
                <span className="font-semibold">J&apos;accepte un envoi vers {v.countryCode === "FR" ? "l'Algérie" : "la France"}</span>
                <span className="block text-muted-foreground">Uniquement si la marchandise et le trajet sont autorisés. Les achats entre pays ne sont pas encore ouverts : des devis indicatifs peuvent être affichés aux acheteurs.</span>
              </span>
            </label>
          ) : null}
        </Card>
      ) : null}

      {step === 4 ? (
        <Card className="grid gap-5 p-5">
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <div className="aspect-[4/5] overflow-hidden rounded-xl bg-muted">{images[0] ? <img src={images[0].url} alt="" className="size-full object-cover" /> : null}</div>
            <div className="grid content-start gap-2">
              <p className="text-2xl font-bold">{priceMinor ? formatMoney(priceMinor, country.currency) : "—"}</p>
              <p className="text-lg font-semibold">{v.title || "Sans titre"}</p>
              <p className="text-sm text-muted-foreground">
                {[category?.name, v.condition ? t(`conditions.${v.condition}`) : null, v.brandName].filter(Boolean).join(" · ")}
              </p>
              <p className="line-clamp-4 text-sm whitespace-pre-line">{v.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {(v.deliveryMethods ?? []).map((m) => (
                  <Badge key={m} tone="primary">
                    {t(`delivery.${m}`)}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <Alert tone="info" title="Avant de publier">
            Les objets interdits (armes, médicaments, contrefaçons, animaux vivants…) sont refusés ; certaines annonces sont vérifiées par un modérateur avant leur mise en ligne. <a href="/objets-interdits" target="_blank" rel="noreferrer">Consulter la liste</a>.
          </Alert>
        </Card>
      ) : null}

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-card/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
          <Button type="button" variant="ghost" onClick={() => goTo(step - 1)} disabled={step === 0 || pending}>
            <ArrowLeft className="rtl:rotate-180" /> {t("common.previous")}
          </Button>
          <div className="flex gap-2">
            {!alreadyPublished ? (
              <Button type="button" variant="outline" onClick={() => submit(false)} loading={pending} disabled={uploading > 0}>
                {t("sell.saveDraft")}
              </Button>
            ) : null}
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={() => goTo(step + 1)} disabled={uploading > 0}>
                {t("common.next")} <ArrowRight className="rtl:rotate-180" />
              </Button>
            ) : (
              <Button type="button" onClick={() => submit(true)} loading={pending} disabled={uploading > 0}>
                <Check /> {alreadyPublished ? t("sell.saveChanges") : category?.requiresReview ? t("sell.submitForReview") : t("sell.publish")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
