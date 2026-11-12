"use client";

import { RoleGate } from "@/components/ops/screen";
import { SalesBreakdownReport } from "@/features/staff/reports/sales-breakdown";

export default function Page() {
  return (
    <RoleGate href="/app/reports/sales">
      <SalesBreakdownReport />
    </RoleGate>
  );
}
