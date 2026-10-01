import { NextResponse, type NextRequest } from "next/server";

/**
 * Fast gate: no admin cookie → sign-in page. This is only a convenience; every page and server
 * action verifies the session and the allow-list itself (lib/auth.ts).
 */
export function proxy(req: NextRequest) {
  if (!req.cookies.get("__admin_session")?.value) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api/session|_next/static|_next/image|favicon.ico).*)"],
};
