import { RoleGate } from "@/components/ops/screen";
import { FeaturesScreen } from "@/features/staff/people-screen";

export default function Page() {
  return (
    <RoleGate href="/app/features">
      <FeaturesScreen />
    </RoleGate>
  );
}
