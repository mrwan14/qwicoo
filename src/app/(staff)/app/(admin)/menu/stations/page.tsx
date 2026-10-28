"use client";

import { useEffect } from "react";

import { BranchGate } from "@/components/ops/branch-gate";
import { RoleGate } from "@/components/ops/screen";
import { useStaffSession } from "@/components/ops/staff-session";
import { canSeeStationsTab } from "@/features/staff/menu-permissions";
import { MenuHub } from "@/features/staff/menu/hub";
import { StationsTab } from "@/features/staff/menu/stations-tab";
import { denyAccess } from "@/lib/auth/session-client";
import { menuCopy } from "@/lib/i18n/staff/menu";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export default function Page() {
  const t = useStaffSection(menuCopy);
  const me = useStaffSession();
  const allowed = canSeeStationsTab(me?.role);
  useEffect(() => {
    if (me && !allowed) denyAccess();
  }, [me, allowed]);
  return (
    <RoleGate href="/app/menu">
      <BranchGate screen={t.title}>
        {allowed ? (
          <MenuHub tab="stations">
            <StationsTab />
          </MenuHub>
        ) : null}
      </BranchGate>
    </RoleGate>
  );
}
