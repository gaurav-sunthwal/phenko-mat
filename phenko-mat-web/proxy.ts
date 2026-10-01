import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "__session";

/**
 * Fast, optimistic gate for app pages: no cookie → login. The cookie is fully verified by
 * every API call; this only saves a round trip for signed-out visitors.
 */
export function proxy(req: NextRequest) {
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  const { pathname, search } = req.nextUrl;

  if (!hasSession) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/feed/:path*",
    "/categories/:path*",
    "/profile/:path*",
    "/chats/:path*",
    "/chat/:path*",
    "/new",
    "/listing/:path*",
    "/welcome",
    "/u/:path*",
  ],
};
