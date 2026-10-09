import { NextResponse, type NextRequest } from "next/server";

import { errorDetail } from "@/lib/api/error";
import { createPublicApiClient } from "@/lib/api/password-reset";
import { requestLocale } from "@/lib/api/server-client";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";
import { STAFF_TOKEN_COOKIE, staffCookieOptions } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

const MESSAGES: Record<number, string> = {
  400: "This account is inactive.",
  404: "This reset link is invalid or has already been used.",
  410: "This reset link has expired.",
  422: "Password must be at least 8 characters.",
};

/**
 * Public: sets a new password and starts a staff session with the same
 * httpOnly cookie login uses. The access token is not returned to the browser.
 * A 400 means the account is inactive, so no cookie is stored.
 */
export async function POST(request: NextRequest) {
  let token = "";
  let password = "";
  try {
    const body = (await request.json()) as { token?: unknown; password?: unknown };
    token = typeof body.token === "string" ? body.token.trim() : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ detail: "Enter a new password." }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ detail: MESSAGES[404] }, { status: 404 });
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json(
      { detail: `Password must be ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters.` },
      { status: 422 },
    );
  }

  try {
    const locale = requestLocale(request);
    const result = await createPublicApiClient(locale).POST("/api/v1/auth/reset-password", {
      body: { token, password },
    });

    if (result.response.status === 400) {
      return NextResponse.json({ detail: MESSAGES[400] }, { status: 400 });
    }

    if (!result.response.ok || !result.data?.access_token) {
      const status = result.response.status || 502;
      const detail = MESSAGES[status] ?? errorDetail(result.error, "Could not reset this password.", locale);
      return NextResponse.json({ detail }, { status });
    }

    const response = NextResponse.json({ expires_in: result.data.expires_in });
    response.cookies.set(STAFF_TOKEN_COOKIE, result.data.access_token, staffCookieOptions(result.data.expires_in));
    return response;
  } catch {
    return NextResponse.json({ detail: "API unreachable." }, { status: 502 });
  }
}
