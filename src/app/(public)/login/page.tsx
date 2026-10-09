import type { Metadata } from "next";

import { AuthShell } from "@/features/auth/auth-shell";
import { LoginForm } from "@/features/auth/login-form";
import { authCopy } from "@/lib/i18n/staff/auth";

export const metadata: Metadata = { title: authCopy.en.login.metaTitle };

export default function LoginPage() {
  return (
    <AuthShell screen="login">
      <LoginForm />
    </AuthShell>
  );
}
