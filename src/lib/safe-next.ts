/** Destination de redirection après connexion : chemin interne uniquement (anti open-redirect). */
export function safeNext(next: string | null | undefined, fallback = "/compte"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || /[\r\n]/.test(next)) return fallback;
  if (next.startsWith("/api/")) return fallback;
  return next;
}
