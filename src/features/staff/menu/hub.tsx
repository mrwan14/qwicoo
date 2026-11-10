"use client";

import type { ReactNode } from "react";

import { PageHeader } from "@/components/ops/kit/page-header";
import { Tabs } from "@/components/ops/kit/tabs";
import { useStaffSession } from "@/components/ops/staff-session";
import { canManagePromos, canSeeStationsTab } from "@/features/staff/menu-permissions";
import { fill } from "@/lib/i18n/dictionary";
import { menuCopy } from "@/lib/i18n/staff/menu";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

import { useMenuTree } from "./shared";

export type MenuTab = "items" | "menus" | "combos" | "promos" | "store" | "stations";

const TABS: readonly { value: MenuTab; href: string }[] = [
  { value: "items", href: "/app/menu" },
  { value: "menus", href: "/app/menu/menus" },
  { value: "combos", href: "/app/menu/combos" },
  { value: "promos", href: "/app/menu/promos" },
  { value: "store", href: "/app/menu/store" },
  { value: "stations", href: "/app/menu/stations" },
];

/** Menu page frame: title with counts, actions for the current tab, and Items · Menus · Combos · Promo codes · Store · Stations. */
export function MenuHub({ tab, actions, children }: { tab: MenuTab; actions?: ReactNode; children: ReactNode }) {
  const t = useStaffSection(menuCopy);
  const me = useStaffSession();
  const tree = useMenuTree(t.menuFailed);
  const categories = tree.data?.categories ?? [];
  const items = categories.reduce((sum, category) => sum + (category.items?.length ?? 0), 0);
  const stations = canSeeStationsTab(me?.role);
  const promos = canManagePromos(me?.role);
  return (
    <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-5">
      <PageHeader
        title={t.title}
        subtitle={tree.data ? fill(t.hub.subtitle, { items, categories: categories.length }) : undefined}
        actions={actions}
      />
      <Tabs
        label={t.hub.tabsLabel}
        value={tab}
        items={TABS.filter((item) => (item.value !== "stations" || stations) && (item.value !== "promos" || promos)).map((item) => ({
          value: item.value,
          label: t.hub.tabs[item.value],
          href: item.href,
        }))}
      />
      {children}
    </div>
  );
}
