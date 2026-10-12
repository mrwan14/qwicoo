import { ApiError } from "@/lib/api/error";
import type { components } from "@/lib/api/schema";
import { mergeGuestBranding } from "@/lib/guest/branding";
import { explicitPaymobOffer, paymobOffered } from "@/lib/paymob/checkout";
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
  if (error.status === 401 || error.status === 410) return true;
  return (
    error.code === "GUEST_SESSION_ENDED" ||
    error.code === "SESSION_NOT_FOUND" ||
    error.code === "SESSION_TERMINATED_TABLE_AVAILABLE"
  );
}

export function toGuestSession(data: PresenceResponse): GuestSession {
  const brandId = (data as { brand_id?: unknown }).brand_id;
  return {
    sessionId: data.session_id,
    guestId: typeof data.guest_id === "string" ? data.guest_id : null,
    branchId: data.branch_id,
    brandId: typeof brandId === "string" ? brandId : null,
    tableId: data.table_id,
    tableNumber: data.table_number,
    branchName: typeof data.branch_name === "string" ? data.branch_name : null,
    presenceVerified: data.is_presence_verified,
    onlinePayments: paymobOffered(data) ? { paymob: true } : undefined,
  };
}

/** Keep the guest-safe Paymob flag when a menu, session, or order payload includes it. */
export function rememberPaymobOffer(source: unknown): void {
  const offered = explicitPaymobOffer(source);
  if (offered === undefined) return;
  const current = useGuest.getState().session;
  if (!current || Boolean(current.onlinePayments?.paymob) === offered) return;
  useGuest.getState().setSession({
    ...current,
    onlinePayments: offered ? { paymob: true } : undefined,
  });
}

/** Apply a successful presence response into the guest store. */
export function applyPresenceSession(token: string, data: PresenceResponse): GuestSession {
  const session = toGuestSession(data);
  useGuest.getState().setSession(session);
  useGuest.getState().setTableToken(token);
  useGuest.getState().setBranding(mergeGuestBranding(null, data));
  return session;
}

function dropEndedSession() {
  useGuest.getState().setSession(null);
  useGuest.getState().setCashRequestedOrderId(null);
}

/** True when the httpOnly guest cookie + stored session still talk to the API. */
export async function sessionStillValid(): Promise<boolean> {
  const session = useGuest.getState().session;
  if (!session?.sessionId) return false;
  try {
    const response = await fetch("/api/guest/api/v1/sessions/ordering-status", {
      method: "GET",
      headers: { "accept-language": useGuest.getState().locale },
      credentials: "include",
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Keep a still-valid guest session. Soft-join without location/PIN is no longer allowed,
 * so a dead session is dropped and the guest must pass presence again.
 */
export async function recoverGuestSession(): Promise<boolean> {
  if (await sessionStillValid()) return true;
  dropEndedSession();
  return false;
}

/** Clear a dead session and try to keep a still-valid one. Returns true when the error was a session-gone case. */
export async function resumeIfSessionGone(error: unknown): Promise<boolean> {
  if (!isGuestSessionGone(error)) return false;
  await recoverGuestSession();
  return true;
}
