"use client";

import { RoleGate } from "@/components/ops/screen";
import { AttendanceReport } from "@/features/staff/reports/money-reports";

export default function Page() {
  return (
    <RoleGate href="/app/reports/attendance">
      <AttendanceReport />
    </RoleGate>
  );
}
