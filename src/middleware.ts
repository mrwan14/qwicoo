import { NextResponse, type NextRequest } from "next/server";

import { STAFF_TOKEN_COOKIE } from "@/lib/auth/cookies";

export function middleware(request: NextRequest) {
  const token = request.cookies.get(STAFF_TOKEN_COOKIE)?.value;
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/app") && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/login" && token) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login"],
};
