import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo Tamurt Market (DA Tamurt Services) : le mot TAMURT rouge et sa ligne ⵜⴰⵎⵓⵔⵜ, puis « Market » en miel.
 * Fichiers dans public/brand : une version pour fond clair, une pour fond sombre (bascule avec le thème).
 * `compact` n'affiche que l'icône de l'app.
 */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  if (compact) {
    return <Image src="/icon.svg" alt="Tamurt Market" width={36} height={36} unoptimized className={cn("size-9 shrink-0", className)} />;
  }
  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image src="/brand/wordmark.svg" alt="Tamurt Market" width={139} height={30} unoptimized priority className="h-[30px] w-auto dark:hidden" />
      <Image src="/brand/wordmark-sombre.svg" alt="Tamurt Market" width={139} height={30} unoptimized className="hidden h-[30px] w-auto dark:block" />
    </span>
  );
}
