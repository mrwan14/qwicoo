import { redirect } from "next/navigation";

import { Screen } from "@/components/ops/screen";
import { toSearch } from "@/features/staff/legacy-redirect";
import { legacyTarget } from "@/features/staff/legacy-routes";
import { getCurrentUser } from "@/lib/api/current-user";
import { scopeHome } from "@/lib/auth/scope";
import { getNavItem } from "@/lib/nav";

export default async function AdminModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const href = `/app/${slug.join("/")}`;
  const me = await getCurrentUser();
  // Moved pages land on their new home.
  const moved = legacyTarget(href, toSearch(await searchParams), me?.role);
  if (moved) redirect(moved);
  const item = getNavItem(href);
  // Old or unknown bookmarks land on the user's home instead of a 404.
  if (!item || item.shell !== "admin") redirect(me ? scopeHome(me) : "/api/auth/logout");
  return <Screen href={href} />;
}
