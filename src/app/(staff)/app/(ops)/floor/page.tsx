"use client";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { FloorScreen } from "@/features/staff/floor-screen";
import { floorCopy } from "@/lib/i18n/staff/floor";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export default function Page() {
  const t = useStaffSection(floorCopy);
  return (
    <RoleGate href="/app/floor">
      <BranchGate screen={t.screen}>
        <FloorScreen />
      </BranchGate>
    </RoleGate>
  );
}
