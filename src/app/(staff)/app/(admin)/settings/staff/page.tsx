"use client";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { StaffScreen } from "@/features/staff/people-screen";
import { StaffRoles } from "@/features/staff/settings/staff-roles";
import { navCopy } from "@/lib/i18n/staff/nav";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export default function Page() {
  const nav = useStaffSection(navCopy);
  return (
    <RoleGate href="/app/settings/staff">
      <BranchGate screen={nav.staff}>
        <StaffRoles tab="staff">
          <StaffScreen />
        </StaffRoles>
      </BranchGate>
    </RoleGate>
  );
}
