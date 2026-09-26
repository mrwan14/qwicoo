import { RoleGate } from "@/components/ops/screen";
import { InvitationsScreen } from "@/features/staff/invitations-screen";

export default function Page() {
  return (
    <RoleGate href="/app/invitations">
      <InvitationsScreen title="People" />
    </RoleGate>
  );
}
