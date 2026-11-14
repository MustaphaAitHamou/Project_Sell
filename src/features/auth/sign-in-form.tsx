"use client";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { Link, useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "@/lib/safe-next";

export function SignInForm({ next, googleEnabled }: { next?: string; googleEnabled: boolean }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const target = safeNext(next);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    start(async () => {
      const res = await authClient.signIn.email({ email, password, callbackURL: target });
      if (res.error) {
        if (res.error.status === 403 && /verif/i.test(res.error.message ?? "")) {
          setNotice(t("unverified"));
          return;
        }
        setError(res.error.status === 429 ? "Trop de tentatives. Patientez une minute avant de réessayer." : res.error.status === 401 ? t("invalidCredentials") : (res.error.message ?? "Connexion impossible."));
        return;
      }
      // La redirection 2FA éventuelle est gérée par le plugin (onTwoFactorRedirect).
      if ((res.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) return;
      router.push(target);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {notice ? (
        <Alert tone="warning">
          {notice} <Link href={`/verification?email=${encodeURIComponent(email)}`}>Ouvrir la page de vérification</Link>
        </Alert>
      ) : null}
      <Field label={t("email")} htmlFor="email" required>
        <Input id="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label={t("password")} htmlFor="password" required>
        <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <div className="-mt-2 text-end text-sm">
        <Link href="/mot-de-passe-oublie" className="font-medium text-primary-text hover:underline">
          {t("forgot")}
        </Link>
      </div>
      <Button type="submit" size="lg" loading={pending}>
        {t("signInCta")}
      </Button>
      {googleEnabled ? (
        <Button type="button" variant="outline" size="lg" onClick={() => authClient.signIn.social({ provider: "google", callbackURL: `/onboarding?next=${encodeURIComponent(target)}` })}>
          {t("google")}
        </Button>
      ) : null}
    </form>
  );
}
