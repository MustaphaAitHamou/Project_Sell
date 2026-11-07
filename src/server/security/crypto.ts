import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacHex(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Code numérique à 6 chiffres, uniforme (randomInt sans biais de modulo). */
export function randomNumericCode(digits = 6): string {
  return String(randomInt(0, 10 ** digits)).padStart(digits, "0");
}

/** Empreinte d'un code à usage unique, liée à son contexte (une empreinte ne vaut que pour une commande). */
export function hashScopedCode(scope: string, code: string): string {
  return hmacHex(env.CODE_PEPPER, `${scope}:${code}`);
}

/** Empreinte d'une adresse IP pour l'audit et la limitation de débit (jamais l'IP en clair). */
export function hashIp(ip: string): string {
  return hmacHex(env.BETTER_AUTH_SECRET, `ip:${ip}`).slice(0, 32);
}

/**
 * Signature de webhook au format « t=<timestamp>,v1=<hex> » (HMAC-SHA256 de `${t}.${payload}`),
 * tolérance temporelle bornée contre le rejeu.
 */
export function signWebhook(secret: string, payload: string, timestamp = Math.floor(Date.now() / 1000)): string {
  return `t=${timestamp},v1=${hmacHex(secret, `${timestamp}.${payload}`)}`;
}

export function verifyWebhookSignature(
  secret: string,
  payload: string,
  header: string | null,
  toleranceSeconds = 300,
  now = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isInteger(t) || !v1 || !/^[0-9a-f]{64}$/.test(v1)) return false;
  if (Math.abs(now - t) > toleranceSeconds) return false;
  return safeEqual(hmacHex(secret, `${t}.${payload}`), v1);
}
