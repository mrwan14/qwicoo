import { NextResponse, type NextRequest } from "next/server";

import { createApiClient } from "@/lib/api/server-client";
import type { components } from "@/lib/api/schema";
import { STAFF_TOKEN_COOKIE, staffCookieOptions } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let email = "";
  let password = "";
  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown };
    email = typeof body.email === "string" ? body.email : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ detail: "Enter an email and password." }, { status: 400 });
  }

  const credentials: components["schemas"]["Body_login_for_access_token_api_v1_auth_token_post"] = {
    username: email,
    password,
    scope: "",
  };

  try {
    const client = createApiClient();
    const result = await client.POST("/api/v1/auth/token", {
      body: credentials,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    if (result.response.status === 429) {
      return NextResponse.json(
        { detail: "Too many sign-in attempts. Wait a moment and try again." },
        { status: 429 },
      );
    }

    if (!result.data) {
      const detail =
        result.error && typeof result.error === "object" && "detail" in result.error
          ? String(result.error.detail)
          : "Sign-in failed.";
      return NextResponse.json({ detail }, { status: result.response.status || 401 });
    }

    const response = NextResponse.json({ expires_in: result.data.expires_in });
    response.cookies.set(
      STAFF_TOKEN_COOKIE,
      result.data.access_token,
      staffCookieOptions(result.data.expires_in),
    );
    return response;
  } catch {
    return NextResponse.json({ detail: "API unreachable." }, { status: 502 });
  }
}
