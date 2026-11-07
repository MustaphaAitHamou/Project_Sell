import { z } from "zod";

/**
 * Variables d'environnement validées au démarrage. Une variable absente ou invalide
 * fait échouer le serveur avec un message explicite plutôt qu'un comportement
 * silencieusement dégradé. Aucun secret n'a de valeur par défaut exploitable en production.
 */
const bool = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.url(),
    APP_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET doit contenir au moins 32 caractères"),
    BETTER_AUTH_URL: z.url().optional(),
    CRON_SECRET: z.string().min(16),
    /** Poivre HMAC des codes de remise en main propre et jetons à usage unique. */
    CODE_PEPPER: z.string().min(16),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    EMAIL_PROVIDER: z.enum(["outbox", "resend"]).default("outbox"),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().default("Tamurt Market <no-reply@localhost>"),

    /**
     * Prestataire de paiement actif.
     * - sandbox : simulateur local (développement et tests uniquement, refusé en production)
     * - none : achat intégré désactivé (mode petites annonces), valeur attendue en production
     *   tant qu'aucun prestataire agréé n'est contractualisé et intégré.
     */
    PAYMENT_PROVIDER: z.enum(["sandbox", "none"]).default("none"),
    PAYMENT_SANDBOX_WEBHOOK_SECRET: z.string().min(16).optional(),

    /** Transporteur national : simulateur local ou aucun. */
    SHIPPING_PROVIDER: z.enum(["sandbox", "none"]).default("none"),
    SHIPPING_SANDBOX_WEBHOOK_SECRET: z.string().min(16).optional(),

    /**
     * Intégration Tamurt Transport.
     * - disabled : aucune requête vers Transport
     * - simulator : simulateur local conforme au contrat v1 (développement et tests)
     * - remote : API réelle de Tamurt Transport (non disponible à ce jour)
     */
    TRANSPORT_INTEGRATION: z.enum(["disabled", "simulator", "remote"]).default("disabled"),
    TRANSPORT_API_BASE_URL: z.url().optional(),
    TRANSPORT_CLIENT_ID: z.string().optional(),
    TRANSPORT_CLIENT_SECRET: z.string().optional(),
    TRANSPORT_WEBHOOK_SECRET: z.string().min(16).optional(),
    TRANSPORT_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(4_000),

    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    STORAGE_LOCAL_DIR: z.string().default("./storage"),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default("auto"),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),

    ADMIN_REQUIRE_2FA: bool,
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
    SENTRY_DSN: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const req = (cond: boolean, keys: string[], why: string) => {
      if (!cond) return;
      for (const k of keys)
        if (!(v as Record<string, unknown>)[k])
          ctx.addIssue({ code: "custom", path: [k], message: `${k} requis (${why})` });
    };
    req(v.EMAIL_PROVIDER === "resend", ["RESEND_API_KEY"], "EMAIL_PROVIDER=resend");
    req(v.PAYMENT_PROVIDER === "sandbox", ["PAYMENT_SANDBOX_WEBHOOK_SECRET"], "PAYMENT_PROVIDER=sandbox");
    req(v.SHIPPING_PROVIDER === "sandbox", ["SHIPPING_SANDBOX_WEBHOOK_SECRET"], "SHIPPING_PROVIDER=sandbox");
    req(v.STORAGE_DRIVER === "s3", ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"], "STORAGE_DRIVER=s3");
    req(v.TRANSPORT_INTEGRATION !== "disabled", ["TRANSPORT_WEBHOOK_SECRET"], "intégration Transport active");
    req(
      v.TRANSPORT_INTEGRATION === "remote",
      ["TRANSPORT_API_BASE_URL", "TRANSPORT_CLIENT_ID", "TRANSPORT_CLIENT_SECRET"],
      "TRANSPORT_INTEGRATION=remote",
    );

    // Les simulateurs sont interdits en production réelle. Vérifié au démarrage du serveur,
    // pas pendant `next build` (le build ne reçoit pas forcément les secrets d'exécution).
    const realProduction =
      v.NODE_ENV === "production" &&
      process.env.E2E_TEST_MODE !== "true" &&
      process.env.NEXT_PHASE !== "phase-production-build";
    if (realProduction) {
      const refuse = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
      if (v.PAYMENT_PROVIDER === "sandbox") refuse("PAYMENT_PROVIDER", "Le simulateur de paiement est interdit en production");
      if (v.SHIPPING_PROVIDER === "sandbox") refuse("SHIPPING_PROVIDER", "Le simulateur de livraison est interdit en production");
      if (v.TRANSPORT_INTEGRATION === "simulator")
        refuse("TRANSPORT_INTEGRATION", "Le simulateur Tamurt Transport est interdit en production");
      if (v.EMAIL_PROVIDER === "outbox" && process.env.ALLOW_OUTBOX_EMAIL_IN_PRODUCTION !== "true")
        refuse("EMAIL_PROVIDER", "Configurez un fournisseur d'emails transactionnels en production");
      if (v.STORAGE_DRIVER === "local" && process.env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION !== "true")
        refuse("STORAGE_DRIVER", "Le stockage local n'est pas adapté à la production (utilisez S3)");
      if (process.env.ADMIN_REQUIRE_2FA === "false")
        refuse("ADMIN_REQUIRE_2FA", "La double authentification administrateur ne peut pas être désactivée en production");
    }
  });

export type Env = z.output<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuration invalide :\n${msg}`);
  }
  return parsed.data;
}

export const env = load();
export const isProduction = env.NODE_ENV === "production";
/** Vrai sur un build de production lancé pour les tests de bout en bout (simulateurs autorisés). */
export const isE2E = process.env.E2E_TEST_MODE === "true";
/** Outils de développement (boîte mail locale, simulateurs) accessibles. */
export const devToolsEnabled = !isProduction || isE2E;
/** La double authentification est exigée pour l'administration (toujours en production). */
export const adminRequires2fa = isProduction && !isE2E ? true : (process.env.ADMIN_REQUIRE_2FA ?? "true") !== "false";
/** Un simulateur est actif : l'interface l'affiche explicitement. */
export const usesSimulators =
  env.PAYMENT_PROVIDER === "sandbox" || env.SHIPPING_PROVIDER === "sandbox" || env.TRANSPORT_INTEGRATION === "simulator";
