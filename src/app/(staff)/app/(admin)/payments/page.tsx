"use client";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { PaymentsScreen } from "@/features/staff/payments-screen";
import { paymentsCopy } from "@/lib/i18n/staff/payments";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export default function Page() {
  const t = useStaffSection(paymentsCopy);
  return (
    <RoleGate href="/app/payments">
      <BranchGate screen={t.screen}>
        <PaymentsScreen />
      </BranchGate>
    </RoleGate>
  );
}
