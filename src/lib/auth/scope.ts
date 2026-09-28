import { roleHome, type UserProfile, type UserRole } from "@/lib/auth/roles";

/**
 * Where a signed-in user belongs, taken only from `/auth/me`. The API is the
 * real guard; these helpers keep the UI from asking for anything else.
 */
export type HomeScope = "platform" | "brand" | "branch";

export type ScopeBranch = { id: string; name: string };

export type WorkspaceProblem = "no-brand" | "no-branch";

export const NO_WORKSPACE_PATH = "/app/no-workspace";
export const DENIED_PARAM = "denied";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function homeScopeOf(me: UserProfile): HomeScope {
  const reported = me.home_scope;
  if (reported === "platform" || reported === "brand" || reported === "branch") return reported;
  if (me.role === "SUPER_ADMIN") return "platform";
  if (me.role === "BRAND_ADMIN") return "brand";
  return "branch";
}

export function scopeBranches(me: UserProfile): ScopeBranch[] {
  return (me.accessible_branches ?? []).map((branch) => ({ id: branch.id, name: branch.name }));
}

/** Null when the user has somewhere to land. */
export function workspaceProblem(me: UserProfile): WorkspaceProblem | null {
  const scope = homeScopeOf(me);
  if (scope === "platform") return null;
  if (scope === "brand") return me.brand_id ? null : "no-brand";
  return scopeBranches(me).length > 0 ? null : "no-branch";
}

export function scopeHome(me: UserProfile): string {
  if (workspaceProblem(me)) return NO_WORKSPACE_PATH;
  const scope = homeScopeOf(me);
  if (scope === "platform") return "/app/brands";
  if (scope === "brand") return `/app/brands/${me.brand_id}`;
  return roleHome(me.role);
}

export function deniedUrl(me: UserProfile): string {
  const home = scopeHome(me);
  return home === NO_WORKSPACE_PATH ? home : `${home}?${DENIED_PARAM}=1`;
}

/** Brand dashboard and anything under it. */
export function canOpenBrand(me: UserProfile, brandId: string): boolean {
  if (!isUuid(brandId)) return false;
  const scope = homeScopeOf(me);
  if (scope === "platform") return true;
  if (scope === "brand") return me.brand_id === brandId;
  return false;
}

/** Roles that may open a branch's settings page (profile, tables, PIN). */
const BRANCH_SETTINGS_ROLES: readonly UserRole[] = ["SUPER_ADMIN", "BRAND_ADMIN", "REGIONAL_MANAGER", "BRANCH_ADMIN"];

export function canOpenBranch(me: UserProfile, branchId: string): boolean {
  if (!isUuid(branchId) || !BRANCH_SETTINGS_ROLES.includes(me.role)) return false;
  if (homeScopeOf(me) === "platform") return true;
  return scopeBranches(me).some((branch) => branch.id === branchId);
}

/** `?brand=` / `?branch=` on any staff URL must already sit inside the scope. */
export function queryInScope(me: UserProfile, query: { brand?: string | null; branch?: string | null }): boolean {
  const scope = homeScopeOf(me);
  if (query.brand) {
    if (!isUuid(query.brand)) return false;
    if (scope !== "platform" && me.brand_id !== query.brand) return false;
  }
  if (query.branch) {
    if (!isUuid(query.branch)) return false;
    if (scope !== "platform" && !scopeBranches(me).some((branch) => branch.id === query.branch)) return false;
  }
  return true;
}

/** Roles allowed to see and rotate the table Access PIN (API `PIN_ROLES`). */
export const PIN_ROLES: readonly UserRole[] = ["SUPER_ADMIN", "BRAND_ADMIN", "BRANCH_ADMIN"];

export function initials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "Q";
  const letters = words.length === 1 ? words[0].slice(0, 2) : `${words[0][0]}${words[words.length - 1][0]}`;
  return letters.toUpperCase();
}
