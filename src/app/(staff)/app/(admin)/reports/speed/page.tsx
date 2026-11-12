"use client";

import { RoleGate } from "@/components/ops/screen";
import { SpeedOfServiceReport } from "@/features/staff/reports/speed-of-service";

export default function Page() {
  return (
    <RoleGate href="/app/reports/sales">
      <SpeedOfServiceReport />
    </RoleGate>
  );
}
