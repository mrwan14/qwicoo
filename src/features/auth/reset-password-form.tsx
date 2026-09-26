"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";

type Preview = { email: string; expires_at: string };

type PreviewState =
  | { kind: "loading" }
  | { kind: "ready"; preview: Preview }
  | { kind: "invalid"; message: string; expired: boolean };

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function UnusableLink({ message, expired }: { message: string; expired: boolean }) {
  return (
    <div className="grid gap-4">
      <div role="alert" className="rounded-xl border border-destructive/40 bg-background p-4">
        <p className="font-medium">{expired ? "This reset link has expired" : "This link does not work"}</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        <Link href="/forgot-password" className="underline">
          Request a new link
        </Link>
        .
      </p>
    </div>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, setState] = useState<PreviewState>(() =>
    token
      ? { kind: "loading" }
      : {
          kind: "invalid",
          message: "This link is missing its reset code. Open the link from your email again.",
          expired: false,
        },
  );
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
        });
        const payload = (await response.json().catch(() => null)) as (Preview & { detail?: unknown }) | null;
        if (cancelled) return;
        if (!response.ok || !payload || typeof payload.email !== "string") {
          setState({
            kind: "invalid",
            message: typeof payload?.detail === "string" ? payload.detail : "Could not open this reset link.",
            expired: response.status === 410,
          });
          return;
        }
        setState({ kind: "ready", preview: { email: payload.email, expires_at: payload.expires_at } });
      } catch {
        if (!cancelled) {
          setState({
            kind: "invalid",
            message: "The app could not reach the sign-in service. Try again in a moment.",
            expired: false,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.kind === "loading") {
    return (
      <div role="status" aria-live="polite" className="grid gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <span className="sr-only">Loading this reset link</span>
      </div>
    );
  }

  if (state.kind === "invalid") {
    return <UnusableLink message={state.message} expired={state.expired} />;
  }

  const { preview } = state;
  const expiry = formatExpiry(preview.expires_at);
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
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const payload = (await response.json().catch(() => null)) as { detail?: unknown } | null;
      if (!response.ok) {
        const message = typeof payload?.detail === "string" ? payload.detail : "Could not reset this password.";
        if (response.status === 404 || response.status === 410) {
          setState({ kind: "invalid", message, expired: response.status === 410 });
        } else {
          setError(message);
        }
        return;
      }
      window.location.assign("/app");
    } catch {
      setError("The app could not reach the sign-in service.");
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
            <dt className="text-muted-foreground">Link valid until</dt>
            <dd>{expiry}</dd>
          </div>
        </dl>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="reset-email">Email</Label>
        <Input id="reset-email" type="email" value={preview.email} readOnly autoComplete="username" className="h-11 bg-muted" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="reset-password">New password</Label>
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
          {MIN_PASSWORD_LENGTH}–{MAX_PASSWORD_LENGTH} characters.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="reset-confirm">Confirm password</Label>
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
          <p className="text-xs text-muted-foreground">Passwords must match.</p>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="min-h-11" disabled={!canSubmit}>
        {pending ? "Saving your password…" : "Save password and sign in"}
      </Button>
    </form>
  );
}
