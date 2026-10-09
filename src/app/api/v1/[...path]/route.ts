import { NextResponse, type NextRequest } from "next/server";

import { requestLocale } from "@/lib/api/server-client";
import { isPublicAssistantPath, staffAuthorization } from "@/lib/api/public-proxy";
import { STAFF_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { getApiV1Base } from "@/lib/env";

export const dynamic = "force-dynamic";

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const token = request.cookies.get(STAFF_TOKEN_COOKIE)?.value;
  const publicAssistant = isPublicAssistantPath(path);
  if (!token && !publicAssistant) {
    return NextResponse.json({ detail: "Not signed in." }, { status: 401 });
  }

  const target = new URL(
    `${getApiV1Base()}/${path.map((segment) => encodeURIComponent(segment)).join("/")}${request.nextUrl.search}`,
  );

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", request.headers.get("accept") ?? "application/json");
  const authorization = staffAuthorization(path, token);
  if (authorization) headers.set("authorization", authorization);
  headers.set("accept-language", requestLocale(request));

  if (!publicAssistant) {
    const brandId = request.headers.get("x-brand-id");
    const branchId = request.headers.get("x-branch-id");
    if (brandId) headers.set("x-brand-id", brandId);
    if (branchId) headers.set("x-branch-id", branchId);
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: "no-store",
    });
    const responseHeaders = new Headers();
    const upstreamType = upstream.headers.get("content-type");
    if (upstreamType) responseHeaders.set("content-type", upstreamType);
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json({ detail: "API unreachable." }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
