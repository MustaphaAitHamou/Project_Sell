"use client";
import { Field, Input, Select } from "@/components/ui/input";

export type RegionOption = { id: string; name: string; code: string };

/** Pays → département/wilaya (référentiel en base) → ville libre. */
export function LocationFields({
  countries,
  regionsByCountry,
  value,
  onChange,
  errors = {},
  cityLabel = "Ville",
}: {
  countries: { code: string; name: string; regionLabel: string }[];
  regionsByCountry: Record<string, RegionOption[]>;
  value: { countryCode: string; regionId: string; cityName: string };
  onChange: (v: { countryCode: string; regionId: string; cityName: string }) => void;
  errors?: Record<string, string | undefined>;
  cityLabel?: string;
}) {
  const country = countries.find((c) => c.code === value.countryCode);
  const regions = regionsByCountry[value.countryCode] ?? [];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Pays" htmlFor="loc-country" required error={errors.countryCode}>
        <Select id="loc-country" value={value.countryCode} onChange={(e) => onChange({ countryCode: e.target.value, regionId: "", cityName: "" })}>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={country?.regionLabel ?? "Région"} htmlFor="loc-region" required error={errors.regionId}>
        <Select id="loc-region" value={value.regionId} onChange={(e) => onChange({ ...value, regionId: e.target.value })} aria-invalid={!!errors.regionId}>
          <option value="">Choisir…</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.code} — {r.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={cityLabel} htmlFor="loc-city" error={errors.cityName}>
        <Input id="loc-city" value={value.cityName} onChange={(e) => onChange({ ...value, cityName: e.target.value })} maxLength={120} />
      </Field>
    </div>
  );
}
