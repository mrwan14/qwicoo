import { NextResponse, type NextRequest } from "next/server";

import { errorDetail } from "@/lib/api/error";
import { requestLocale } from "@/lib/api/server-client";
import { callerIpHeaders, createPublicApiClient } from "@/lib/api/password-reset";
import { RESET_LINK_SENT_MESSAGE } from "@/lib/auth/password-policy";

export const dynamic = "force-dynamic";

/**
 * Public. Always answers 200 with the same message when the API accepts the
 * address, including unknown emails, inactive accounts, and a failed send.
 */
export async function POST(request: NextRequest) {
  let email = "";
  try {
    const body = (await request.json()) as { email?: unknown };
    email = typeof body.email === "string" ? body.email.trim() : "";
  } catch {
    return NextResponse.json({ detail: "Enter an email address." }, { status: 422 });
  }

  if (!email) {
    return NextResponse.json({ detail: "Enter an email address." }, { status: 422 });
  }

  try {
    const locale = requestLocale(request);
    const result = await createPublicApiClient(locale).POST("/api/v1/auth/forgot-password", {
      body: { email },
      headers: callerIpHeaders(request),
    });

    if (result.response.status === 429) {
      return NextResponse.json({ detail: "Try again in a minute." }, { status: 429 });
    }

    if (result.response.status === 422) {
      return NextResponse.json(
        { detail: errorDetail(result.error, "Enter a valid email address.", locale) },
        { status: 422 },
      );
    }

    if (!result.response.ok) {
      return NextResponse.json({ detail: "Could not send a reset link right now." }, { status: 502 });
    }

    return NextResponse.json({ message: RESET_LINK_SENT_MESSAGE });
  } catch {
    return NextResponse.json({ detail: "API unreachable." }, { status: 502 });
  }
}
