"use client";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { signUpSchema } from "./schemas";

export function SignUpForm({ googleEnabled }: { googleEnabled: boolean }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [values, setValues] = useState({ name: "", email: "", password: "", acceptTerms: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof values, v: string | boolean) => setValues((s) => ({ ...s, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = signUpSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    start(async () => {
      const res = await authClient.signUp.email({
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
        // Contrôlé côté serveur (hook Better Auth) : l'inscription est refusée sans acceptation.
        ...({ acceptTerms: true } as object),
        callbackURL: "/onboarding",
      } as Parameters<typeof authClient.signUp.email>[0]);
      if (res.error) {
        setError(res.error.status === 422 || /exist/i.test(res.error.message ?? "") ? "Un compte existe déjà avec cette adresse email." : res.error.status === 429 ? "Trop de tentatives. Réessayez plus tard." : (res.error.message ?? "Inscription impossible."));
        return;
      }
      router.push(`/verification?email=${encodeURIComponent(parsed.data.email)}`);
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Field label={t("displayName")} htmlFor="name" hint={t("displayNameHint")} error={errors.name} required>
        <Input id="name" autoComplete="nickname" value={values.name} onChange={(e) => set("name", e.target.value)} maxLength={40} aria-invalid={!!errors.name} />
      </Field>
      <Field label={t("email")} htmlFor="email" error={errors.email} required>
        <Input id="email" type="email" autoComplete="email" inputMode="email" value={values.email} onChange={(e) => set("email", e.target.value)} aria-invalid={!!errors.email} />
      </Field>
      <Field label={t("password")} htmlFor="password" hint={t("passwordHint")} error={errors.password} required>
        <Input id="password" type="password" autoComplete="new-password" value={values.password} onChange={(e) => set("password", e.target.value)} aria-invalid={!!errors.password} />
      </Field>
      <div className="grid gap-1">
        <label className="flex items-start gap-2.5 text-sm">
          <Checkbox className="mt-0.5" checked={values.acceptTerms} onChange={(e) => set("acceptTerms", e.target.checked)} aria-invalid={!!errors.acceptTerms} />
          <span>
            {t.rich("acceptTerms", {
              terms: (chunks) => (
                <Link href="/conditions" className="font-medium text-primary-text underline" target="_blank">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/confidentialite" className="font-medium text-primary-text underline" target="_blank">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
        {errors.acceptTerms ? <p className="text-xs font-medium text-destructive">{errors.acceptTerms}</p> : null}
      </div>
      <Button type="submit" size="lg" loading={pending}>
        {t("signUpCta")}
      </Button>
      {googleEnabled ? (
        <Button type="button" variant="outline" size="lg" onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/onboarding" })}>
          {t("google")}
        </Button>
      ) : null}
    </form>
  );
}
