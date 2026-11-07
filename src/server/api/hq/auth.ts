import "server-only";
import { db } from "@/server/db/client";
import { sha256Hex } from "@/server/security/crypto";
import { checkRateLimit } from "@/server/security/rate-limit";
import { ipFromRequest } from "@/server/security/request";

export type ServiceAuthResult = { ok: true; clientId: string; name: string } | { ok: false; status: 401 | 403 | 429; code: string; message: string };

/**
 * Authentification des services internes (Tamurt HQ) : jeton porteur « tmhq_… » dont seule
 * l'empreinte SHA-256 est stockée, portée requise, liste d'adresses IP facultative
 * (l'hébergeur doit garantir l'en-tête x-forwarded-for), limitation de débit par client.
 */
export async function authenticateServiceClient(request: Request, scope: "metrics:read"): Promise<ServiceAuthResult> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!/^tmhq_[A-Za-z0-9_-]{20,}$/.test(token)) return { ok: false, status: 401, code: "UNAUTHENTICATED", message: "Jeton de service manquant ou invalide." };
  const client = await db.serviceApiClient.findUnique({ where: { tokenHash: sha256Hex(token) } });
  if (!client || client.revokedAt) return { ok: false, status: 401, code: "UNAUTHENTICATED", message: "Jeton de service manquant ou invalide." };
  if (!client.scopes.includes(scope)) return { ok: false, status: 403, code: "FORBIDDEN", message: "Portée insuffisante." };
  if (client.allowedIps.length && !client.allowedIps.includes(ipFromRequest(request))) return { ok: false, status: 403, code: "FORBIDDEN", message: "Adresse IP non autorisée pour ce jeton." };
  if (!(await checkRateLimit(`hq:${client.id}`, 60, 60))) return { ok: false, status: 429, code: "RATE_LIMITED", message: "Trop de requêtes." };
  if (!client.lastUsedAt || Date.now() - client.lastUsedAt.getTime() > 300_000) await db.serviceApiClient.update({ where: { id: client.id }, data: { lastUsedAt: new Date() } });
  return { ok: true, clientId: client.id, name: client.name };
}
