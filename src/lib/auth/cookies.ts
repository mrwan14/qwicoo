export const STAFF_TOKEN_COOKIE = "staff_token";
export const GUEST_TOKEN_COOKIE = "guest_session";

/** Options for the httpOnly staff session cookie. Shared by login and invite accept. */
export function staffCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
