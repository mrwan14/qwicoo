import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { MenuAdmin } from "@/features/staff/menu-screen";

export default function Page() {
  return (
    <RoleGate href="/app/menu">
      <BranchGate screen="Menu">
        <MenuAdmin />
      </BranchGate>
    </RoleGate>
  );
}
