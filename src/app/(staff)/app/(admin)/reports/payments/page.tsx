"use client";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { PaymentsReport } from "@/features/staff/reports/money-reports";
import { reportsCopy } from "@/lib/i18n/staff/reports";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export default function Page() {
  const t = useStaffSection(reportsCopy);
  return (
    <RoleGate href="/app/reports/payments">
      <BranchGate screen={t.items.payments.title}>
        <PaymentsReport />
      </BranchGate>
    </RoleGate>
  );
}
