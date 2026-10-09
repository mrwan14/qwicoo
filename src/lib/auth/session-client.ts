"use client";

import { useEffect } from "react";

import { ApiError } from "@/lib/api/error";
import { DENIED_PARAM, NO_WORKSPACE_PATH } from "@/lib/auth/scope";
import { getQueryClient } from "@/lib/query-client";
import { clearStoredBranches, useScope } from "@/stores/scope";

/** API details that mean "this brand or branch is outside your scope". */
export const SCOPE_DENIALS = new Set(["CROSS_TENANT_ACCESS_FORBIDDEN", "BRANCH_ACCESS_FORBIDDEN"]);

/**
 * Send the user home with the access toast. At most one redirect per
 * navigation: if we are already home, or already arrived from a denial,
 * show the no-workspace screen instead of looping.
 */
export function denyAccess() {
  const state = useScope.getState();
  if (state.blocked) return;
  const url = new URL(window.location.href);
  const home = state.home;
  if (!home || home === NO_WORKSPACE_PATH || url.pathname === home || url.searchParams.has(DENIED_PARAM)) {
    state.block();
    return;
  }
  const target = `${home}?${DENIED_PARAM}=1`;
  if (state.navigate) state.navigate(target);
  else window.location.replace(target);
}

/** Brand or branch detail answered 403/404: treat it as out of scope, not as a crash. */
export function useDenyWhenMissing(error: unknown) {
  const missing = error instanceof ApiError && (error.status === 403 || error.status === 404);
  useEffect(() => {
    if (missing) denyAccess();
  }, [missing]);
  return missing;
}

let ending = false;

/** Sign out or drop an expired session so nothing from this user survives on the device. */
export async function endStaffSession(redirectTo = "/login") {
  if (ending) return;
  ending = true;
  // Stop pushes to this browser before the session goes. Bounded so sign-out never hangs.
  await Promise.race([
    import("@/lib/push/web-push").then((push) => push.removePushSubscription()),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]).catch(() => undefined);
  try {
    const { useWorkspace } = await import("@/stores/workspace");
    useWorkspace.getState().setPushEnabled(false);
  } catch {
    // Preferences are best effort.
  }
  try {
    // Cached menu, tables and profile belong to this person. The unsynced till queue is kept.
    const { clearOfflineData } = await import("@/lib/offline/idb");
    await clearOfflineData();
    navigator.serviceWorker?.controller?.postMessage({ type: "qwicoo:clear-shell" });
  } catch {
    // Best effort.
  }
  const client = getQueryClient();
  await client.cancelQueries();
  client.clear();
  useScope.getState().reset();
  clearStoredBranches();
  try {
    const { clearAssistantSession } = await import("@/features/staff/assistant/session");
    clearAssistantSession();
  } catch {
    // The conversation is memory-only; navigation drops it if this import fails.
  }
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // The cookie is httpOnly; if the call fails the next /auth/me 401s anyway.
  }
  window.location.replace(redirectTo);
}

/**
 * Change the working branch. In-flight requests are cancelled and the cache
 * emptied before the new id reaches the header store, so no screen can
 * render or send with the old branch.
 */
export async function switchBranch(branchId: string) {
  const state = useScope.getState();
  if (branchId === state.branchId) return;
  if (!state.branches.some((branch) => branch.id === branchId)) return;
  const client = getQueryClient();
  await client.cancelQueries();
  state.switchGuard?.close();
  client.removeQueries({ predicate: (query) => query.queryKey[0] !== "auth" });
  useScope.getState().setActiveBranch(branchId);
}

/** App Admin's version of `switchBranch`: any branch, with the same cache reset. Null goes back to choosing. */
export async function focusPlatformBranch(focus: { brandId: string | null; branchId: string | null }) {
  const state = useScope.getState();
  if (state.homeScope !== "platform") return;
  if (focus.branchId === state.branchId && focus.brandId === state.brandId) return;
  const client = getQueryClient();
  await client.cancelQueries();
  state.switchGuard?.close();
  client.removeQueries({ predicate: (query) => query.queryKey[0] !== "auth" });
  useScope.getState().focusPlatform(focus);
}
