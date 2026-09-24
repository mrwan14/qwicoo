import { NextResponse } from "next/server";

import { GUEST_TOKEN_COOKIE } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

export function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(GUEST_TOKEN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
