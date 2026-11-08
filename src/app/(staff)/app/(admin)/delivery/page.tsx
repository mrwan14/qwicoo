import { RoleGate } from "@/components/ops/screen";
import { DeliveryScreen } from "@/features/staff/delivery-areas-screen";

export default function Page() {
  return (
    <RoleGate href="/app/delivery">
      <DeliveryScreen />
    </RoleGate>
  );
}
