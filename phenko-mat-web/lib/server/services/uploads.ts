import "server-only";
import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { firebaseEnv, storageEnv } from "../env";
import { badRequest, forbidden } from "../errors";
import { uuidv7 } from "../ids";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const SIGNATURES: { type: string; ext: string; test: (b: Uint8Array) => boolean }[] = [
  { type: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: "image/png",
    ext: "png",
    test: (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v),
  },
  {
    type: "image/webp",
    ext: "webp",
    test: (b) =>
      String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP",
  },
];

const userPrefix = (userId: string) => `u/${userId}/`;

let client: S3Client | undefined;
function r2() {
  const env = storageEnv();
  return (client ??= new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  }));
}

function publicUrlPrefixes(userId: string) {
  const prefixes = [`${storageEnv().R2_PUBLIC_URL}/${userPrefix(userId)}`];
  // Photos uploaded before the move to R2 still point at Firebase Storage.
  const legacyBucket = firebaseEnv().FIREBASE_STORAGE_BUCKET;
  if (legacyBucket) {
    prefixes.push(
      `https://firebasestorage.googleapis.com/v0/b/${legacyBucket}/o/${encodeURIComponent(userPrefix(userId))}`,
    );
  }
  return prefixes;
}

/**
 * Items and avatars may only reference files this user uploaded through our API — no hotlinking
 * arbitrary URLs (tracking pixels, other people's photos).
 */
export function assertOwnUploads(userId: string, urls: string[]) {
  const prefixes = publicUrlPrefixes(userId);
  if (!urls.every((u) => prefixes.some((p) => u.startsWith(p)) && !u.includes(".."))) {
    throw forbidden("Photos must be uploaded through the app.", "FOREIGN_PHOTO");
  }
}

/**
 * Stores an image in Cloudflare R2 after checking size and real file type (magic bytes, not the
 * client-supplied MIME). Keys are unguessable UUIDv7s under the uploader's prefix; the bucket is
 * read-only to the public and only this server holds write credentials.
 */
export async function uploadImage(userId: string, file: File) {
  if (file.size === 0) throw badRequest("Empty file.");
  if (file.size > MAX_UPLOAD_BYTES) throw badRequest("Images must be 5 MB or smaller.", "FILE_TOO_LARGE");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = SIGNATURES.find((s) => s.test(bytes));
  if (!kind) throw badRequest("Only JPEG, PNG or WebP images are allowed.", "UNSUPPORTED_TYPE");

  const key = `${userPrefix(userId)}${uuidv7()}.${kind.ext}`;
  await r2().send(
    new PutObjectCommand({
      Bucket: storageEnv().R2_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: kind.type,
      CacheControl: "public, max-age=31536000, immutable",
      ContentDisposition: "inline",
      Metadata: { owner: userId },
    }),
  );

  return { url: `${storageEnv().R2_PUBLIC_URL}/${key}` };
}

/**
 * The R2 key behind one of our photo URLs, or null for anything else (Google avatars, legacy
 * Firebase URLs). Matches on the path, not the host, so a later move from r2.dev to a custom
 * domain can't make every stored URL look unreferenced.
 */
export function uploadKeyFromUrl(url: string) {
  try {
    const key = decodeURIComponent(new URL(url).pathname.slice(1));
    return key.startsWith("u/") ? key : null;
  } catch {
    return null;
  }
}

/** Every uploaded object (optionally under one prefix), with its upload time. */
export async function listUploads(prefix = "u/") {
  const objects: { key: string; lastModified: Date }[] = [];
  let token: string | undefined;
  do {
    const page = await r2().send(
      new ListObjectsV2Command({ Bucket: storageEnv().R2_BUCKET, Prefix: prefix, ContinuationToken: token }),
    );
    for (const o of page.Contents ?? []) {
      if (o.Key && o.LastModified) objects.push({ key: o.Key, lastModified: o.LastModified });
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return objects;
}

export async function deleteUploads(keys: string[]) {
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    const result = await r2().send(
      new DeleteObjectsCommand({
        Bucket: storageEnv().R2_BUCKET,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      }),
    );
    if (result.Errors?.length) throw new Error(`R2 delete failed for ${result.Errors.length} objects`);
  }
}

/** Everything a user ever uploaded (account deletion). */
export async function deleteUserUploads(userId: string) {
  const objects = await listUploads(userPrefix(userId));
  await deleteUploads(objects.map((o) => o.key));
  return objects.length;
}

/**
 * Deletes photos the moment nothing needs them any more (listing removed, photo dropped while editing,
 * avatar replaced). Only this user's own uploads are touched; other URLs (Google avatars, legacy
 * Firebase) are skipped. Best effort: a failure is logged and the daily cleanup removes them later,
 * since nothing references them any more.
 */
export async function discardUploads(userId: string, urls: (string | null | undefined)[]) {
  const prefix = userPrefix(userId);
  const keys = [...new Set(urls.map((u) => (u ? uploadKeyFromUrl(u) : null)))].filter(
    (k): k is string => k !== null && k.startsWith(prefix),
  );
  if (!keys.length) return;
  // Never delete a photo something of theirs still shows (callers run this after their own update).
  const inUse = await getDb().execute<{ url: string }>(sql`
    select unnest(photos) as url from items where owner_id = ${userId} and status <> 'removed'
    union
    select avatar_url as url from users where id = ${userId} and avatar_url is not null`);
  const keep = new Set(inUse.rows.map((r) => uploadKeyFromUrl(r.url)));
  const unused = keys.filter((k) => !keep.has(k));
  if (!unused.length) return;
  await deleteUploads(unused).catch((error) => console.error("[uploads] photo delete failed", error));
}
