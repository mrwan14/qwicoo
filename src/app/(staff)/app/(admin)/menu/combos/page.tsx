import { RoleGate } from "@/components/ops/screen";
import { ComboScreen } from "@/features/staff/catalog-screen";

export default function Page() {
  return (
    <RoleGate href="/app/menu">
      <ComboScreen />
    </RoleGate>
  );
}
