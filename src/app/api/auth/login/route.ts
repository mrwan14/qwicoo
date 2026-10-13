import { NextResponse, type NextRequest } from "next/server";

import { errorDetail } from "@/lib/api/error";
import { requestLocale } from "@/lib/api/server-client";
import { STAFF_TOKEN_COOKIE, staffCookieOptions } from "@/lib/auth/cookies";
import { getApiOrigin } from "@/lib/env";

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

  try {
    const locale = requestLocale(request);
    // Direct fetch: the OpenAPI client rebuilds the Request after setting headers,
    // and Next's fetch then throws "expected non-null body source" — a 401 for a
    // wrong password was caught and reported as API unreachable.
    const upstream = await fetch(`${getApiOrigin()}/api/v1/auth/token`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "accept-language": locale,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ username: email, password, scope: "" }),
      cache: "no-store",
    });

    if (upstream.status === 429) {
      return NextResponse.json(
        { detail: "Too many sign-in attempts. Wait a moment and try again." },
        { status: 429 },
      );
    }

    if (upstream.status === 401) {
      return NextResponse.json({ detail: "Incorrect email or password" }, { status: 401 });
    }

    const payload = (await upstream.json().catch(() => null)) as {
      access_token?: unknown;
      expires_in?: unknown;
      detail?: unknown;
      code?: unknown;
    } | null;

    if (!upstream.ok || typeof payload?.access_token !== "string" || typeof payload.expires_in !== "number") {
      const detail = errorDetail(payload, "Sign-in failed.", locale);
      return NextResponse.json({ detail }, { status: upstream.status || 401 });
    }

    const response = NextResponse.json({ expires_in: payload.expires_in });
    response.cookies.set(STAFF_TOKEN_COOKIE, payload.access_token, staffCookieOptions(payload.expires_in));
    return response;
  } catch {
    return NextResponse.json({ detail: "API unreachable." }, { status: 502 });
  }
}
