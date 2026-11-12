"use client";

import { RoleGate } from "@/components/ops/screen";
import { StockFlowReport } from "@/features/staff/reports/stock-flow";

export default function Page() {
  return (
    <RoleGate href="/app/stock">
      <StockFlowReport />
    </RoleGate>
  );
}
