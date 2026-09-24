import { RoleGate } from "@/components/ops/screen";
import { MenuAdmin } from "@/features/staff/menu-screen";

export default function Page() {
  return (
    <RoleGate href="/app/menu">
      <MenuAdmin />
    </RoleGate>
  );
}
