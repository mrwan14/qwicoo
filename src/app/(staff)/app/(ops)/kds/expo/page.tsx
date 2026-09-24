import { RoleGate } from "@/components/ops/screen";
import { ExpoScreen } from "@/features/staff/expo-screen";

export default function Page() {
  return (
    <RoleGate href="/app/kds/expo">
      <ExpoScreen />
    </RoleGate>
  );
}
