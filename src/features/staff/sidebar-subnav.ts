"use client";

import { stockSections } from "@/features/staff/inventory/chrome";
import { readyReports } from "@/features/staff/reports/reports-hub";
import type { UserProfile } from "@/lib/auth/roles";
import { inventoryCopy } from "@/lib/i18n/staff/inventory";
import { reportsCopy } from "@/lib/i18n/staff/reports";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";
import type { SidebarKey } from "@/lib/nav";
import { useScope } from "@/stores/scope";

export type SubLink = { href: string; label: string; active: boolean };

function under(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Marks only the link whose page is the closest match. "/app/stock" is a prefix of every Stock
 * page, so a plain prefix test would light up two links at once.
 */
function markActive(pathname: string, links: readonly { href: string; label: string; hrefs: readonly string[] }[]): SubLink[] {
  const depth = links.map((link) => Math.max(-1, ...link.hrefs.filter((href) => under(pathname, href)).map((href) => href.length)));
  const best = Math.max(-1, ...depth);
  return links.map((link, index) => ({ href: link.href, label: link.label, active: best >= 0 && depth[index] === best }));
}

/**
 * The pages listed under a sidebar entry while you are in that section: every report this
 * person can open under Reports, and the Stock tabs under Stock. Same role rules as the pages.
 */
export function useSidebarSubnav(me: UserProfile | null, pathname: string): Partial<Record<SidebarKey, SubLink[]>> {
  const reportsText = useStaffSection(reportsCopy);
  const stockText = useStaffSection(inventoryCopy);
  const branchId = useScope((state) => state.branchId);
  const branchCount = useScope((state) => state.branches.length);
  if (!me) return {};

  const reports = markActive(
    pathname,
    readyReports(me, branchId, branchCount).map((entry) => ({ href: entry.href, label: reportsText.items[entry.key].title, hrefs: [entry.href] })),
  );
  const stock = markActive(
    pathname,
    stockSections(me.role).map((section) => ({ href: section.href, label: stockText.hub.tabs[section.tab], hrefs: section.hrefs })),
  );
  return {
    ...(reports.length > 1 ? { reports } : {}),
    ...(stock.length > 1 ? { stock } : {}),
  };
}
