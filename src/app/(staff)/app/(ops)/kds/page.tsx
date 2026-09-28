import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { KdsScreen } from "@/features/staff/kds-screen";

export default function Page() {
  return (
    <RoleGate href="/app/kds">
      <BranchGate screen="The kitchen display">
        <KdsScreen />
      </BranchGate>
    </RoleGate>
  );
}
