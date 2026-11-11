import { NextResponse, type NextRequest } from "next/server";

import { guestLocale } from "@/lib/api/server-client";
import { GUEST_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { getApiOrigin } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Renews the guest cookie while the table visit is open. 410 once the visit closed. */
export async function POST(request: NextRequest) {
  const token = request.cookies.get(GUEST_TOKEN_COOKIE)?.value;
  if (!token) return NextResponse.json({ detail: "No guest session.", code: "SESSION_NOT_FOUND" }, { status: 401 });
  try {
    const upstream = await fetch(`${getApiOrigin()}/api/v1/sessions/refresh`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
        "accept-language": guestLocale(request),
      },
      cache: "no-store",
    });
    const payload = (await upstream.json().catch(() => ({}))) as {
      session_token?: string;
      expires_in?: number;
      detail?: unknown;
      code?: string;
    };
    if (!upstream.ok || !payload.session_token) {
      return NextResponse.json({ detail: payload.detail ?? "Could not renew.", code: payload.code }, { status: upstream.status || 502 });
    }
    const response = NextResponse.json({ expires_in: payload.expires_in ?? 3600 });
    response.cookies.set(GUEST_TOKEN_COOKIE, payload.session_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: payload.expires_in ?? 3600,
    });
    return response;
  } catch {
    return NextResponse.json({ detail: "API unreachable." }, { status: 502 });
  }
}
