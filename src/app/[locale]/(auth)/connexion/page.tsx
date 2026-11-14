import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/features/auth/auth-card";
import { SignInForm } from "@/features/auth/sign-in-form";
import { Link, redirect } from "@/i18n/navigation";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect({ href: safeNext(next), locale: "fr" });
  const t = await getTranslations("auth");
  return (
    <AuthCard
      title={t("signInTitle")}
      subtitle={t("signInSubtitle")}
      footer={
        <>
          {t("noAccount")}{" "}
          <Link href="/inscription" className="font-semibold text-primary-text hover:underline">
            {t("signUpCta")}
          </Link>
        </>
      }
    >
      <SignInForm next={next} googleEnabled={!!env.GOOGLE_CLIENT_ID} />
    </AuthCard>
  );
}
