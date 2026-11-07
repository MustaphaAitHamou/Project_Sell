import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Liens et navigation conscients de la langue (préfixe ajouté automatiquement hors français). */
export const { Link, redirect, usePathname, useRouter, getPathname, permanentRedirect } = createNavigation(routing);
