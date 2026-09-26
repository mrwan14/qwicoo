import { NextResponse, type NextRequest } from "next/server";

import { errorDetail } from "@/lib/api/error";
import { createApiClient } from "@/lib/api/server-client";

export const dynamic = "force-dynamic";

const MESSAGES: Record<number, string> = {
  404: "This invitation link is not valid. It may have been used already or revoked.",
  410: "This invitation has expired. Ask the person who invited you to send a new one.",
};

/** Public: resolves an invitation token to the invitee, role, and scope. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (token.length < 16) {
    return NextResponse.json({ detail: MESSAGES[404] }, { status: 404 });
  }

  try {
    const result = await createApiClient().GET("/api/v1/invitations/preview", {
      params: { query: { token } },
    });
    if (!result.response.ok || !result.data) {
      const status = result.response.status || 502;
      const detail = MESSAGES[status] ?? errorDetail(result.error, "Could not load this invitation.");
      return NextResponse.json({ detail }, { status });
    }
    return NextResponse.json(result.data);
  } catch {
    return NextResponse.json({ detail: "API unreachable." }, { status: 502 });
  }
}
