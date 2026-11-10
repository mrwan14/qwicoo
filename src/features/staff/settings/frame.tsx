"use client";

import { cn } from "cn";
import Link from "next/link";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/ops/kit/page-header";
import { Tabs, type TabItem } from "@/components/ops/kit/tabs";
import { NestedHeaders } from "@/components/ops/page-header";
import { useStaffSession } from "@/components/ops/staff-session";
import { settingsCopy } from "@/lib/i18n/staff/settings";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { SETTINGS_GROUPS, settingsLinks, type SettingsItem } from "./links";

/** The grouped Settings list, compact, beside each settings page on wide screens. */
function SettingsList({ active }: { active: SettingsItem | null }) {
  const t = useStaffSection(settingsCopy);
  const me = useStaffSession();
  const branchId = useScope((state) => state.branchId);
  if (!me) return null;
  const links = settingsLinks(me, branchId);
  return (
    <nav aria-label={t.listLabel} className="hidden content-start gap-5 lg:grid">
      {SETTINGS_GROUPS.map((group) => {
        const rows = links.filter((link) => link.group === group);
        if (rows.length === 0) return null;
        return (
          <div key={group} className="grid gap-1">
            <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-ink-secondary uppercase">{t.groups[group]}</p>
            {rows.map((link) => (
              <Link
                key={link.item}
                href={link.href}
                aria-current={link.item === active ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center rounded-staff border px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus",
                  link.item === active
                    ? "border-border bg-subtle font-semibold text-ink"
                    : "border-transparent text-ink-secondary hover:bg-subtle hover:text-ink",
                )}
              >
                {t.items[link.item].title}
              </Link>
            ))}
          </div>
        );
      })}
    </nav>
  );
}

/**
 * One settings page: the grouped list on the start side, then a back link, the title,
 * optional tabs (at most four) and the page. Older screens inside get section headings.
 */
export function SettingsFrame<T extends string>({
  item,
  title,
  subtitle,
  actions,
  tabs,
  tab,
  children,
}: {
  item: SettingsItem | null;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  tabs?: readonly TabItem<T>[];
  tab?: T;
  children: ReactNode;
}) {
  const t = useStaffSection(settingsCopy);
  return (
    <div className="settings-soft mx-auto grid w-full max-w-[1200px] grid-cols-1 items-start gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <SettingsList active={item} />
      <div className="grid min-w-0 grid-cols-1 gap-4">
        <PageHeader back={{ href: "/app/settings", label: t.back }} title={title} subtitle={subtitle} actions={actions} />
        {tabs && tab ? <Tabs label={typeof title === "string" ? title : t.listLabel} value={tab} items={tabs} /> : null}
        <NestedHeaders>{children}</NestedHeaders>
      </div>
    </div>
  );
}
