import type { NextRequest } from "next/server";

import { createApiClient } from "@/lib/api/server-client";

/**
 * Auth client with no bearer token. These routes are public; do not copy
 * Authorization or the staff session cookie onto the upstream request.
 */
export function createPublicApiClient() {
  return createApiClient();
}

/** So the API can rate-limit the caller rather than this server. */
export function callerIpHeaders(request: NextRequest): { "x-forwarded-for": string } | undefined {
  const forwarded = request.headers.get("x-forwarded-for")?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const value = forwarded || realIp;
  if (!value) return undefined;
  return { "x-forwarded-for": value };
}
