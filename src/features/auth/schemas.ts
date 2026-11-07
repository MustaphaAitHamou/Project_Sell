import { z } from "zod";

export const PASSWORD_MIN = 10;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Au moins ${PASSWORD_MIN} caractères.`)
  .max(128, "128 caractères maximum.")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Utilisez au moins une lettre et un chiffre.");

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Au moins 2 caractères.")
  .max(40, "40 caractères maximum.")
  .refine((v) => !/[<>{}\\]/.test(v), "Caractères non autorisés.")
  .refine((v) => !/@|https?:|www\./i.test(v), "Le pseudonyme ne doit contenir ni email ni lien.");

export const signUpSchema = z.object({
  name: displayNameSchema,
  email: z.email("Adresse email invalide.").max(200),
  password: passwordSchema,
  acceptTerms: z.literal(true, { error: "Vous devez accepter les conditions générales." }),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

/** Validation serveur du corps de la requête d'inscription Better Auth. */
export const signUpServerSchema = signUpSchema.pick({ name: true, email: true, acceptTerms: true });

export const signInSchema = z.object({
  email: z.email("Adresse email invalide."),
  password: z.string().min(1, "Mot de passe requis.").max(128),
});

export const forgotPasswordSchema = z.object({ email: z.email("Adresse email invalide.") });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Les mots de passe ne correspondent pas." });
