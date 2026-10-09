"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { components } from "@/lib/api/schema";
import { roleLabel } from "@/lib/auth/roles";
import { fill } from "@/lib/i18n/dictionary";
import { formatCairoDateTime } from "@/lib/i18n/format";
import { useLocale } from "@/lib/i18n/locale-store";
import { authCopy } from "@/lib/i18n/staff/auth";
import { useStaffSection } from "@/lib/i18n/staff/use-copy";

type Preview = components["schemas"]["InvitationPreviewResponse"];

type PreviewState =
  | { kind: "loading" }
  | { kind: "ready"; preview: Preview }
  | { kind: "invalid"; message: string; expired: boolean };

const MIN_PASSWORD = 8;

function formatExpiry(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formatCairoDateTime(iso, locale);
}

function InvalidInvite({ message, expired }: { message: string; expired: boolean }) {
  const t = useStaffSection(authCopy);
  return (
    <div className="grid gap-4">
      <div role="alert" className="rounded-xl border border-destructive/40 bg-background p-4">
        <p className="font-medium">{expired ? t.invite.expired : t.shared.linkBroken}</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        {t.invite.already}{" "}
        <Link href="/login" className="underline">
          {t.shared.signIn}
        </Link>
        .
      </p>
    </div>
  );
}

export function AcceptInviteForm({ token }: { token: string }) {
  const t = useStaffSection(authCopy);
  const { locale } = useLocale();
  const [state, setState] = useState<PreviewState>({ kind: "loading" });
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
          headers: { "accept-language": locale },
        });
        const payload = (await response.json().catch(() => null)) as (Preview & { detail?: unknown }) | null;
        if (cancelled) return;
        if (!response.ok || !payload || typeof payload.email !== "string") {
          setState({
            kind: "invalid",
            message: typeof payload?.detail === "string" ? payload.detail : t.invite.loadFailed,
            expired: response.status === 410,
          });
          return;
        }
        setState({ kind: "ready", preview: payload });
        setFullName((current) => (current.trim() ? current : (payload.full_name ?? "")));
      } catch {
        if (!cancelled) {
          setState({ kind: "invalid", message: t.shared.unreachableRetry, expired: false });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, locale, t.invite.loadFailed, t.shared.unreachableRetry]);

  if (!token) {
    return <InvalidInvite message={t.invite.missing} expired={false} />;
  }

  if (state.kind === "loading") {
    return (
      <div role="status" aria-live="polite" className="grid gap-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <span className="sr-only">{t.invite.loading}</span>
      </div>
    );
  }

  if (state.kind === "invalid") {
    return <InvalidInvite message={state.message} expired={state.expired} />;
  }

  const { preview } = state;
  const needsName = !preview.full_name;
  const scope = [preview.brand_name, preview.branch_name].filter(Boolean).join(" · ");
  const expiry = formatExpiry(preview.expires_at, locale);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (flight.current) return;
    setError("");
    if (password.length < MIN_PASSWORD) {
      setError(fill(t.invite.tooShort, { min: MIN_PASSWORD }));
      return;
    }
    if (password !== confirm) {
      setError(t.invite.mismatch);
      return;
    }
    if (needsName && !fullName.trim()) {
      setError(t.invite.nameRequired);
      return;
    }
    flight.current = true;
    setPending(true);
    try {
      const response = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "content-type": "application/json", "accept-language": locale },
        body: JSON.stringify({ token, password, full_name: fullName.trim() || undefined }),
      });
      const payload = (await response.json().catch(() => null)) as { detail?: unknown; home?: unknown } | null;
      if (!response.ok) {
        const message = typeof payload?.detail === "string" ? payload.detail : t.invite.failed;
        if (response.status === 404 || response.status === 410) {
          setState({ kind: "invalid", message, expired: response.status === 410 });
        } else {
          setError(message);
        }
        return;
      }
      window.location.assign(typeof payload?.home === "string" ? payload.home : "/app");
    } catch {
      setError(t.shared.unreachable);
    } finally {
      flight.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <dl className="grid gap-2 rounded-xl bg-secondary p-4 text-sm">
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">{t.invite.role}</dt>
          <dd className="font-medium">{roleLabel(preview.role, locale)}</dd>
        </div>
        {scope ? (
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">{t.invite.where}</dt>
            <dd className="font-medium">{scope}</dd>
          </div>
        ) : null}
        {expiry ? (
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">{t.shared.validUntil}</dt>
            <dd>{expiry}</dd>
          </div>
        ) : null}
      </dl>

      <div className="grid gap-2">
        <Label htmlFor="invite-email">{t.shared.email}</Label>
        <Input id="invite-email" type="email" value={preview.email} readOnly autoComplete="username" className="h-11 bg-muted" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="invite-name">{t.invite.fullName}</Label>
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
        <Label htmlFor="invite-password">{t.shared.password}</Label>
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
        <p className="text-xs text-muted-foreground">{fill(t.invite.lengthHint, { min: MIN_PASSWORD })}</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="invite-confirm">{t.shared.confirmPassword}</Label>
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
        {pending ? t.invite.pending : t.invite.submit}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {t.invite.wrongPerson}{" "}
        <Link href="/login" className="underline">
          {t.invite.differentAccount}
        </Link>
        .
      </p>
    </form>
  );
}
