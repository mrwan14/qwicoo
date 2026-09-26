import { NextResponse, type NextRequest } from "next/server";

import { errorDetail } from "@/lib/api/error";
import { createPublicApiClient } from "@/lib/api/password-reset";

export const dynamic = "force-dynamic";

const MESSAGES: Record<number, string> = {
  404: "This reset link is invalid or has already been used.",
  410: "This reset link has expired.",
};

/** Public: resolves a reset token to the account email and expiry. The raw token is not logged. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!token) {
    return NextResponse.json({ detail: MESSAGES[404] }, { status: 404 });
  }

  try {
    const result = await createPublicApiClient().GET("/api/v1/auth/reset-password/preview", {
      params: { query: { token } },
    });
    if (!result.response.ok || !result.data) {
      const status = result.response.status || 502;
      const detail = MESSAGES[status] ?? errorDetail(result.error, "Could not open this reset link.");
      return NextResponse.json({ detail }, { status });
    }
    return NextResponse.json({ email: result.data.email, expires_at: result.data.expires_at });
  } catch {
    return NextResponse.json({ detail: "API unreachable." }, { status: 502 });
  }
}
