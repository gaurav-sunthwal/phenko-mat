import { authedRoute } from "@/lib/server/api";
import { badRequest } from "@/lib/server/errors";
import { MAX_UPLOAD_BYTES, uploadImage } from "@/lib/server/services/uploads";

export const POST = authedRoute(
  async ({ req, user }) => {
    const length = Number(req.headers.get("content-length") ?? 0);
    if (length > MAX_UPLOAD_BYTES + 64 * 1024) throw badRequest("Images must be 5 MB or smaller.", "FILE_TOO_LARGE");
    const form = await req.formData().catch(() => {
      throw badRequest("Expected multipart form data.");
    });
    const file = form.get("file");
    if (!(file instanceof File)) throw badRequest("Missing file.");
    return uploadImage(user.id, file);
  },
  { rateLimit: { name: "uploads", limit: 60, windowSec: 3600, store: "shared" } },
);
