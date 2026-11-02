"use client";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { DeliveryBoard } from "@/features/staff/delivery-board";
import { OrdersHub } from "@/features/staff/orders/hub";
import { deliveryBoardCopy } from "@/lib/i18n/staff/delivery-board";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export default function Page() {
  const t = useStaffSection(deliveryBoardCopy);
  return (
    <RoleGate href="/app/orders/delivery">
      <BranchGate screen={t.screen}>
        <OrdersHub tab="delivery">
          <DeliveryBoard />
        </OrdersHub>
      </BranchGate>
    </RoleGate>
  );
}
