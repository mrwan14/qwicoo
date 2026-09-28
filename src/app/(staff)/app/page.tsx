import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/api/current-user";
import { scopeHome } from "@/lib/auth/scope";

export const dynamic = "force-dynamic";

export default async function AppHome() {
  const me = await getCurrentUser();
  if (!me) redirect("/api/auth/logout");
  redirect(scopeHome(me));
}
