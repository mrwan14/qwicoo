"use client";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { OrdersScreen } from "@/features/staff/orders-screen";
import { OrdersHub } from "@/features/staff/orders/hub";
import { ordersCopy } from "@/lib/i18n/staff/orders";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export default function Page() {
  const t = useStaffSection(ordersCopy);
  return (
    <RoleGate href="/app/orders/history">
      <BranchGate screen={t.screen}>
        <OrdersHub tab="history">
          <OrdersScreen />
        </OrdersHub>
      </BranchGate>
    </RoleGate>
  );
}
