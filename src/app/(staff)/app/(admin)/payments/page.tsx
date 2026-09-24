import { RoleGate } from "@/components/ops/screen";
import { PaymentsScreen } from "@/features/staff/payments-screen";

export default function Page() {
  return (
    <RoleGate href="/app/payments">
      <PaymentsScreen />
    </RoleGate>
  );
}
