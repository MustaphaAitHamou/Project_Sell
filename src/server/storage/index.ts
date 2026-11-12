import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

/**
 * Stockage objet : disque local (développement) ou S3 compatible (production :
 * AWS S3, Cloudflare R2, Supabase Storage, Scaleway…). Aucun fichier n'est servi
 * directement par le stockage : l'accès passe par une route applicative qui vérifie
 * les droits (photos d'annonces visibles, pièces jointes réservées aux parties).
 */
export type StoragePrefix = "listings" | "avatars" | "messages" | "disputes" | "labels";

let s3: S3Client | null = null;
function client() {
  s3 ??= new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: !!env.S3_ENDPOINT,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
  });
  return s3;
}

function localPath(key: string) {
  const root = path.resolve(env.STORAGE_LOCAL_DIR);
  const p = path.resolve(root, key);
  // Protection contre la traversée de répertoires.
  if (!p.startsWith(root + path.sep)) throw new Error("Clé de stockage invalide");
  return p;
}

const KEY_RE = /^(listings|avatars|messages|disputes|labels)\/[0-9]{4}\/[0-9]{2}\/[0-9a-f-]{36}(?:-[a-z]+)?\.(webp|jpg|png|pdf)$/;
export function isValidStorageKey(key: string) {
  return KEY_RE.test(key);
}

export function newStorageKey(prefix: StoragePrefix, id: string, ext: "webp" | "jpg" | "png" | "pdf", variant?: string) {
  const d = new Date();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${prefix}/${d.getUTCFullYear()}/${month}/${id}${variant ? `-${variant}` : ""}.${ext}`;
}

export async function putObject(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
  if (!isValidStorageKey(key)) throw new Error("Clé de stockage invalide");
  if (env.STORAGE_DRIVER === "s3") {
    await client().send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: bytes, ContentType: contentType }));
    return;
  }
  const p = localPath(key);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, bytes);
}

export async function getObject(key: string): Promise<Uint8Array | null> {
  if (!isValidStorageKey(key)) return null;
  try {
    if (env.STORAGE_DRIVER === "s3") {
      const res = await client().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      return res.Body ? await res.Body.transformToByteArray() : null;
    }
    return new Uint8Array(await readFile(localPath(key)));
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  if (!isValidStorageKey(key)) return;
  if (env.STORAGE_DRIVER === "s3") await client().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  else await rm(localPath(key), { force: true });
}

export const CONTENT_TYPES: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", png: "image/png", pdf: "application/pdf" };
export function contentTypeForKey(key: string) {
  return CONTENT_TYPES[key.split(".").pop() ?? ""] ?? "application/octet-stream";
}
