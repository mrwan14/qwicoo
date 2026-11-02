"use client";

import type { ReactNode } from "react";

import { useStaffSession } from "@/components/ops/staff-session";
import { settingsCopy } from "@/lib/i18n/staff/settings";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import { navForUser } from "@/lib/nav";
import { useScope } from "@/stores/scope";

import { SettingsFrame } from "./frame";

export type StaffTab = "staff" | "invites" | "attendance";

const TABS: readonly { value: StaffTab; href: string }[] = [
  { value: "staff", href: "/app/settings/staff" },
  { value: "invites", href: "/app/settings/staff/invites" },
  { value: "attendance", href: "/app/settings/staff/attendance" },
];

/** Staff & roles: the old Staff, Team / Invitations and Attendance pages as three tabs. */
export function StaffRoles({ tab, children }: { tab: StaffTab; children: ReactNode }) {
  const t = useStaffSection(settingsCopy);
  const me = useStaffSession();
  const branchId = useScope((state) => state.branchId);
  const allowed = new Set(me ? navForUser(me, branchId).map((item) => item.href) : []);
  return (
    <SettingsFrame
      item="staff"
      title={t.items.staff.title}
      subtitle={t.items.staff.body}
      tab={tab}
      tabs={TABS.filter((item) => allowed.has(item.href)).map((item) => ({ value: item.value, label: t.staffTabs[item.value], href: item.href }))}
    >
      {children}
    </SettingsFrame>
  );
}
