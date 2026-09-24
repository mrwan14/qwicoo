import { RoleGate } from "@/components/ops/screen";
import { AnalyticsScreen } from "@/features/staff/backoffice-screen";

export default function Page() {
  return (
    <RoleGate href="/app/analytics">
      <AnalyticsScreen view="menu" />
    </RoleGate>
  );
}
