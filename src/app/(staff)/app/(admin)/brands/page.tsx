import { redirect } from "next/navigation";

import { BrandsScreen } from "@/features/staff/brands-screen";
import { guardScope } from "@/lib/api/current-user";
import { homeScopeOf, scopeHome } from "@/lib/auth/scope";

export const dynamic = "force-dynamic";

/** The all-brands grid is App Admin only. A brand admin's "Brands" is their own dashboard. */
export default async function Page() {
  const me = await guardScope((user) => homeScopeOf(user) !== "branch");
  if (homeScopeOf(me) === "brand") redirect(scopeHome(me));
  return <BrandsScreen />;
}
