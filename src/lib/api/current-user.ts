import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { createApiClient } from "@/lib/api/server-client";
import { STAFF_TOKEN_COOKIE } from "@/lib/auth/cookies";
import type { UserProfile } from "@/lib/auth/roles";
import { deniedUrl } from "@/lib/auth/scope";

/** One `/auth/me` per request, shared by layouts and pages. */
export const getCurrentUser = cache(async (): Promise<UserProfile | null> => {
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
});

/**
 * Server-side scope check for ID routes. Runs before any client code, so an
 * out-of-scope brand or branch never renders, not even a loading frame.
 */
export async function guardScope(allowed: (me: UserProfile) => boolean): Promise<UserProfile> {
  const me = await getCurrentUser();
  if (!me) redirect("/api/auth/logout");
  if (!allowed(me)) redirect(deniedUrl(me));
  return me;
}
