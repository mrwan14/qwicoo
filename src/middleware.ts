import { NextResponse, type NextRequest } from "next/server";

import type { UserProfile } from "@/lib/auth/roles";
import { STAFF_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { deniedUrl, queryInScope } from "@/lib/auth/scope";
import { getApiV1Base } from "@/lib/env";

/** Old split sign-in pages. There is one sign-in now. */
const LEGACY_LOGIN = new Set(["/admin", "/restaurant-dashboard"]);

async function fetchMe(token: string): Promise<UserProfile | null | "unauthorized"> {
  try {
    const response = await fetch(`${getApiV1Base()}/auth/me`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      cache: "no-store",
    });
    if (response.status === 401) return "unauthorized";
    if (!response.ok) return null;
    return (await response.json()) as UserProfile;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(STAFF_TOKEN_COOKIE)?.value;
  const { pathname, searchParams } = request.nextUrl;

  if (LEGACY_LOGIN.has(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url), 308);
  }

  if (pathname === "/login") {
    return token ? NextResponse.redirect(new URL("/app", request.url)) : NextResponse.next();
  }

  if (!pathname.startsWith("/app")) return NextResponse.next();

  if (!token) return NextResponse.redirect(new URL("/login", request.url));

  // Scope never comes from the URL, but a URL that names another brand or
  // branch must not render at all.
  const brand = searchParams.get("brand");
  const branch = searchParams.get("branch");
  if (brand || branch) {
    const me = await fetchMe(token);
    if (me === "unauthorized") return NextResponse.redirect(new URL("/api/auth/logout", request.url));
    if (!me) {
      const clean = request.nextUrl.clone();
      clean.searchParams.delete("brand");
      clean.searchParams.delete("branch");
      return NextResponse.redirect(clean);
    }
    if (!queryInScope(me, { brand, branch })) {
      return NextResponse.redirect(new URL(deniedUrl(me), request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login", "/admin", "/restaurant-dashboard"],
};
