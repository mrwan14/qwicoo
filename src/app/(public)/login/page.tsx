import type { Metadata } from "next";

import { AuthShell } from "@/features/auth/auth-shell";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      description="Sign in once. We take you straight to your brand, your branch, or the Qwicoo platform."
      footer={
        <p>
          No account yet? Your brand or branch admin invites you by email, and the link sets your password.
        </p>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
