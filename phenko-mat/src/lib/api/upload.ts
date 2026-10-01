import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { request } from "./client";

const MAX_EDGE = 1280;
const QUALITY = 0.8;

/**
 * Downscale + re-encode on the device first (same as web): faster uploads on mobile data, a smaller
 * storage bill (WebP is ~30% smaller than JPEG), and the re-encode strips EXIF — including GPS — so
 * a photo never leaks someone's home location.
 */
async function compress(uri: string, width: number, height: number) {
  const context = ImageManipulator.manipulate(uri);
  const longest = Math.max(width, height);
  if (longest > MAX_EDGE) {
    context.resize(width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const image = await context.renderAsync();
  try {
    return await image.saveAsync({ format: SaveFormat.WEBP, compress: QUALITY });
  } finally {
    image.release();
    context.release();
  }
}

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

/** Compresses and uploads one image; resolves to its public HTTPS URL. */
export async function uploadImage(picked: PickedImage): Promise<string> {
  const compressed = await compress(picked.uri, picked.width, picked.height);
  const form = new FormData();
  // Expo replaces the global fetch with expo/fetch, which can't send React Native's { uri, name, type }
  // parts — it fails as a network error. An expo-file-system File implements the Blob interface.
  form.append("file", new File(compressed.uri) as unknown as Blob);
  const { url } = await request<{ url: string }>("POST", "/api/uploads", { form, timeoutMs: 60_000 });
  return url;
}
