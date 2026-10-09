import type { Metadata } from "next";

import { AcceptInviteForm } from "@/features/auth/accept-invite-form";
import { AuthShell } from "@/features/auth/auth-shell";
import { authCopy } from "@/lib/i18n/staff/auth";

export const metadata: Metadata = { title: authCopy.en.invite.metaTitle };

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
    <AuthShell screen="invite">
      <AcceptInviteForm token={token} />
    </AuthShell>
  );
}
