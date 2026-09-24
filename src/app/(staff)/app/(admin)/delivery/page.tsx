import { RoleGate } from "@/components/ops/screen";
import { DeliveryScreen } from "@/features/staff/people-screen";

export default function Page() {
  return (
    <RoleGate href="/app/delivery">
      <DeliveryScreen />
    </RoleGate>
  );
}
