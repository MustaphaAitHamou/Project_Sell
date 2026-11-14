"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";
import { completeOnboardingAction } from "./actions";
import { LocationFields, type RegionOption } from "./location-fields";

export function OnboardingForm({
  initial,
  needsTerms,
  next,
  countries,
  regionsByCountry,
}: {
  initial: { displayName: string; handle: string; countryCode: string; regionId: string; cityName: string };
  needsTerms: boolean;
  next: string;
  countries: { code: string; name: string; regionLabel: string }[];
  regionsByCountry: Record<string, RegionOption[]>;
}) {
  const [v, setV] = useState({ ...initial, acceptTerms: false });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await completeOnboardingAction({ displayName: v.displayName, handle: v.handle, countryCode: v.countryCode, regionId: v.regionId, cityName: v.cityName || null, acceptTerms: v.acceptTerms });
          if (!res.ok) {
            setError(res.error);
            setErrors(Object.fromEntries(Object.entries(res.fieldErrors ?? {}).map(([k, m]) => [k, m[0]])));
            return;
          }
          window.location.href = next;
        });
      }}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Field label="Pseudonyme public" htmlFor="ob-name" hint="Affiché sur vos annonces. N'indiquez ni nom complet ni coordonnées." error={errors.displayName} required>
        <Input id="ob-name" value={v.displayName} onChange={(e) => setV({ ...v, displayName: e.target.value })} maxLength={40} />
      </Field>
      <Field label="Adresse de votre profil" htmlFor="ob-handle" hint={`tamurt.market/vendeur/${v.handle || "…"} — lettres minuscules, chiffres et tirets.`} error={errors.handle} required>
        <Input id="ob-handle" value={v.handle} onChange={(e) => setV({ ...v, handle: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} maxLength={40} />
      </Field>
      <LocationFields countries={countries} regionsByCountry={regionsByCountry} value={v} onChange={(loc) => setV({ ...v, ...loc })} errors={errors} />
      {needsTerms ? (
        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox className="mt-0.5" checked={v.acceptTerms} onChange={(e) => setV({ ...v, acceptTerms: e.target.checked })} />
          <span>
            J&apos;accepte les{" "}
            <Link href="/conditions" className="font-medium text-primary-text underline" target="_blank">
              conditions générales
            </Link>{" "}
            et la{" "}
            <Link href="/confidentialite" className="font-medium text-primary-text underline" target="_blank">
              politique de confidentialité
            </Link>
            .
          </span>
        </label>
      ) : null}
      <Button type="submit" size="lg" loading={pending}>
        Terminer
      </Button>
    </form>
  );
}
