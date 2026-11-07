import { getCurrentUser } from "@/server/auth/session";
import { AppError } from "@/server/security/errors";
import { uploadListingImage } from "@/server/services/listings";
import { imageUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Envoi d'une photo d'annonce (multipart). L'origine est contrôlée (CSRF), l'utilisateur
 * authentifié, le type détecté par signature binaire et l'image ré-encodée côté serveur.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return Response.json({ error: "Origine refusée." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user || !user.onboarded) return Response.json({ error: "Connectez-vous pour continuer." }, { status: 401 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 13 * 1024 * 1024) return Response.json({ error: "Fichier trop volumineux (12 Mo maximum)." }, { status: 413 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Aucun fichier reçu." }, { status: 400 });
    const image = await uploadListingImage(user, new Uint8Array(await file.arrayBuffer()));
    return Response.json({ id: image.id, width: image.width, height: image.height, blurDataUrl: image.blurDataUrl, url: imageUrl(image.id, "thumb") }, { status: 201 });
  } catch (e) {
    if (e instanceof AppError) return Response.json({ error: e.message }, { status: e.httpStatus });
    return Response.json({ error: "Image illisible ou corrompue." }, { status: 400 });
  }
}
