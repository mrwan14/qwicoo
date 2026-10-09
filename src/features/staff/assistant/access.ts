import type { UserRole } from "@/lib/auth/roles";

export function canSeeAssistantUsage(role: UserRole): boolean {
  return role === "SUPER_ADMIN" || role === "BRAND_ADMIN";
}

export type AssistantBranch = { id: string; name: string };

const BRAND_LEVEL: readonly UserRole[] = ["SUPER_ADMIN", "BRAND_ADMIN", "REGIONAL_MANAGER"];

export const STARTER_KEYS = ["today", "items", "cash", "cancelled", "hours"] as const;
export type StarterKey = (typeof STARTER_KEYS)[number] | "topBranch";

/** Brand-level roles also get the cross-branch starter. A branch admin does not. */
export function starterKeys(role: UserRole): StarterKey[] {
  return BRAND_LEVEL.includes(role) ? [...STARTER_KEYS, "topBranch"] : [...STARTER_KEYS];
}

/**
 * The picker only offers branches the caller can already access.
 * An id outside that list is dropped, and the active scope is kept when it is inside the list.
 */
export function selectAssistantBranch(accessible: readonly { id: string }[], activeId: string | null): string | null {
  if (accessible.length === 0) return null;
  if (activeId && accessible.some((branch) => branch.id === activeId)) return activeId;
  return accessible[0]?.id ?? null;
}

export function assistantSheetSide(mobile: boolean, dir: "ltr" | "rtl"): "bottom" | "left" | "right" {
  if (mobile) return "bottom";
  return dir === "rtl" ? "left" : "right";
}
