"use client";

import { RoleGate } from "@/components/ops/screen";
import { SalesReport } from "@/features/staff/reports/analytics-reports";

export default function Page() {
  return (
    <RoleGate href="/app/reports/sales">
      <SalesReport />
    </RoleGate>
  );
}
