import type { Metadata } from "next";

import { AuthShell } from "@/features/auth/auth-shell";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

function pickToken(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" ? candidate.trim() : "";
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const token = pickToken((await searchParams).token);

  return (
    <AuthShell
      title="Choose a new password"
      description="Set a password for this account. You will be signed in straight away."
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
