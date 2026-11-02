"use client";

import { RoleGate } from "@/components/ops/screen";
import { CustomersScreen } from "@/features/staff/customers-screen";
import { SettingsFrame } from "@/features/staff/settings/frame";
import { settingsCopy } from "@/lib/i18n/staff/settings";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export default function Page() {
  const t = useStaffSection(settingsCopy);
  return (
    <RoleGate href="/app/settings/customers">
      <SettingsFrame item="customers" title={t.items.customers.title} subtitle={t.items.customers.body}>
        <CustomersScreen />
      </SettingsFrame>
    </RoleGate>
  );
}
