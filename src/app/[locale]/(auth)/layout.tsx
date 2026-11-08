import { Logo } from "@/components/brand/logo";
import { EnvironmentBanner } from "@/components/layout/environment-banner";
import { Link } from "@/i18n/navigation";
import { usesSimulators } from "@/lib/env";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(900px_420px_at_50%_-10%,var(--primary-soft),transparent_70%)]">
      {usesSimulators ? <EnvironmentBanner /> : null}
      <header className="container-page flex h-16 items-center">
        <Link href="/" aria-label="Tamurt Market, accueil">
          <Logo />
        </Link>
      </header>
      <main id="contenu" className="container-page flex flex-1 items-start justify-center py-6 sm:py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
