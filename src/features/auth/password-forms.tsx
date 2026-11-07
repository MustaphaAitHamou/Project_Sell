"use client";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { forgotPasswordSchema, resetPasswordSchema } from "./schemas";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) return <Alert tone="success">{t("forgotSent")}</Alert>;
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = forgotPasswordSchema.safeParse({ email });
        if (!parsed.success) return setError(parsed.error.issues[0]!.message);
        setError(null);
        start(async () => {
          const res = await authClient.requestPasswordReset({ email: parsed.data.email, redirectTo: "/reinitialiser-mot-de-passe" });
          // Réponse identique que le compte existe ou non (pas d'énumération des comptes).
          if (res.error?.status === 429) return setError("Trop de demandes. Réessayez plus tard.");
          setDone(true);
        });
      }}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Field label={t("email")} htmlFor="email" required>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        {t("forgotCta")}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string | null }) {
  const t = useTranslations("auth");
  const [values, setValues] = useState({ password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (!token) return <Alert tone="danger">Lien invalide ou expiré. Refaites une demande de réinitialisation.</Alert>;
  if (done)
    return (
      <Alert tone="success">
        {t("resetDone")} <Link href="/connexion">{t("signInCta")}</Link>
      </Alert>
    );
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = resetPasswordSchema.safeParse(values);
        if (!parsed.success) return setError(parsed.error.issues[0]!.message);
        setError(null);
        start(async () => {
          const res = await authClient.resetPassword({ newPassword: parsed.data.password, token });
          if (res.error) return setError("Lien invalide ou expiré. Refaites une demande de réinitialisation.");
          setDone(true);
        });
      }}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Field label={t("password")} htmlFor="password" hint={t("passwordHint")} required>
        <Input id="password" type="password" autoComplete="new-password" value={values.password} onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))} />
      </Field>
      <Field label={t("confirmPassword")} htmlFor="confirm" required>
        <Input id="confirm" type="password" autoComplete="new-password" value={values.confirm} onChange={(e) => setValues((v) => ({ ...v, confirm: e.target.value }))} />
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        {t("resetCta")}
      </Button>
    </form>
  );
}

export function ResendVerification({ email }: { email: string }) {
  const t = useTranslations("auth");
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        loading={pending}
        disabled={!email || state === "sent"}
        onClick={() =>
          start(async () => {
            const res = await authClient.sendVerificationEmail({ email, callbackURL: "/onboarding" });
            setState(res.error ? "error" : "sent");
          })
        }
      >
        {t("resend")}
      </Button>
      {state === "sent" ? <p className="text-center text-sm text-success">{t("resent")}</p> : null}
      {state === "error" ? <p className="text-center text-sm text-destructive">Envoi impossible pour le moment. Réessayez plus tard.</p> : null}
    </div>
  );
}

export function TwoFactorForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = backup ? await authClient.twoFactor.verifyBackupCode({ code: code.trim() }) : await authClient.twoFactor.verifyTotp({ code: code.trim(), trustDevice: false });
          if (res.error) return setError(res.error.status === 429 ? "Trop de tentatives. Patientez une minute." : "Code invalide.");
          window.location.href = next;
        });
      }}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Field label={backup ? "Code de secours" : t("twoFactorCode")} htmlFor="code" required>
        <Input id="code" inputMode={backup ? "text" : "numeric"} autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={backup ? 20 : 6} />
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        {t("verifyCta")}
      </Button>
      <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setBackup((b) => !b)}>
        {backup ? "Utiliser l'application d'authentification" : t("twoFactorBackup")}
      </button>
    </form>
  );
}
