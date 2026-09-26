import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ChevronRight, ConciergeBell, Store, type LucideIcon } from "lucide-react";

import { AuthShell } from "@/features/auth/auth-shell";
import { LoginForm } from "@/features/auth/login-form";
import { ENTRY_GROUPS, RESTAURANT_GROUPS, isEntryGroup, type EntryGroup } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Restaurant dashboard" };

type RestaurantGroup = (typeof RESTAURANT_GROUPS)[number];

const GROUP_HINTS: Record<RestaurantGroup, string> = {
  brand: "Own or run a brand across branches",
  branch: "Run one branch day to day",
  staff: "Cashier, waiter, runner, or kitchen",
};

const GROUP_ICONS: Record<RestaurantGroup, LucideIcon> = {
  brand: Building2,
  branch: Store,
  staff: ConciergeBell,
};

function pickGroup(value: string | string[] | undefined): EntryGroup | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!isEntryGroup(candidate) || candidate === "admin") return null;
  return candidate;
}

export default async function RestaurantDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string | string[] }>;
}) {
  const group = pickGroup((await searchParams).role);

  if (!group) {
    return (
      <AuthShell
        title="Restaurant dashboard"
        description="Choose how you work with the restaurant, then sign in."
        surface="plain"
        footer={
          <p>
            No account yet? Your brand or branch admin invites you by email, and the link sets your password.
          </p>
        }
      >
        <nav aria-label="Role" className="grid gap-3">
          {RESTAURANT_GROUPS.map((key) => {
            const Icon = GROUP_ICONS[key];
            return (
              <Link
                key={key}
                href={`/restaurant-dashboard?role=${key}`}
                className="group flex min-h-16 items-center gap-4 rounded-xl border bg-card px-4 py-4 shadow-elev-1 transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
                >
                  <Icon className="size-5" />
                </span>
                <span className="grid gap-0.5">
                  <span className="font-medium">{ENTRY_GROUPS[key].label}</span>
                  <span className="text-sm text-muted-foreground">{GROUP_HINTS[key]}</span>
                </span>
                <ChevronRight
                  aria-hidden
                  className="ms-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100"
                />
              </Link>
            );
          })}
        </nav>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={ENTRY_GROUPS[group].label}
      description={`Sign in with your ${ENTRY_GROUPS[group].label.toLowerCase()} account.`}
      footer={
        <Link
          href="/restaurant-dashboard"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Change role
        </Link>
      }
    >
      <LoginForm group={group} />
    </AuthShell>
  );
}
