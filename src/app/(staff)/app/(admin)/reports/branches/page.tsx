"use client";

import { RoleGate } from "@/components/ops/screen";
import { BranchesReport } from "@/features/staff/reports/analytics-reports";

export default function Page() {
  return (
    <RoleGate href="/app/reports/sales">
      <BranchesReport />
    </RoleGate>
  );
}
