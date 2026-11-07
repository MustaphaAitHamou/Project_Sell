"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { saveAddressAction } from "./actions";

/** Formulaire d'adresse PRIVÉE (communiquée au vendeur seulement après paiement). */
export function AddressForm({
  countries,
  regionsByCountry,
  defaultCountry,
  onSaved,
  initial,
  addressId,
}: {
  countries: { code: string; name: string }[];
  regionsByCountry: Record<string, { id: string; name: string; code: string }[]>;
  defaultCountry: string;
  onSaved?: (id: string) => void;
  initial?: Partial<{ fullName: string; line1: string; line2: string; postalCode: string; city: string; regionId: string; countryCode: string; phone: string; label: string; isDefault: boolean }>;
  addressId?: string;
}) {
  const router = useRouter();
  const [v, setV] = useState({ fullName: "", line1: "", line2: "", postalCode: "", city: "", regionId: "", countryCode: defaultCountry, phone: "", label: "", isDefault: false, ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v, val: string | boolean) => setV((s) => ({ ...s, [k]: val }));
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveAddressAction({ addressId, input: { ...v, regionId: v.regionId || null, line2: v.line2 || null, postalCode: v.postalCode || null, phone: v.phone || null, label: v.label || null } });
          if (!res.ok) {
            setErrors(Object.fromEntries(Object.entries(res.fieldErrors ?? {}).map(([k, m]) => [k.replace(/^input\./, ""), m[0]!])));
            return void toast.error(res.error);
          }
          toast.success("Adresse enregistrée.");
          onSaved?.(res.data.addressId);
          router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom du destinataire" htmlFor="a-name" error={errors.fullName} required>
          <Input id="a-name" autoComplete="name" value={v.fullName} onChange={(e) => set("fullName", e.target.value)} />
        </Field>
        <Field label="Téléphone (pour le livreur)" htmlFor="a-phone" error={errors.phone} hint="Jamais affiché publiquement.">
          <Input id="a-phone" type="tel" autoComplete="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
      </div>
      <Field label="Adresse" htmlFor="a-line1" error={errors.line1} required>
        <Input id="a-line1" autoComplete="address-line1" value={v.line1} onChange={(e) => set("line1", e.target.value)} />
      </Field>
      <Field label="Complément" htmlFor="a-line2">
        <Input id="a-line2" autoComplete="address-line2" value={v.line2} onChange={(e) => set("line2", e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Pays" htmlFor="a-country" required>
          <Select id="a-country" value={v.countryCode} onChange={(e) => setV((s) => ({ ...s, countryCode: e.target.value, regionId: "" }))}>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Code postal" htmlFor="a-postal" error={errors.postalCode}>
          <Input id="a-postal" autoComplete="postal-code" value={v.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
        </Field>
        <Field label="Ville" htmlFor="a-city" error={errors.city} required>
          <Input id="a-city" autoComplete="address-level2" value={v.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
      </div>
      <Field label="Département / wilaya" htmlFor="a-region">
        <Select id="a-region" value={v.regionId} onChange={(e) => set("regionId", e.target.value)}>
          <option value="">—</option>
          {(regionsByCountry[v.countryCode] ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.code} — {r.name}
            </option>
          ))}
        </Select>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={v.isDefault} onChange={(e) => set("isDefault", e.target.checked)} /> Adresse par défaut
      </label>
      <Button type="submit" loading={pending}>
        Enregistrer l&apos;adresse
      </Button>
    </form>
  );
}
