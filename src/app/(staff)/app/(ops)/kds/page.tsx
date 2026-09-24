import { RoleGate } from "@/components/ops/screen";
import { KdsScreen } from "@/features/staff/kds-screen";

export default function Page() {
  return (
    <RoleGate href="/app/kds">
      <KdsScreen />
    </RoleGate>
  );
}
