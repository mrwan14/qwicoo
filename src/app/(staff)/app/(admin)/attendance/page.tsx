import { RoleGate } from "@/components/ops/screen";
import { AttendanceScreen } from "@/features/staff/backoffice-screen";

export default function Page() {
  return (
    <RoleGate href="/app/attendance">
      <AttendanceScreen />
    </RoleGate>
  );
}
