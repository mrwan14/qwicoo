import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { DeliveryBoard } from "@/features/staff/delivery-board";

export default function Page() {
  return (
    <RoleGate href="/app/orders/delivery">
      <BranchGate screen="Delivery board">
        <DeliveryBoard />
      </BranchGate>
    </RoleGate>
  );
}
