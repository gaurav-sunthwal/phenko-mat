import { publicRoute } from "@/lib/server/api";
import { bearerToken, registerBearer } from "@/lib/server/auth";
import { unauthorized } from "@/lib/server/errors";

/**
 * Native app sign-in. The app sends its Firebase ID token as `Authorization: Bearer …`; we verify
 * it with the same rules as the web session and make sure the users row exists. No cookie is set —
 * the app keeps sending the (auto-refreshed) ID token on every request.
 */
export const POST = publicRoute(
  async ({ req }) => {
    const token = bearerToken(req);
    if (!token) throw unauthorized();
    const user = await registerBearer(token);
    return { user: { id: user.id } };
  },
  { rateLimit: { name: "auth:native", limit: 10, windowSec: 60, store: "shared" } },
);
