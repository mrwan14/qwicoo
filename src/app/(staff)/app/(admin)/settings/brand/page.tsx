import { redirect } from "next/navigation";

import { BrandSettingsPage } from "@/features/staff/settings/brand-pages";
import { getCurrentUser } from "@/lib/api/current-user";
import { getApiOrigin } from "@/lib/env";

export default async function Page() {
  const me = await getCurrentUser();
  if (!me) redirect("/api/auth/logout");
  return <BrandSettingsPage brandId={me.brand_id ?? null} apiOrigin={getApiOrigin()} />;
}
