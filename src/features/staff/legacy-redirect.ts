import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/api/current-user";

import { legacyTarget } from "./legacy-routes";

type SearchParams = Record<string, string | string[] | undefined>;

export function toSearch(searchParams: SearchParams): URLSearchParams {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    for (const item of [value].flat()) if (item !== undefined) query.append(key, item);
  }
  return query;
}

/** For old pages that some roles still use: moves everyone else to the new home. */
export async function redirectLegacy(pathname: string, searchParams: SearchParams): Promise<void> {
  const me = await getCurrentUser();
  const target = legacyTarget(pathname, toSearch(searchParams), me?.role);
  if (target) redirect(target);
}
