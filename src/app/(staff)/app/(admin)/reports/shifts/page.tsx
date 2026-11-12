"use client";

import { RoleGate } from "@/components/ops/screen";
import { ShiftsDrawersReport } from "@/features/staff/reports/shifts-drawers";

export default function Page() {
  return (
    <RoleGate href="/app/reports/till">
      <ShiftsDrawersReport />
    </RoleGate>
  );
}
