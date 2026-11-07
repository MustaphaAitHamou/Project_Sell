import "server-only";

/**
 * Journalisation structurée (JSON sur stdout, collectée par l'hébergeur).
 * Les clés sensibles sont masquées avant écriture ; aucun contenu de message,
 * adresse ou coordonnée n'est journalisé.
 */
const SENSITIVE = /pass|secret|token|otp|code|authorization|cookie|phone|iban|address|email|body|signature/i;
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;
const threshold = LEVELS[(process.env.LOG_LEVEL as Level) ?? "info"] ?? LEVELS.info;

function redact(v: unknown, depth = 0): unknown {
  if (depth > 4 || v == null || typeof v !== "object") return v;
  if (v instanceof Error) return { name: v.name, message: v.message };
  if (Array.isArray(v)) return v.slice(0, 50).map((x) => redact(x, depth + 1));
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, SENSITIVE.test(k) ? "[masqué]" : redact(x, depth + 1)]));
}

function write(level: Level, event: string, data?: Record<string, unknown>) {
  if (LEVELS[level] < threshold) return;
  if (process.env.VITEST && level !== "error") return;
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), service: "tamurt-market", ...(redact(data) as object) });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (e: string, d?: Record<string, unknown>) => write("debug", e, d),
  info: (e: string, d?: Record<string, unknown>) => write("info", e, d),
  warn: (e: string, d?: Record<string, unknown>) => write("warn", e, d),
  error: (e: string, d?: Record<string, unknown>) => write("error", e, d),
};
