"use client";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { FinancialsScreen } from "@/features/staff/backoffice-screen";
import { navCopy } from "@/lib/i18n/staff/nav";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export default function Page() {
  const nav = useStaffSection(navCopy);
  return (
    <RoleGate href="/app/financials">
      <BranchGate screen={nav.till}>
        <FinancialsScreen />
      </BranchGate>
    </RoleGate>
  );
}
