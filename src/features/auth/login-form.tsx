"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fill } from "@/lib/i18n/dictionary";
import { useLocale } from "@/lib/i18n/locale-store";
import { authCopy } from "@/lib/i18n/staff/auth";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

/**
 * Plain email + password for every role. Credentials are never embedded here;
 * accounts come from the App Admin bootstrap (API side) or an email invitation.
 * Where the user lands is decided after sign-in from `/auth/me`.
 */
export function LoginForm() {
  const t = useStaffSection(authCopy);
  const { locale } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [lockUntil, setLockUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [pending, setPending] = useState(false);
  const flight = useRef(false);
  const attempt = useRef(0);

  useEffect(() => {
    if (lockUntil <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [lockUntil]);

  const waitMs = Math.max(0, lockUntil - now);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (flight.current || waitMs > 0) return;
    flight.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "accept-language": locale },
        body: JSON.stringify({ email, password }),
      });
      if (response.status === 429) {
        const delay = Math.min(1000 * 2 ** attempt.current, 16_000);
        attempt.current += 1;
        setLockUntil(Date.now() + delay);
        setError(t.login.tooMany);
        return;
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { detail?: unknown } | null;
        setError(typeof payload?.detail === "string" ? payload.detail : t.login.failed);
        return;
      }
      attempt.current = 0;
      window.location.assign("/app");
    } catch {
      setError(t.shared.unreachable);
    } finally {
      flight.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">{t.shared.email}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-11"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">{t.shared.password}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-11"
        />
      </div>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium underline underline-offset-4">
          {t.login.forgot}
        </Link>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
          {waitMs > 0 ? ` ${fill(t.login.retryIn, { seconds: Math.ceil(waitMs / 1000) })}` : null}
        </p>
      ) : null}
      <Button type="submit" className="min-h-11" disabled={pending || waitMs > 0}>
        {pending ? t.login.pending : t.login.submit}
      </Button>
    </form>
  );
}
