import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Providers } from "@/components/providers";
import { isRtl, routing } from "@/i18n/routing";
import { env } from "@/lib/env";

// Montserrat, la police de Tamurt Market : franche et commerçante, celle des enseignes et des étiquettes de prix.
// Elle couvre aussi les lettres kabyles (ɛ, ɣ, ḍ…).
const body = Montserrat({ subsets: ["latin", "latin-ext"], variable: "--font-body", display: "swap" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#141312" },
  ],
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: requested } = await params;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(env.APP_URL),
    title: { default: t("title"), template: `%s · ${t("shortTitle")}` },
    description: t("description"),
    applicationName: "Tamurt Market",
    openGraph: { type: "website", siteName: "Tamurt Market", title: t("title"), description: t("description"), locale: "fr_FR" },
    twitter: { card: "summary_large_image" },
    formatDetection: { telephone: false, address: false, email: false },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const dir = isRtl(locale) ? "rtl" : "ltr";
  return (
    <html lang={locale} dir={dir} className={body.variable} suppressHydrationWarning>
      <body className="min-h-dvh font-sans">
        <NextIntlClientProvider>
          <Providers nonce={nonce} dir={dir}>
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
