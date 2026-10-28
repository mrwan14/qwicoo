"use client";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { OrdersHub } from "@/features/staff/orders/hub";
import { PaymentsScreen } from "@/features/staff/payments-screen";
import { paymentsCopy } from "@/lib/i18n/staff/payments";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export default function Page() {
  const t = useStaffSection(paymentsCopy);
  return (
    <RoleGate href="/app/orders/payments">
      <BranchGate screen={t.screen}>
        <OrdersHub tab="payments">
          <PaymentsScreen />
        </OrdersHub>
      </BranchGate>
    </RoleGate>
  );
}
