"use client";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { KdsScreen } from "@/features/staff/kds-screen";
import { kdsCopy } from "@/lib/i18n/staff/kds";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export default function Page() {
  const t = useStaffSection(kdsCopy);
  return (
    <RoleGate href="/app/kds">
      <BranchGate screen={t.screen}>
        <KdsScreen />
      </BranchGate>
    </RoleGate>
  );
}
