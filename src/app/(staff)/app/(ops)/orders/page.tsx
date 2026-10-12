import { Suspense } from "react";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { OrdersScreen } from "@/features/staff/orders-screen";

export default function Page() {
  return (
    <RoleGate href="/app/orders">
      <BranchGate screen="Orders">
        <Suspense>
          <OrdersScreen />
        </Suspense>
      </BranchGate>
    </RoleGate>
  );
}
