import { redirect } from "next/navigation";

import { NoWorkspace } from "@/components/ops/workspace-states";
import { getCurrentUser } from "@/lib/api/current-user";
import { scopeHome, workspaceProblem } from "@/lib/auth/scope";

export const dynamic = "force-dynamic";

/** Landing for accounts with no brand or branch. Anyone with a workspace is sent home. */
export default async function NoWorkspacePage() {
  const me = await getCurrentUser();
  if (!me) redirect("/api/auth/logout");
  if (!workspaceProblem(me)) redirect(scopeHome(me));
  return <NoWorkspace />;
}
