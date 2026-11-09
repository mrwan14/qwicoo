"use client";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { TaxesReport } from "@/features/staff/reports/z-reports";
import { reportsCopy } from "@/lib/i18n/staff/reports";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

/** Built from Z reports, so it follows the Till report's access and needs one branch. */
export default function Page() {
  const t = useStaffSection(reportsCopy);
  return (
    <RoleGate href="/app/reports/till">
      <BranchGate screen={t.items.taxes.title}>
        <TaxesReport />
      </BranchGate>
    </RoleGate>
  );
}
