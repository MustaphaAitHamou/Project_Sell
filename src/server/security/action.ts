import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { logger } from "@/server/logger";
import { AppError } from "./errors";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> };

/**
 * Enveloppe commune des Server Actions : validation Zod du payload (jamais de confiance
 * dans le client), traduction des erreurs métier, journalisation des erreurs inattendues
 * sans fuite d'information vers le navigateur.
 */
export function action<S extends z.ZodType, T>(schema: S, fn: (input: z.output<S>) => Promise<T>) {
  return async (raw: z.input<S>): Promise<ActionResult<T>> => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) (fieldErrors[issue.path.join(".") || "_"] ??= []).push(issue.message);
      return { ok: false, error: "Certains champs sont invalides.", code: "VALIDATION", fieldErrors };
    }
    try {
      return { ok: true, data: await fn(parsed.data) };
    } catch (e) {
      return toActionError(e);
    }
  };
}

export function toActionError(e: unknown): { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> } {
  // Redirections et notFound() de Next.js : à relancer.
  unstable_rethrow(e);
  if (e instanceof AppError) return { ok: false, error: e.message, code: e.code, fieldErrors: e.fieldErrors };
  logger.error("action.unexpected", { error: e });
  return { ok: false, error: "Une erreur inattendue est survenue. Réessayez dans un instant." };
}
