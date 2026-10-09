import type { Metadata } from "next";

import { AuthShell } from "@/features/auth/auth-shell";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { authCopy } from "@/lib/i18n/staff/auth";

export const metadata: Metadata = { title: authCopy.en.reset.metaTitle };

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
    <AuthShell screen="reset">
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
