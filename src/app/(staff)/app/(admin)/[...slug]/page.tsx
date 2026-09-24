import { notFound } from "next/navigation";

import { Screen } from "@/components/ops/screen";
import { getNavItem } from "@/lib/nav";

export default async function AdminModulePage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const href = `/app/${slug.join("/")}`;
  const item = getNavItem(href);
  if (!item || item.shell !== "admin") notFound();
  return <Screen href={href} />;
}
