import { getCurrentUser } from "@/server/auth/session";
import { getImageForViewer } from "@/server/services/listings";
import { getObject } from "@/server/storage";

/**
 * Photos d'annonces (variantes WebP pré-générées). Publiques et mises en cache (courte durée)
 * durée si l'annonce est visible ; sinon réservées au vendeur et au personnel.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; variant: string }> }) {
  const { id, variant } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id) || (variant !== "thumb" && variant !== "large")) return new Response(null, { status: 404 });
  let access = await getImageForViewer(id, null);
  if (!access) {
    const user = await getCurrentUser();
    access = user ? await getImageForViewer(id, user) : null;
  }
  if (!access) return new Response(null, { status: 404 });
  const bytes = await getObject(variant === "thumb" ? access.image.thumbKey : access.image.largeKey);
  if (!bytes) return new Response(null, { status: 404 });
  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "image/webp",
      "content-length": String(bytes.byteLength),
      // Cache court : une annonce suspendue par la modération doit cesser d'être servie rapidement.
      "cache-control": access.cache === "public" ? "public, max-age=3600, s-maxage=600" : "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
