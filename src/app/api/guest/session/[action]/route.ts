import { NextResponse, type NextRequest } from "next/server";

import { asApiError } from "@/lib/api/error";
import type { components } from "@/lib/api/schema";
import { createApiClient, guestLocale } from "@/lib/api/server-client";
import { GUEST_TOKEN_COOKIE } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

const ACTIONS = {
  verify: "/api/v1/sessions/verify-presence",
  join: "/api/v1/sessions/join",
} as const;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ action: string }> },
) {
  const { action } = await context.params;
  if (action !== "verify" && action !== "join") {
    return NextResponse.json({ detail: "Unknown session action." }, { status: 404 });
  }

  const body = (await request.json()) as components["schemas"]["TablePresenceVerifyRequest"];
  const locale = guestLocale(request);
  try {
    const client = createApiClient({ locale });
    const result = await client.POST(ACTIONS[action], { body });
    if (!result.response.ok || !result.data) {
      const fallback = locale === "ar" ? "تعذر التحقق من الطاولة." : "Could not verify the table.";
      const error = asApiError(result.error, result.response, fallback, locale);
      return NextResponse.json({ detail: error.message, code: error.code }, { status: error.status });
    }

    const { session_token: token, ...safe } = result.data;
    const response = NextResponse.json(safe);
    response.cookies.set(GUEST_TOKEN_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: result.data.expires_in ?? 3600,
    });
    return response;
  } catch {
    return NextResponse.json({ detail: "API unreachable." }, { status: 502 });
  }
}
