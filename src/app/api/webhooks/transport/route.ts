import { handleTransportWebhook } from "@/server/services/transport-webhooks";

export const dynamic = "force-dynamic";

/** Événements Tamurt Transport (contrat v1, signature HMAC « Tamurt-Signature »). */
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 256_000) return Response.json({ error: "payload_too_large" }, { status: 413 });
  const res = await handleTransportWebhook(raw, request.headers);
  return Response.json(res.body, { status: res.status, headers: { "cache-control": "no-store" } });
}
