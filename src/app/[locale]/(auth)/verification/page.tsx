import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/misc";
import { AuthCard } from "@/features/auth/auth-card";
import { ResendVerification } from "@/features/auth/password-forms";
import { Link } from "@/i18n/navigation";
import { devToolsEnabled, env } from "@/lib/env";

export const metadata: Metadata = { title: "Vérification de l'adresse email", robots: { index: false } };

export default async function VerificationPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email = "" } = await searchParams;
  const t = await getTranslations("auth");
  return (
    <AuthCard title={t("verifyTitle")}>
      <div className="grid justify-items-center gap-4 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-primary-soft text-primary-soft-foreground">
          <MailCheck className="size-7" aria-hidden />
        </span>
        <p className="text-sm text-muted-foreground">{t("verifyText", { email: email || "votre adresse" })}</p>
      </div>
      {devToolsEnabled && env.EMAIL_PROVIDER === "outbox" ? (
        <Alert tone="warning">
          {t("verifyDev")} <Link href={`/dev/boite-mail${email ? `?to=${encodeURIComponent(email)}` : ""}`}>{t("openMailbox")}</Link>
        </Alert>
      ) : null}
      <ResendVerification email={email} />
    </AuthCard>
  );
}
