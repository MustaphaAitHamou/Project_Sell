import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/features/auth/auth-card";
import { ForgotPasswordForm } from "@/features/auth/password-forms";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = { title: "Mot de passe oublié", robots: { index: false } };

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <AuthCard title={t("forgotTitle")} subtitle={t("forgotSubtitle")} footer={<Link href="/connexion" className="font-semibold text-primary-text hover:underline">{t("signInCta")}</Link>}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
