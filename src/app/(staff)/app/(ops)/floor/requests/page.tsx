import { RoleGate } from "@/components/ops/screen";
import { RequestsScreen } from "@/features/staff/requests-screen";

export default function Page() {
  return (
    <RoleGate href="/app/floor/requests">
      <RequestsScreen />
    </RoleGate>
  );
}
