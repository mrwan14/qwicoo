"use client";

import {
  Building2,
  ClipboardList,
  CreditCard,
  Package,
  QrCode,
  ShieldCheck,
  Store,
  Truck,
  Users,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { EmptyState } from "@/components/ops/kit/empty-state";
import { LinkGroup, LinkRow } from "@/components/ops/kit/link-list";
import { PageHeader } from "@/components/ops/kit/page-header";
import { RoleGate } from "@/components/ops/screen";
import { useStaffSession } from "@/components/ops/staff-session";
import { settingsCopy } from "@/lib/i18n/staff/settings";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { useScope } from "@/stores/scope";

import { SETTINGS_GROUPS, settingsLinks, type SettingsItem } from "./links";

const ICONS: Record<SettingsItem, LucideIcon> = {
  brand: Store,
  branch: Building2,
  tablesQr: QrCode,
  staff: Users,
  customers: UserRound,
  payments: CreditCard,
  delivery: Truck,
  stock: Package,
  audit: ShieldCheck,
};

export function SettingsHub() {
  const t = useStaffSection(settingsCopy);
  const me = useStaffSession();
  const branchId = useScope((state) => state.branchId);
  if (!me) return null;
  const links = settingsLinks(me, branchId);

  return (
    <RoleGate href="/app/settings">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6">
        <PageHeader title={t.title} subtitle={t.subtitle} />
        {links.length === 0 ? (
          <EmptyState icon={ClipboardList} title={t.nothing} />
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            {SETTINGS_GROUPS.map((group) => {
              const rows = links.filter((link) => link.group === group);
              if (rows.length === 0) return null;
              return (
                <LinkGroup key={group} label={t.groups[group]}>
                  {rows.map((link) => (
                    <LinkRow
                      key={link.item}
                      href={link.href}
                      icon={ICONS[link.item]}
                      title={t.items[link.item].title}
                      description={t.items[link.item].body}
                    />
                  ))}
                </LinkGroup>
              );
            })}
          </div>
        )}
      </div>
    </RoleGate>
  );
}
