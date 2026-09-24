import { RoleGate } from "@/components/ops/screen";
import { AuditScreen } from "@/features/staff/backoffice-screen";

export default function Page() {
  return (
    <RoleGate href="/app/audit">
      <AuditScreen />
    </RoleGate>
  );
}
