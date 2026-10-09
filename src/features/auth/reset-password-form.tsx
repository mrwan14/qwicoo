"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";
import { fill } from "@/lib/i18n/dictionary";
import { formatCairoDateTime } from "@/lib/i18n/format";
import { useLocale } from "@/lib/i18n/locale-store";
import { authCopy } from "@/lib/i18n/staff/auth";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

type Preview = { email: string; expires_at: string };

type PreviewState =
  | { kind: "loading" }
  | { kind: "ready"; preview: Preview }
  | { kind: "invalid"; message: string; expired: boolean };

function formatExpiry(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formatCairoDateTime(iso, locale);
}

function UnusableLink({ message, expired }: { message: string; expired: boolean }) {
  const t = useStaffSection(authCopy);
  return (
    <div className="grid gap-4">
      <div role="alert" className="rounded-xl border border-destructive/40 bg-background p-4">
        <p className="font-medium">{expired ? t.reset.expired : t.shared.linkBroken}</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        <Link href="/forgot-password" className="underline">
          {t.reset.requestNew}
        </Link>
        .
      </p>
    </div>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useStaffSection(authCopy);
  const { locale } = useLocale();
  const [state, setState] = useState<PreviewState>({ kind: "loading" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const flight = useRef(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/auth/reset-password/preview?token=${encodeURIComponent(token)}`, {
          cache: "no-store",
          headers: { "accept-language": locale },
        });
        const payload = (await response.json().catch(() => null)) as (Preview & { detail?: unknown }) | null;
        if (cancelled) return;
        if (!response.ok || !payload || typeof payload.email !== "string") {
          setState({
            kind: "invalid",
            message: typeof payload?.detail === "string" ? payload.detail : t.reset.openFailed,
            expired: response.status === 410,
          });
          return;
        }
        setState({ kind: "ready", preview: { email: payload.email, expires_at: payload.expires_at } });
      } catch {
        if (!cancelled) {
          setState({
            kind: "invalid",
            message: t.shared.unreachableRetry,
            expired: false,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, locale, t.reset.openFailed, t.shared.unreachableRetry]);

  if (!token) {
    return <UnusableLink message={t.reset.missing} expired={false} />;
  }

  if (state.kind === "loading") {
    return (
      <div role="status" aria-live="polite" className="grid gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <span className="sr-only">{t.reset.loading}</span>
      </div>
    );
  }

  if (state.kind === "invalid") {
    return <UnusableLink message={state.message} expired={state.expired} />;
  }

  const { preview } = state;
  const expiry = formatExpiry(preview.expires_at, locale);
  const lengthOk = password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
  const matches = password.length > 0 && password === confirm;
  const canSubmit = lengthOk && matches && !pending;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (flight.current || !canSubmit) return;
    setError("");
    flight.current = true;
    setPending(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json", "accept-language": locale },
        body: JSON.stringify({ token, password }),
      });
      const payload = (await response.json().catch(() => null)) as { detail?: unknown } | null;
      if (!response.ok) {
        const message = typeof payload?.detail === "string" ? payload.detail : t.reset.failed;
        if (response.status === 404 || response.status === 410) {
          setState({ kind: "invalid", message, expired: response.status === 410 });
        } else {
          setError(message);
        }
        return;
      }
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
      {expiry ? (
        <dl className="grid gap-2 rounded-xl bg-secondary p-4 text-sm">
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">{t.shared.validUntil}</dt>
            <dd>{expiry}</dd>
          </div>
        </dl>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="reset-email">{t.shared.email}</Label>
        <Input id="reset-email" type="email" value={preview.email} readOnly autoComplete="username" className="h-11 bg-muted" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="reset-password">{t.reset.newPassword}</Label>
        <Input
          id="reset-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={MAX_PASSWORD_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-11"
        />
        <p className="text-xs text-muted-foreground">
          {fill(t.reset.lengthHint, { min: MIN_PASSWORD_LENGTH, max: MAX_PASSWORD_LENGTH })}
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="reset-confirm">{t.shared.confirmPassword}</Label>
        <Input
          id="reset-confirm"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          maxLength={MAX_PASSWORD_LENGTH}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          aria-invalid={confirm.length > 0 && password !== confirm}
          className="h-11"
        />
        {confirm.length > 0 && password !== confirm ? (
          <p className="text-xs text-muted-foreground">{t.reset.mismatch}</p>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="min-h-11" disabled={!canSubmit}>
        {pending ? t.reset.pending : t.reset.submit}
      </Button>
    </form>
  );
}
