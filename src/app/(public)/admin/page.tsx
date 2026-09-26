import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/features/auth/auth-shell";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Platform admin" };

export default function AdminLoginPage() {
  return (
    <AuthShell
      title="Platform admin"
      description="For the Qwicoo team. This entrance only accepts App Admin accounts."
      footer={
        <p>
          Restaurant accounts sign in at{" "}
          <Link href="/restaurant-dashboard" className="font-medium text-foreground underline underline-offset-4">
            the restaurant dashboard
          </Link>
          .
        </p>
      }
    >
      <LoginForm group="admin" />
    </AuthShell>
  );
}
