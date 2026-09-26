import { NextResponse, type NextRequest } from "next/server";

import { createApiClient } from "@/lib/api/server-client";
import type { components } from "@/lib/api/schema";
import { STAFF_TOKEN_COOKIE, staffCookieOptions } from "@/lib/auth/cookies";
import { isUserRole, roleLabel, type UserRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let email = "";
  let password = "";
  let allowedRoles: UserRole[] | null = null;
  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown; allowed_roles?: unknown };
    email = typeof body.email === "string" ? body.email : "";
    password = typeof body.password === "string" ? body.password : "";
    if (Array.isArray(body.allowed_roles)) {
      allowedRoles = body.allowed_roles.filter(isUserRole);
    }
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

    if (allowedRoles && allowedRoles.length > 0) {
      const me = await createApiClient({ token: result.data.access_token }).GET("/api/v1/auth/me");
      if (!me.response.ok || !me.data) {
        return NextResponse.json({ detail: "Could not load your profile." }, { status: 502 });
      }
      if (!allowedRoles.includes(me.data.role)) {
        return NextResponse.json(
          {
            detail: `This account is a ${roleLabel(me.data.role).toLowerCase()}. Use the sign-in for that role.`,
          },
          { status: 403 },
        );
      }
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
