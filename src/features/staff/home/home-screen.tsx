"use client";

import { RoleGate } from "@/components/ops/screen";
import { useScope } from "@/stores/scope";

import { BranchHome } from "./branch-home";
import { BrandHome } from "./brand-home";
import { PlatformHome } from "./platform-home";

/** Home for App Admin (platform), brand admins (every branch) and branch admins (their branch). */
export function HomeScreen() {
  const homeScope = useScope((state) => state.homeScope);
  return (
    <RoleGate href="/app/home">
      {homeScope === "platform" ? <PlatformHome /> : homeScope === "brand" ? <BrandHome /> : <BranchHome />}
    </RoleGate>
  );
}
