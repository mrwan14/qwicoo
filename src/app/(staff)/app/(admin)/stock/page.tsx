import { InventorySection } from "@/features/staff/inventory/chrome";
import { StockScreen } from "@/features/staff/inventory/stock-screen";

export default function Page() {
  return (
    <InventorySection>
      <StockScreen />
    </InventorySection>
  );
}
