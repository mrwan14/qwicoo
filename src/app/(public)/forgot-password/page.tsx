import type { Metadata } from "next";

import { AuthShell } from "@/features/auth/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";
import { authCopy } from "@/lib/i18n/staff/auth";

export const metadata: Metadata = { title: authCopy.en.forgot.metaTitle };

export default function ForgotPasswordPage() {
  return (
    <AuthShell screen="forgot">
      <ForgotPasswordForm />
    </AuthShell>
  );
}
