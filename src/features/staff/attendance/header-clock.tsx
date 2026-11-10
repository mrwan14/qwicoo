"use client";

import type { NavItem } from "@/lib/nav";

import { useMyAttendance } from "./clock";
import { ClockChip } from "./clock-panel";

/** The clock chip in the admin header, for roles that clock in (branch managers). Compact on small screens. */
export function HeaderClock({ items }: { items: readonly NavItem[] }) {
  const canClock = items.some((item) => item.href === "/app/attendance");
  const attendance = useMyAttendance({ enabled: canClock });
  if (!canClock) return null;
  return (
    <>
      <span className="sm:hidden">
        <ClockChip attendance={attendance} tillHref="/app/attendance?till=1" compact />
      </span>
      <span className="hidden sm:inline-flex">
        <ClockChip attendance={attendance} tillHref="/app/attendance?till=1" />
      </span>
    </>
  );
}
