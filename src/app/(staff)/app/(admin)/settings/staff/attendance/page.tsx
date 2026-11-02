"use client";

import { RoleGate } from "@/components/ops/screen";
import { AttendanceScreen } from "@/features/staff/backoffice-screen";
import { StaffRoles } from "@/features/staff/settings/staff-roles";

export default function Page() {
  return (
    <RoleGate href="/app/settings/staff/attendance">
      <StaffRoles tab="attendance">
        <AttendanceScreen />
      </StaffRoles>
    </RoleGate>
  );
}
