/** Erreurs métier : leur message est destiné à l'utilisateur, sans détail interne. */
export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "PRECONDITION";

const HTTP: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UNAVAILABLE: 503,
  PRECONDITION: 412,
};

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
  get httpStatus() {
    return HTTP[this.code];
  }
}

export const unauthenticated = () => new AppError("UNAUTHENTICATED", "Connectez-vous pour continuer.");
export const forbidden = (msg = "Vous n'avez pas accès à cette ressource.") => new AppError("FORBIDDEN", msg);
/** Une ressource d'autrui renvoie « introuvable » plutôt que « interdit » : son existence n'est pas révélée (anti-IDOR). */
export const notFound = (msg = "Élément introuvable.") => new AppError("NOT_FOUND", msg);
export const invalid = (msg: string, fieldErrors?: Record<string, string[]>) => new AppError("VALIDATION", msg, fieldErrors);
export const conflict = (msg: string) => new AppError("CONFLICT", msg);
export const unavailable = (msg: string) => new AppError("UNAVAILABLE", msg);
export const precondition = (msg: string) => new AppError("PRECONDITION", msg);
export const rateLimited = () => new AppError("RATE_LIMITED", "Trop de tentatives. Patientez quelques instants avant de réessayer.");

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
