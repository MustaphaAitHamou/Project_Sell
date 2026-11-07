import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/features/auth/auth-card";
import { OnboardingForm } from "@/features/profile/onboarding-form";
import { redirect } from "@/i18n/navigation";
import { safeNext } from "@/lib/safe-next";
import { getCurrentUser } from "@/server/auth/session";
import { getActiveCountries, getRegions } from "@/server/services/catalog";

export const metadata: Metadata = { title: "Bienvenue", robots: { index: false } };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect({ href: `/connexion?next=${encodeURIComponent("/onboarding")}`, locale: "fr" });
  if (user!.onboarded && user!.termsAccepted) redirect({ href: safeNext(next), locale: "fr" });
  const t = await getTranslations("auth");
  const countries = await getActiveCountries();
  const regionsByCountry = Object.fromEntries(await Promise.all(countries.map(async (c) => [c.code, await getRegions(c.code)] as const)));
  const p = user!.profile;
  return (
    <AuthCard title={t("onboardingTitle")} subtitle={t("onboardingSubtitle")}>
      <OnboardingForm
        initial={{ displayName: p?.displayName ?? user!.name, handle: p?.handle ?? "", countryCode: p?.countryCode ?? "FR", regionId: p?.regionId ?? "", cityName: "" }}
        needsTerms={!user!.termsAccepted}
        next={safeNext(next, "/compte?bienvenue=1")}
        countries={countries.map((c) => ({ code: c.code, name: c.name, regionLabel: c.regionLabel }))}
        regionsByCountry={regionsByCountry}
      />
    </AuthCard>
  );
}
