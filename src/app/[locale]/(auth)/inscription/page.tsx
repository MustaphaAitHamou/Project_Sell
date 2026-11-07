import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/features/auth/auth-card";
import { SignUpForm } from "@/features/auth/sign-up-form";
import { Link, redirect } from "@/i18n/navigation";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Créer un compte", robots: { index: false } };

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect({ href: "/compte", locale: "fr" });
  const t = await getTranslations("auth");
  return (
    <AuthCard
      title={t("signUpTitle")}
      subtitle={t("signUpSubtitle")}
      footer={
        <>
          {t("hasAccount")}{" "}
          <Link href="/connexion" className="font-semibold text-primary hover:underline">
            {t("signInCta")}
          </Link>
        </>
      }
    >
      <SignUpForm googleEnabled={!!env.GOOGLE_CLIENT_ID} />
    </AuthCard>
  );
}
