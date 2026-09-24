import type { Metadata } from "next";

import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="grid w-full max-w-md gap-6 rounded-2xl bg-card p-6 shadow-elev-1">
        <div>
          <p className="text-sm font-semibold">Qwicoo</p>
          <h1 className="text-[length:var(--text-28)] font-semibold">Sign in</h1>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
