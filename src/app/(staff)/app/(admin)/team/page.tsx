"use client";

import { RoleGate } from "@/components/ops/screen";
import { InvitationsScreen } from "@/features/staff/invitations-screen";
import { navCopy } from "@/lib/i18n/staff/nav";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export default function Page() {
  const nav = useStaffSection(navCopy);
  return (
    <RoleGate href="/app/team">
      <InvitationsScreen title={nav.team} />
    </RoleGate>
  );
}
