import { cookies } from "next/headers";

import { createApiClient } from "@/lib/api/server-client";
import { STAFF_TOKEN_COOKIE } from "@/lib/auth/cookies";
import type { UserProfile } from "@/lib/auth/roles";

export async function getCurrentUser(): Promise<UserProfile | null> {
  const token = (await cookies()).get(STAFF_TOKEN_COOKIE)?.value;
  if (!token) return null;

  try {
    const client = createApiClient({ token });
    const { data, response } = await client.GET("/api/v1/auth/me");
    if (!response.ok || !data) return null;
    return data;
  } catch {
    return null;
  }
}
