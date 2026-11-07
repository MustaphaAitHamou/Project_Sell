import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** URL de la photo d'une annonce (variante pré-générée servie par /api/images). */
export function imageUrl(imageId: string, variant: "thumb" | "large" = "thumb") {
  return `/api/images/${imageId}/${variant}`;
}

export function avatarUrl(userId: string, version?: string | null) {
  return `/api/avatars/${userId}${version ? `?v=${encodeURIComponent(version.slice(-12))}` : ""}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
