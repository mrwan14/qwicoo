import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { FloorScreen } from "@/features/staff/floor-screen";

export default function Page() {
  return (
    <RoleGate href="/app/floor">
      <BranchGate screen="Floor">
        <FloorScreen />
      </BranchGate>
    </RoleGate>
  );
}
