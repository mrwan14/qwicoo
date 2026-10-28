import type { UserProfile } from "@/lib/auth/roles";
import { canOpenBranch } from "@/lib/auth/scope";
import { navForUser } from "@/lib/nav";
import { canOpenInventoryPage } from "@/features/staff/inventory/access";

export type SettingsGroup = "business" | "people" | "money" | "security";
export type SettingsItem = "brand" | "branch" | "tablesQr" | "staff" | "customers" | "payments" | "delivery" | "stock" | "audit";

export type SettingsLink = { item: SettingsItem; group: SettingsGroup; href: string };

export const SETTINGS_GROUPS: readonly SettingsGroup[] = ["business", "people", "money", "security"];

/** The Settings list for this user. Every entry is a page the role can already open. */
export function settingsLinks(me: UserProfile, activeBranchId: string | null): SettingsLink[] {
  const allowed = new Map(navForUser(me, activeBranchId).map((item) => [item.key ?? item.href, item.href]));
  const links: SettingsLink[] = [];
  const add = (item: SettingsItem, group: SettingsGroup, href: string | null | undefined) => {
    if (href) links.push({ item, group, href });
  };

  const brandSettings = allowed.get("brand-settings");
  add("brand", "business", brandSettings);
  add(
    "branch",
    "business",
    allowed.get("branch-settings") ??
      (activeBranchId && me.role !== "SUPER_ADMIN" && canOpenBranch(me, activeBranchId) ? `/app/branches/${activeBranchId}` : null),
  );
  add("tablesQr", "business", allowed.get("/app/qr"));
  add("staff", "people", allowed.get("/app/staff"));
  add("customers", "people", allowed.get("/app/mobile-customers"));
  add("payments", "money", brandSettings ? `${brandSettings}#payments` : null);
  add("delivery", "money", allowed.get("/app/delivery"));
  add("stock", "money", canOpenInventoryPage(me.role, "settings") ? "/app/inventory/settings" : null);
  add("audit", "security", allowed.get("/app/audit"));
  return links;
}
