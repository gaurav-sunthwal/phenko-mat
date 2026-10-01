import { z } from "zod";
import { createAdminSession } from "@/lib/auth";

const body = z.object({ idToken: z.string().min(20).max(4096) });

/** Exchanges a fresh Firebase ID token for the admin session cookie (allow-listed emails only). */
export async function POST(req: Request) {
  // Same-origin only: the browser always sends Origin on POST.
  const origin = req.headers.get("origin");
  if (!origin || new URL(origin).host !== req.headers.get("host")) {
    return Response.json({ error: "Cross-site request blocked." }, { status: 403 });
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  try {
    const result = await createAdminSession(parsed.data.idToken);
    return result.ok ? Response.json({ ok: true }) : Response.json({ error: result.error }, { status: 403 });
  } catch (e) {
    // Misconfiguration (env, Firebase credentials): say so instead of a bare 500.
    console.error("[admin] sign-in failed", e);
    const message = e instanceof Error && e.message.startsWith("Invalid or missing") ? e.message : "Sign-in failed on the server. Check the admin app's logs.";
    return Response.json({ error: message }, { status: 500 });
  }
}
