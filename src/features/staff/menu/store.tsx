"use client";

import { useStaffSession } from "@/components/ops/staff-session";
import { StoreTab } from "@/features/staff/store-tab";
import { useLocale } from "@/lib/i18n/locale-store";
import { pickLocale } from "@/lib/i18n/locale-text";
import { menuCopy } from "@/lib/i18n/staff/menu";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { useMenuTree } from "./shared";

/** Menu → Store: the existing Store tab, fed from the same menu tree. */
export function MenuStore() {
  const t = useStaffSection(menuCopy);
  const { locale } = useLocale();
  const me = useStaffSession();
  const branchId = useScope((state) => state.branchId);
  const menu = useMenuTree(t.menuFailed);
  if (!branchId || !menu.data) return null;
  const categories = menu.data.categories ?? [];
  return (
    <StoreTab
      branchId={branchId}
      role={me?.role}
      categories={categories.map((category) => ({ id: category.id, name: pickLocale(category.name, locale) }))}
      treeItems={categories
        .flatMap((category) => category.items ?? [])
        .map((item) => ({
          id: item.id,
          name: pickLocale(item.name, locale),
          item_type: item.item_type ?? null,
          scope: "scope" in item && typeof item.scope === "string" ? item.scope : null,
          price: item.base_price,
        }))}
    />
  );
}
