import { Suspense } from "react";

import { InventorySection } from "@/features/staff/inventory/chrome";
import { TransfersScreen } from "@/features/staff/inventory/transfers-screen";

export default function Page() {
  return (
    <InventorySection>
      <Suspense>
        <TransfersScreen />
      </Suspense>
    </InventorySection>
  );
}
