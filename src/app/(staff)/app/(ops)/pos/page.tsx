import { Suspense } from "react";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { PosScreen } from "@/features/staff/pos-screen";

export default function Page() {
  return (
    <RoleGate href="/app/pos">
      <BranchGate screen="POS">
        <Suspense>
          <PosScreen />
        </Suspense>
      </BranchGate>
    </RoleGate>
  );
}
