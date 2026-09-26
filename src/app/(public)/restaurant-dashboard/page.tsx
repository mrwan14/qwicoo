import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/features/auth/login-form";
import { ENTRY_GROUPS, RESTAURANT_GROUPS, isEntryGroup, type EntryGroup } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Restaurant dashboard" };

const GROUP_HINTS: Record<(typeof RESTAURANT_GROUPS)[number], string> = {
  brand: "Own or run a brand across branches",
  branch: "Run one branch day to day",
  staff: "Cashier, waiter, runner, or kitchen",
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

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="grid w-full max-w-md gap-6 rounded-2xl bg-card p-6 shadow-elev-1">
        <div>
          <Link href="/" className="text-sm font-semibold">
            Qwicoo
          </Link>
          <h1 className="text-[length:var(--text-28)] font-semibold">Restaurant dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {group ? `Signing in as ${ENTRY_GROUPS[group].label.toLowerCase()}.` : "Choose your role to sign in."}
          </p>
        </div>

        {group ? (
          <>
            <LoginForm group={group} />
            <Link href="/restaurant-dashboard" className="text-sm text-muted-foreground underline">
              Change role
            </Link>
          </>
        ) : (
          <nav aria-label="Role" className="grid gap-3">
            {RESTAURANT_GROUPS.map((key) => (
              <Link
                key={key}
                href={`/restaurant-dashboard?role=${key}`}
                className="grid min-h-16 gap-1 rounded-xl border px-4 py-3 hover:bg-muted"
              >
                <span className="font-medium">{ENTRY_GROUPS[key].label}</span>
                <span className="text-sm text-muted-foreground">{GROUP_HINTS[key]}</span>
              </Link>
            ))}
          </nav>
        )}
      </div>
    </main>
  );
}
