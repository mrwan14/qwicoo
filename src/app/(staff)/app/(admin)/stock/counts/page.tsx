import { Suspense } from "react";

import { InventorySection } from "@/features/staff/inventory/chrome";
import { CountsScreen } from "@/features/staff/inventory/counts-screen";

export default function Page() {
  return (
    <InventorySection>
      <Suspense>
        <CountsScreen />
      </Suspense>
    </InventorySection>
  );
}
