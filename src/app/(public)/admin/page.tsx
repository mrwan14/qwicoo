import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Platform admin" };

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="grid w-full max-w-md gap-6 rounded-2xl bg-card p-6 shadow-elev-1">
        <div>
          <Link href="/" className="text-sm font-semibold">
            Qwicoo
          </Link>
          <h1 className="text-[length:var(--text-28)] font-semibold">Platform admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            For the Qwicoo team. Restaurant accounts sign in at{" "}
            <Link href="/restaurant-dashboard" className="underline">
              the restaurant dashboard
            </Link>
            .
          </p>
        </div>
        <LoginForm group="admin" />
      </div>
    </main>
  );
}
