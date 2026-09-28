import { NextResponse, type NextRequest } from "next/server";

import { errorDetail } from "@/lib/api/error";
import type { components } from "@/lib/api/schema";
import { createApiClient } from "@/lib/api/server-client";
import { STAFF_TOKEN_COOKIE, staffCookieOptions } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

const MESSAGES: Record<number, string> = {
  404: "This invitation link is not valid. It may have been used already or revoked.",
  409: "An account with this email already exists. Sign in instead.",
  410: "This invitation has expired. Ask the person who invited you to send a new one.",
};

/**
 * Public: consumes an invitation token, sets the password, and starts a staff
 * session with the same httpOnly cookie that login uses. The JWT never reaches
 * the browser.
 */
export async function POST(request: NextRequest) {
  let body: components["schemas"]["InvitationAcceptRequest"];
  try {
    const raw = (await request.json()) as { token?: unknown; password?: unknown; full_name?: unknown };
    const token = typeof raw.token === "string" ? raw.token.trim() : "";
    const password = typeof raw.password === "string" ? raw.password : "";
    const fullName = typeof raw.full_name === "string" ? raw.full_name.trim() : "";
    if (token.length < 16) {
      return NextResponse.json({ detail: MESSAGES[404] }, { status: 404 });
    }
    if (password.length < 8) {
      return NextResponse.json({ detail: "Use at least 8 characters for your password." }, { status: 422 });
    }
    body = { token, password, ...(fullName ? { full_name: fullName } : {}) };
  } catch {
    return NextResponse.json({ detail: "Enter a password." }, { status: 400 });
  }

  try {
    const result = await createApiClient().POST("/api/v1/invitations/accept", { body });
    if (!result.response.ok || !result.data) {
      const status = result.response.status || 502;
      const detail = MESSAGES[status] ?? errorDetail(result.error, "Could not accept this invitation.");
      return NextResponse.json({ detail }, { status });
    }

    const { access_token, expires_in, user } = result.data;
    const response = NextResponse.json({ role: user.role, home: "/app" });
    response.cookies.set(STAFF_TOKEN_COOKIE, access_token, staffCookieOptions(expires_in));
    return response;
  } catch {
    return NextResponse.json({ detail: "API unreachable." }, { status: 502 });
  }
}
