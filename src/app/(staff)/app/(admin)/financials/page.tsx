import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { FinancialsScreen } from "@/features/staff/backoffice-screen";

export default function Page() {
  return (
    <RoleGate href="/app/financials">
      <BranchGate screen="Financials">
        <FinancialsScreen />
      </BranchGate>
    </RoleGate>
  );
}
