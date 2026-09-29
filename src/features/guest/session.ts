import { ApiError, asApiError } from "@/lib/api/error";
import type { components } from "@/lib/api/schema";
import { mergeGuestBranding } from "@/lib/guest/branding";
import type { LocaleCode } from "@/lib/i18n/locale-text";
import { useGuest, type GuestSession } from "@/stores/guest";

type PresenceResponse = Omit<components["schemas"]["TableSessionResponse"], "session_token">;

export function tableTokenFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/t\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function guestTableToken(): string | null {
  if (typeof window !== "undefined") {
    const fromUrl = tableTokenFromPath(window.location.pathname);
    if (fromUrl) return fromUrl;
  }
  return useGuest.getState().tableToken;
}

export function isGuestSessionGone(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return (
    error.code === "SESSION_NOT_FOUND" ||
    error.code === "SESSION_TERMINATED_TABLE_AVAILABLE" ||
    error.status === 401
  );
}

export function toGuestSession(data: PresenceResponse): GuestSession {
  const brandId = (data as { brand_id?: unknown }).brand_id;
  return {
    sessionId: data.session_id,
    branchId: data.branch_id,
    brandId: typeof brandId === "string" ? brandId : null,
    tableId: data.table_id,
    tableNumber: data.table_number,
    branchName: typeof data.branch_name === "string" ? data.branch_name : null,
    presenceVerified: data.is_presence_verified,
  };
}

export async function joinTable(token: string, locale: LocaleCode): Promise<GuestSession> {
  const response = await fetch("/api/guest/session/join", {
    method: "POST",
    headers: { "content-type": "application/json", "accept-language": locale },
    body: JSON.stringify({ qr_token: token }),
  });
  const payload = (await response.json().catch(() => ({}))) as PresenceResponse;
  if (!response.ok) {
    throw asApiError(payload, response, "Could not rejoin this table.", locale);
  }
  const session = toGuestSession(payload);
  useGuest.getState().setSession(session);
  useGuest.getState().setTableToken(token);
  useGuest.getState().setBranding(mergeGuestBranding(null, payload));
  return session;
}

/** Rejoin with the stored or URL table token. Returns false when there is no token or join failed. */
export async function recoverGuestSession(): Promise<boolean> {
  const token = guestTableToken();
  if (!token) return false;
  try {
    await joinTable(token, useGuest.getState().locale);
    return true;
  } catch {
    return false;
  }
}
