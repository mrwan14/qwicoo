import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { StaffScreen } from "@/features/staff/people-screen";

export default function Page() {
  return (
    <RoleGate href="/app/staff">
      <BranchGate screen="Staff">
        <StaffScreen />
      </BranchGate>
    </RoleGate>
  );
}
