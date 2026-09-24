import { NextResponse } from "next/server";

import { createApiClient } from "@/lib/api/server-client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = createApiClient();
    const { data, response } = await client.GET("/health/ready");
    if (!response.ok) {
      return NextResponse.json(data ?? { status: "offline" }, { status: response.status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: "offline" }, { status: 503 });
  }
}
