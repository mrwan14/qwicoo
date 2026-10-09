"use client";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { RequestsScreen } from "@/features/staff/requests-screen";
import { requestsCopy } from "@/lib/i18n/staff/requests";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export default function Page() {
  const t = useStaffSection(requestsCopy);
  return (
    <RoleGate href="/app/floor/requests">
      <BranchGate screen={t.screen}>
        <RequestsScreen />
      </BranchGate>
    </RoleGate>
  );
}
