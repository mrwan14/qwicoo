"use client";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { ExpoScreen } from "@/features/staff/expo-screen";
import { handoverCopy } from "@/lib/i18n/staff/handover";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export default function Page() {
  const t = useStaffSection(handoverCopy);
  return (
    <RoleGate href="/app/kds/expo">
      <BranchGate screen={t.screen}>
        <ExpoScreen />
      </BranchGate>
    </RoleGate>
  );
}
