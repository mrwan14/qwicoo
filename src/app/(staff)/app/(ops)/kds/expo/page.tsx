import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { ExpoScreen } from "@/features/staff/expo-screen";

export default function Page() {
  return (
    <RoleGate href="/app/kds/expo">
      <BranchGate screen="Expo">
        <ExpoScreen />
      </BranchGate>
    </RoleGate>
  );
}
