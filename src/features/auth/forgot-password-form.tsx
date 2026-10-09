"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/lib/i18n/locale-store";
import { authCopy } from "@/lib/i18n/staff/auth";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

export function ForgotPasswordForm() {
  const t = useStaffSection(authCopy);
  const { locale } = useLocale();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const flight = useRef(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (flight.current) return;
    flight.current = true;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json", "accept-language": locale },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: unknown; detail?: unknown } | null;
      if (response.status === 429) {
        setError(t.forgot.retryMinute);
        return;
      }
      if (response.status === 422) {
        setError(typeof payload?.detail === "string" ? payload.detail : t.forgot.invalidEmail);
        return;
      }
      if (!response.ok) {
        setError(typeof payload?.detail === "string" ? payload.detail : t.forgot.sendFailed);
        return;
      }
      setMessage(t.forgot.sent);
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
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-11"
        />
      </div>
      {message ? (
        <p role="status" className="rounded-xl border bg-secondary p-4 text-sm">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? t.forgot.pending : t.forgot.submit}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {t.forgot.remembered}{" "}
        <Link href="/login" className="underline">
          {t.shared.signIn}
        </Link>
        .
      </p>
    </form>
  );
}
