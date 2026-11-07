import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins/two-factor";
import { signUpServerSchema } from "@/features/auth/schemas";
import { env, isE2E, isProduction } from "@/lib/env";
import { db } from "@/server/db/client";
import { enqueue } from "@/server/jobs/queue";
import { createInitialProfile } from "./profile";

const rateLimitRelaxed = process.env.RATE_LIMIT_RELAXED === "true" && (!isProduction || isE2E);

export const auth = betterAuth({
  appName: "Tamurt Market",
  baseURL: env.BETTER_AUTH_URL ?? env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  trustedOrigins: [
    env.APP_URL,
    ...(process.env.VERCEL_ENV === "preview"
      ? [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL].filter(Boolean).map((h) => `https://${h}`)
      : []),
  ],
  user: {
    // Aucun champ applicatif n'est modifiable via l'API d'authentification : statut,
    // rôles et dates d'acceptation sont posés côté serveur uniquement.
    additionalFields: {
      status: { type: "string", required: false, input: false, defaultValue: "ACTIVE" },
      locale: { type: "string", required: false, input: false, defaultValue: "fr" },
      termsAcceptedAt: { type: "date", required: false, input: false },
      onboardedAt: { type: "date", required: false, input: false },
    },
    changeEmail: { enabled: false },
    deleteUser: { enabled: false },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 3600,
    sendResetPassword: async ({ user, url }) => {
      await enqueue(db, "email.send", { to: user.email, template: "resetPassword", data: { name: user.name, url } });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 24 * 3600,
    sendVerificationEmail: async ({ user, url }) => {
      await enqueue(db, "email.send", { to: user.email, template: "verifyEmail", data: { name: user.name, url } });
    },
    afterEmailVerification: async (user) => {
      await db.userVerification.upsert({
        where: { userId_type: { userId: user.id, type: "EMAIL" } },
        create: { userId: user.id, type: "EMAIL", status: "VERIFIED", provider: "email", verifiedAt: new Date() },
        update: { status: "VERIFIED", verifiedAt: new Date() },
      });
    },
  },
  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : undefined,
  session: {
    expiresIn: 30 * 24 * 3600,
    updateAge: 24 * 3600,
    // Le statut et les rôles sont relus en base à chaque requête : pas de cache de session.
    cookieCache: { enabled: false },
  },
  rateLimit: {
    enabled: !rateLimitRelaxed,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 8 },
      "/sign-up/email": { window: 3600, max: 10 },
      "/request-password-reset": { window: 3600, max: 5 },
      "/send-verification-email": { window: 3600, max: 5 },
      "/two-factor/verify-totp": { window: 60, max: 5 },
      "/two-factor/verify-backup-code": { window: 60, max: 5 },
    },
  },
  advanced: {
    cookiePrefix: "tamurt-market",
    useSecureCookies: isProduction && !isE2E,
    defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: isProduction && !isE2E },
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
    database: { generateId: () => crypto.randomUUID() },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          if (ctx?.path === "/sign-up/email") {
            const parsed = signUpServerSchema.safeParse(ctx.body);
            if (!parsed.success) throw new APIError("BAD_REQUEST", { message: parsed.error.issues[0]?.message ?? "Données invalides" });
            return { data: { ...user, name: parsed.data.name, termsAcceptedAt: new Date(), status: "ACTIVE" } };
          }
          // Connexion Google : conditions à accepter lors de l'onboarding.
          return { data: { ...user, status: "ACTIVE" } };
        },
        after: async (user) => {
          await createInitialProfile(user.id, user.name);
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const u = await db.user.findUnique({ where: { id: session.userId }, select: { status: true } });
          if (!u || u.status !== "ACTIVE") throw new APIError("FORBIDDEN", { message: "Ce compte n'est pas actif. Contactez le support." });
        },
      },
    },
  },
  plugins: [twoFactor({ issuer: "Tamurt Market" }), nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
