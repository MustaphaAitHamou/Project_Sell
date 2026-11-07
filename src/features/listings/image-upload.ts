"use client";

/**
 * Compression côté navigateur avant envoi (mobile : économie de données et de temps).
 * Le serveur ré-encode de toute façon chaque image : ceci n'est qu'une optimisation.
 */
export async function compressImage(file: File, maxSide = 2000, quality = 0.85): Promise<Blob> {
  if (!/^image\//.test(file.type) || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024 && file.type !== "image/png") return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  }
}

export type UploadedImage = { id: string; url: string; blurDataUrl: string | null };

export async function uploadListingImage(file: File): Promise<UploadedImage> {
  const blob = await compressImage(file);
  const body = new FormData();
  body.append("file", blob, file.name.replace(/\.[^.]+$/, "") + ".jpg");
  const res = await fetch("/api/uploads/listing-image", { method: "POST", body });
  const json = (await res.json().catch(() => ({}))) as { id?: string; url?: string; blurDataUrl?: string | null; error?: string };
  if (!res.ok || !json.id || !json.url) throw new Error(json.error ?? "Envoi impossible.");
  return { id: json.id, url: json.url, blurDataUrl: json.blurDataUrl ?? null };
}
