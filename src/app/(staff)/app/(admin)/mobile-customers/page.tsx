import { RoleGate } from "@/components/ops/screen";
import { CustomersScreen } from "@/features/staff/customers-screen";

export default function Page() {
  return (
    <RoleGate href="/app/mobile-customers">
      <CustomersScreen />
    </RoleGate>
  );
}
