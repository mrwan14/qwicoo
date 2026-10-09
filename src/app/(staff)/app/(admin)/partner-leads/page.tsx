import { RoleGate } from "@/components/ops/screen";
import { PartnerLeadsScreen } from "@/features/staff/assistant/leads-screen";

export default function Page() {
  return (
    <RoleGate href="/app/partner-leads">
      <PartnerLeadsScreen />
    </RoleGate>
  );
}
