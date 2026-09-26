import { NextResponse, type NextRequest } from "next/server";

import { STAFF_TOKEN_COOKIE } from "@/lib/auth/cookies";

const ENTRY_PATHS = new Set(["/admin", "/restaurant-dashboard"]);

export function middleware(request: NextRequest) {
  const token = request.cookies.get(STAFF_TOKEN_COOKIE)?.value;
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/app") && !token) {
    return NextResponse.redirect(new URL("/restaurant-dashboard", request.url));
  }

  // Old bookmark. Send it to the restaurant entry.
  if (pathname === "/login") {
    return NextResponse.redirect(new URL(token ? "/app" : "/restaurant-dashboard", request.url));
  }

  if (ENTRY_PATHS.has(pathname) && token) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login", "/admin", "/restaurant-dashboard"],
};
