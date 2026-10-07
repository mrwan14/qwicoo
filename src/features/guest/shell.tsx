"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import { Logo } from "@/components/ops/logo";
import { ErrorState, LoadingState } from "@/components/ops/states";
import { guestCopy } from "@/features/guest/copy";
import { OrderingPausedNotice, isGuestUnreachable, useOrderingPaused } from "@/features/guest/ordering-status";
import { guestTableToken, isGuestSessionGone, recoverGuestSession } from "@/features/guest/session";
import { initials } from "@/lib/auth/scope";
import { accentForeground, mergeGuestBranding, sameBranding } from "@/lib/guest/branding";
import { mediaUrl } from "@/lib/media";
import { useGuest } from "@/stores/guest";

export const guestField =
  "h-12 w-full rounded-xl border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
export const guestPrimaryButton =
  "inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-primary px-5 text-base font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50";
export const guestSecondaryButton =
  "inline-flex min-h-14 w-full items-center justify-center rounded-xl border bg-card px-5 text-base font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50";

export function useGuestCopy() {
  const locale = useGuest((state) => state.locale);
  const setLocale = useGuest((state) => state.setLocale);
  const dir = locale === "ar" ? "rtl" : "ltr";
  return { t: guestCopy[locale], locale, dir, setLocale };
}

/** Fold any branding a guest-safe response carries into the guest store. */
export function useAbsorbBranding(payload: unknown) {
  useEffect(() => {
    if (!payload) return;
    const { branding, setBranding } = useGuest.getState();
    const next = mergeGuestBranding(branding, payload);
    if (!sameBranding(branding, next)) setBranding(next);
  }, [payload]);
}

/** Shown when the guest joined without a confirmed location, so staff confirm their orders. */
export function PresenceNote() {
  const { t } = useGuestCopy();
  const unverified = useGuest((state) => state.session?.presenceVerified === false);
  if (!unverified) return null;
  return (
    <p role="status" className="rounded-xl bg-secondary px-4 py-3 text-sm">
      {t.locationNote}
    </p>
  );
}

export function LineDetails({ modifiers, note }: { modifiers: readonly string[]; note?: string | null }) {
  const { t } = useGuestCopy();
  const names = modifiers.filter(Boolean);
  const text = note?.trim();
  if (names.length === 0 && !text) return null;
  return (
    <div className="mt-1 grid gap-1 text-sm">
      {names.length > 0 ? <p className="text-muted-foreground">+ {names.join(", ")}</p> : null}
      {text ? (
        <p className="break-words rounded-lg bg-secondary px-2 py-1">
          <span className="font-medium">{t.note}:</span> {text}
        </p>
      ) : null}
    </div>
  );
}

function BrandHeader() {
  const branding = useGuest((state) => state.branding);
  const branchName = useGuest((state) => state.session?.branchName ?? null);
  const [logoFailed, setLogoFailed] = useState(false);
  const name = branding?.name ?? branchName;
  if (!name) return <Logo markClassName="size-7 text-primary" wordClassName="text-2xl" />;

  const logo = branding?.logoUrl && !logoFailed ? mediaUrl(branding.logoUrl) : null;
  return (
    <span className="inline-flex min-w-0 items-center gap-3">
      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-sm font-semibold text-primary">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={name} className="size-full object-contain p-1" onError={() => setLogoFailed(true)} />
        ) : (
          <span aria-hidden>{initials(name)}</span>
        )}
      </span>
      <span className="truncate font-display text-2xl">{name}</span>
    </span>
  );
}

export function RejoinTable({ message }: { message?: string }) {
  const { t } = useGuestCopy();
  const token = useGuest((state) => state.tableToken) ?? (typeof window === "undefined" ? null : guestTableToken());
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function rejoin() {
    if (!token) return;
    setPending(true);
    setFailed(false);
    const ok = await recoverGuestSession();
    setPending(false);
    if (!ok) setFailed(true);
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm">{message ?? t.sessionGone}</p>
      {token ? (
        <button
          type="button"
          className={guestPrimaryButton}
          disabled={pending}
          onClick={() => void rejoin()}
        >
          {pending ? t.rejoining : t.rejoin}
        </button>
      ) : (
        <p className="text-sm text-muted-foreground">{t.scanAgain}</p>
      )}
      {failed ? <p className="text-sm text-muted-foreground">{t.tableCodeFailed}</p> : null}
    </div>
  );
}

/** Recovers a dropped guest cookie using the stored or URL table token. */
export function GuestResume({ children }: { children: ReactNode }) {
  const { t } = useGuestCopy();
  const session = useGuest((state) => state.session);
  const storedToken = useGuest((state) => state.tableToken);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve(useGuest.persist.rehydrate()).then(async () => {
      if (cancelled) return;
      const current = useGuest.getState();
      if (current.session) {
        setReady(true);
        return;
      }
      const token = current.tableToken ?? guestTableToken();
      if (!token) {
        setReady(true);
        return;
      }
      const ok = await recoverGuestSession();
      if (cancelled) return;
      if (!ok) setFailed(true);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [storedToken]);

  if (!ready) return <LoadingState label={t.rejoining} />;
  if (session) return children;
  return <RejoinTable message={failed ? t.sessionGone : undefined} />;
}

export function GuestQueryError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const { t } = useGuestCopy();
  const gone = isGuestSessionGone(error);
  const paused = useOrderingPaused();
  const token = useGuest((state) => state.tableToken);
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    if (!gone || !token || retried) return;
    setRetried(true);
    void recoverGuestSession().then((ok) => {
      if (ok) onRetry();
    });
  }, [gone, token, retried, onRetry]);

  if (gone) {
    if (token && !retried) return <LoadingState label={t.rejoining} />;
    return <RejoinTable />;
  }

  if (isGuestUnreachable(error)) {
    // The shell already shows the paused notice when it has noticed; just offer a retry then.
    if (paused) {
      return (
        <button type="button" className={guestSecondaryButton} onClick={onRetry}>
          {t.retry}
        </button>
      );
    }
    return <OrderingPausedNotice onRetry={onRetry} retryLabel={t.retry} />;
  }

  return (
    <ErrorState
      title={t.oopsTitle}
      body={error instanceof Error ? error.message : t.oops}
      onRetry={onRetry}
      retryLabel={t.retry}
    />
  );
}

export function GuestShell({
  children,
  neutral = false,
  resume = !neutral,
}: {
  children: ReactNode;
  neutral?: boolean;
  /** Recover a dropped table session. Off for pickup and the join form. */
  resume?: boolean;
}) {
  const { t, locale, dir, setLocale } = useGuestCopy();
  const accent = useGuest((state) => (neutral ? null : (state.branding?.accent ?? null)));
  const paused = useOrderingPaused();

  useEffect(() => {
    void useGuest.persist.rehydrate();
  }, []);

  const style = accent
    ? ({
        "--primary": accent,
        "--primary-foreground": accentForeground(accent),
        "--ring": accent,
      } as CSSProperties)
    : undefined;

  return (
    <div dir={dir} lang={locale} style={style} className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 py-4">
        {neutral ? <Logo markClassName="size-7 text-primary" wordClassName="text-2xl" /> : <BrandHeader />}
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-xl border bg-card px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
        >
          {t.language}
        </button>
      </header>
      <div className="mx-auto grid w-full max-w-md gap-4 px-4 py-4 pb-32">
        {paused ? <OrderingPausedNotice /> : null}
        <div>{resume ? <GuestResume>{children}</GuestResume> : children}</div>
      </div>
    </div>
  );
}
