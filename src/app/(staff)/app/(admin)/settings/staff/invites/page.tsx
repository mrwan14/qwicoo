"use client";

import { RoleGate } from "@/components/ops/screen";
import { InvitationsScreen } from "@/features/staff/invitations-screen";
import { StaffRoles } from "@/features/staff/settings/staff-roles";
import { settingsCopy } from "@/lib/i18n/staff/settings";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export default function Page() {
  const t = useStaffSection(settingsCopy);
  return (
    <RoleGate href="/app/settings/staff/invites">
      <StaffRoles tab="invites">
        <InvitationsScreen title={t.staffTabs.invites} />
      </StaffRoles>
    </RoleGate>
  );
}
