import { RoleGate } from "@/components/ops/screen";
import { FloorScreen } from "@/features/staff/floor-screen";

export default function Page() {
  return (
    <RoleGate href="/app/floor">
      <FloorScreen />
    </RoleGate>
  );
}
