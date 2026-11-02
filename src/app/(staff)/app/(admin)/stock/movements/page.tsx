import { InventorySection } from "@/features/staff/inventory/chrome";
import { MovementsScreen } from "@/features/staff/inventory/movements-screen";

export default function Page() {
  return (
    <InventorySection>
      <MovementsScreen />
    </InventorySection>
  );
}
