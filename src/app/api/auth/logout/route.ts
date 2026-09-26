import { NextResponse, type NextRequest } from "next/server";

import { STAFF_TOKEN_COOKIE } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

function clearCookie(response: NextResponse) {
  response.cookies.set(STAFF_TOKEN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export function POST() {
  return clearCookie(NextResponse.json({ ok: true }));
}

export function GET(request: NextRequest) {
  return clearCookie(NextResponse.redirect(new URL("/", request.url)));
}
