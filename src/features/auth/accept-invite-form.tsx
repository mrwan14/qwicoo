"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { components } from "@/lib/api/schema";
import { roleLabel } from "@/lib/auth/roles";

type Preview = components["schemas"]["InvitationPreviewResponse"];

type PreviewState =
  | { kind: "loading" }
  | { kind: "ready"; preview: Preview }
  | { kind: "invalid"; message: string; expired: boolean };

const MIN_PASSWORD = 8;

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function InvalidInvite({ message, expired }: { message: string; expired: boolean }) {
  return (
    <div className="grid gap-4">
      <div role="alert" className="rounded-xl border border-destructive/40 bg-background p-4">
        <p className="font-medium">{expired ? "This invitation has expired" : "This link does not work"}</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/restaurant-dashboard" className="underline">
          Sign in
        </Link>
        .
      </p>
    </div>
  );
}

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, setState] = useState<PreviewState>(() =>
    token
      ? { kind: "loading" }
      : { kind: "invalid", message: "The link is missing its invitation code. Open the link from your email again.", expired: false },
  );
  const [fullName, setFullName] = useState("");
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
        const response = await fetch(`/api/invite/preview?token=${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as (Preview & { detail?: unknown }) | null;
        if (cancelled) return;
        if (!response.ok || !payload || typeof payload.email !== "string") {
          setState({
            kind: "invalid",
            message: typeof payload?.detail === "string" ? payload.detail : "Could not load this invitation.",
            expired: response.status === 410,
          });
          return;
        }
        setState({ kind: "ready", preview: payload });
        setFullName(payload.full_name ?? "");
      } catch {
        if (!cancelled) {
          setState({ kind: "invalid", message: "The app could not reach the sign-in service. Try again in a moment.", expired: false });
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
        <span className="sr-only">Loading your invitation</span>
      </div>
    );
  }

  if (state.kind === "invalid") {
    return <InvalidInvite message={state.message} expired={state.expired} />;
  }

  const { preview } = state;
  const needsName = !preview.full_name;
  const scope = [preview.brand_name, preview.branch_name].filter(Boolean).join(" · ");
  const expiry = formatExpiry(preview.expires_at);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (flight.current) return;
    setError("");
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    if (needsName && !fullName.trim()) {
      setError("Enter your name.");
      return;
    }
    flight.current = true;
    setPending(true);
    try {
      const response = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password, full_name: fullName.trim() || undefined }),
      });
      const payload = (await response.json().catch(() => null)) as { detail?: unknown; home?: unknown } | null;
      if (!response.ok) {
        const message = typeof payload?.detail === "string" ? payload.detail : "Could not accept this invitation.";
        if (response.status === 404 || response.status === 410) {
          setState({ kind: "invalid", message, expired: response.status === 410 });
        } else {
          setError(message);
        }
        return;
      }
      window.location.assign(typeof payload?.home === "string" ? payload.home : "/app");
    } catch {
      setError("The app could not reach the sign-in service.");
    } finally {
      flight.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <dl className="grid gap-2 rounded-xl bg-secondary p-4 text-sm">
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Role</dt>
          <dd className="font-medium">{roleLabel(preview.role)}</dd>
        </div>
        {scope ? (
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Where</dt>
            <dd className="font-medium">{scope}</dd>
          </div>
        ) : null}
        {expiry ? (
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Link valid until</dt>
            <dd>{expiry}</dd>
          </div>
        ) : null}
      </dl>

      <div className="grid gap-2">
        <Label htmlFor="invite-email">Email</Label>
        <Input id="invite-email" type="email" value={preview.email} readOnly autoComplete="username" className="h-11 bg-muted" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="invite-name">Full name</Label>
        <Input
          id="invite-name"
          name="full_name"
          autoComplete="name"
          required={needsName}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className="h-11"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="invite-password">Password</Label>
        <Input
          id="invite-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-11"
        />
        <p className="text-xs text-muted-foreground">At least {MIN_PASSWORD} characters.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="invite-confirm">Confirm password</Label>
        <Input
          id="invite-confirm"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          className="h-11"
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Setting up your account…" : "Set password and sign in"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Wrong person?{" "}
        <Link href="/restaurant-dashboard" className="underline">
          Sign in to a different account
        </Link>
        .
      </p>
    </form>
  );
}
