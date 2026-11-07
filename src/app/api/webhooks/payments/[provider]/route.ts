import { handlePaymentWebhook } from "@/server/services/payments";

export const dynamic = "force-dynamic";

/** Webhooks des prestataires de paiement : corps brut requis pour vérifier la signature. */
export async function POST(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const raw = await request.text();
  if (raw.length > 256_000) return Response.json({ error: "payload_too_large" }, { status: 413 });
  const res = await handlePaymentWebhook(provider, raw, request.headers);
  return Response.json(res.body, { status: res.status, headers: { "cache-control": "no-store" } });
}
