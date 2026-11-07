import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/features/auth/auth-card";
import { TwoFactorForm } from "@/features/auth/password-forms";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Double authentification", robots: { index: false } };

export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const t = await getTranslations("auth");
  return (
    <AuthCard title={t("twoFactorTitle")} subtitle={t("twoFactorText")}>
      <TwoFactorForm next={safeNext(next)} />
    </AuthCard>
  );
}
