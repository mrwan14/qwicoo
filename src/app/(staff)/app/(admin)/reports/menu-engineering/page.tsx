"use client";

import { RoleGate } from "@/components/ops/screen";
import { MenuEngineeringReport } from "@/features/staff/reports/menu-engineering";

export default function Page() {
  return (
    <RoleGate href="/app/reports/sales">
      <MenuEngineeringReport />
    </RoleGate>
  );
}
