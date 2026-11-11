"use client";

import { RoleGate } from "@/components/ops/screen";
import { MenuHub } from "@/features/staff/menu/hub";
import { PromosScreen } from "@/features/staff/menu/promos-screen";

export default function Page() {
  return (
    <RoleGate href="/app/menu">
      <MenuHub tab="promos">
        <PromosScreen />
      </MenuHub>
    </RoleGate>
  );
}
