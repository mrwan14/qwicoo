import type { Metadata } from "next";
import Link from "next/link";

import { AcceptInviteForm } from "@/features/auth/accept-invite-form";

export const metadata: Metadata = { title: "Accept your invitation" };

function pickToken(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" ? candidate.trim() : "";
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const token = pickToken((await searchParams).token);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="grid w-full max-w-md gap-6 rounded-2xl bg-card p-6 shadow-elev-1">
        <div>
          <Link href="/" className="text-sm font-semibold">
            Qwicoo
          </Link>
          <h1 className="text-[length:var(--text-28)] font-semibold">Welcome to the team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set a password to finish creating your account.
          </p>
        </div>
        <AcceptInviteForm token={token} />
      </div>
    </main>
  );
}
