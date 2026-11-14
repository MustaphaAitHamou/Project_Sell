import Image from "next/image";
import { env } from "@/lib/env";

/**
 * Le bouton yaz : le carré rouge au yaz blanc, en haut à droite de chaque app Tamurt.
 * Il ramène à Tamurt Services, qui présente toute la famille d'applications.
 * Affiché seulement quand TAMURT_SERVICES_URL est renseignée : jamais de lien mort.
 */
export function TamurtYaz() {
  const href = env.TAMURT_SERVICES_URL;
  if (!href) return null;
  return (
    <a
      href={href}
      title="Tamurt Services"
      aria-label="Tamurt Services, toutes les applications"
      className="group grid size-11 shrink-0 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Image src="/brand/tamurt-yaz.svg" alt="" width={34} height={34} unoptimized className="size-[34px] transition-transform duration-200 group-hover:scale-[1.08] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
    </a>
  );
}
