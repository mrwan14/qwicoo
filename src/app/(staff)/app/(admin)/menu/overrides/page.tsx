import { RoleGate } from "@/components/ops/screen";
import { OverrideScreen } from "@/features/staff/catalog-screen";

export default function Page() {
  return (
    <RoleGate href="/app/menu">
      <OverrideScreen />
    </RoleGate>
  );
}
