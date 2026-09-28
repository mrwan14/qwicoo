import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { PaymentsScreen } from "@/features/staff/payments-screen";

export default function Page() {
  return (
    <RoleGate href="/app/payments">
      <BranchGate screen="Payments">
        <PaymentsScreen />
      </BranchGate>
    </RoleGate>
  );
}
