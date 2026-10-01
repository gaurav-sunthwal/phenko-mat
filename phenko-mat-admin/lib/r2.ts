import "server-only";
import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";

let client: S3Client | undefined;
function r2() {
  const e = env();
  return (client ??= new S3Client({
    region: "auto",
    endpoint: `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: e.R2_ACCESS_KEY_ID, secretAccessKey: e.R2_SECRET_ACCESS_KEY },
  }));
}

/** Our R2 key behind a photo URL (`u/<userId>/…`), or null for other URLs (Google avatars etc.). */
export function keyFromUrl(url: string) {
  try {
    const key = decodeURIComponent(new URL(url).pathname.slice(1));
    return key.startsWith("u/") ? key : null;
  } catch {
    return null;
  }
}

async function deleteKeys(keys: string[]) {
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    const result = await r2().send(
      new DeleteObjectsCommand({ Bucket: env().R2_BUCKET, Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true } }),
    );
    if (result.Errors?.length) throw new Error(`R2 delete failed for ${result.Errors.length} objects`);
  }
}

/** Deletes these photos (our uploads only). Failures are logged; the app's daily cleanup catches leftovers. */
export async function deletePhotos(urls: string[]) {
  const keys = [...new Set(urls.map(keyFromUrl).filter((k): k is string => k !== null))];
  if (keys.length) await deleteKeys(keys).catch((e) => console.error("[admin] photo delete failed", e));
}

/** Everything a user uploaded (account deletion). */
export async function deleteUserPhotos(userId: string) {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await r2().send(
      new ListObjectsV2Command({ Bucket: env().R2_BUCKET, Prefix: `u/${userId}/`, ContinuationToken: token }),
    );
    for (const o of page.Contents ?? []) if (o.Key) keys.push(o.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  if (keys.length) await deleteKeys(keys).catch((e) => console.error("[admin] account photo delete failed", e));
}

/** Health check: can we reach the bucket with our credentials? */
export async function pingR2() {
  await r2().send(new ListObjectsV2Command({ Bucket: env().R2_BUCKET, MaxKeys: 1 }));
}
