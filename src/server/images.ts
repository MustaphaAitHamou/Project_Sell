import "server-only";
import sharp from "sharp";
import { invalid } from "@/server/security/errors";

/**
 * Traitement des images envoyées par les utilisateurs. Le type réel est détecté par
 * signature binaire (l'extension et le Content-Type ne sont pas fiables), puis l'image
 * est entièrement ré-encodée en WebP : métadonnées EXIF/GPS supprimées, fichiers
 * polyglottes neutralisés, dimensions bornées (protection contre les « bombes »
 * de décompression).
 */
export const IMAGE_MAX_BYTES = 12 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"] as const;

export function sniffImageMime(b: Uint8Array): (typeof ACCEPTED)[number] | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a)
    return "image/png";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export function sniffPdf(b: Uint8Array): boolean {
  return b.length >= 5 && String.fromCharCode(...b.slice(0, 5)) === "%PDF-";
}

export interface ProcessedImage {
  large: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
  sizeBytes: number;
  blurDataUrl: string;
}

export async function assertImage(bytes: Uint8Array) {
  if (bytes.byteLength === 0) throw invalid("Fichier vide.");
  if (bytes.byteLength > IMAGE_MAX_BYTES) throw invalid("Image trop volumineuse (12 Mo maximum).");
  if (!sniffImageMime(bytes)) throw invalid("Format non accepté. Formats autorisés : JPEG, PNG, WebP.");
}

export async function processImage(bytes: Uint8Array, opts: { largeMax?: number; thumbMax?: number } = {}): Promise<ProcessedImage> {
  await assertImage(bytes);
  const largeMax = opts.largeMax ?? 1600;
  const thumbMax = opts.thumbMax ?? 640;
  try {
    const source = sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).rotate();
    const meta = await source.metadata();
    if (!meta.width || !meta.height || meta.width < 200 || meta.height < 200) throw invalid("Image trop petite (200 × 200 pixels minimum).");
    const large = await source.clone().resize({ width: largeMax, height: largeMax, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    const thumb = await source.clone().resize({ width: thumbMax, height: thumbMax, fit: "inside", withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
    const blur = await source.clone().resize({ width: 16, height: 16, fit: "inside" }).webp({ quality: 40 }).toBuffer();
    return {
      large: large.data,
      thumb,
      width: large.info.width,
      height: large.info.height,
      sizeBytes: large.data.byteLength + thumb.byteLength,
      blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
    };
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "VALIDATION") throw e;
    if (e instanceof Error && e.name === "AppError") throw e;
    throw invalid("Image illisible ou corrompue.");
  }
}
