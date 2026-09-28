import { redirect } from "next/navigation";

import { Screen } from "@/components/ops/screen";
import { getCurrentUser } from "@/lib/api/current-user";
import { scopeHome } from "@/lib/auth/scope";
import { getNavItem } from "@/lib/nav";

export default async function AdminModulePage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const href = `/app/${slug.join("/")}`;
  const item = getNavItem(href);
  // Old or unknown bookmarks land on the user's home instead of a 404.
  if (!item || item.shell !== "admin") {
    const me = await getCurrentUser();
    redirect(me ? scopeHome(me) : "/api/auth/logout");
  }
  return <Screen href={href} />;
}
