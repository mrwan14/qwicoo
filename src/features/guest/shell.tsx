"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Logo } from "@/components/ops/logo";
import { ErrorState, LoadingState } from "@/components/ops/states";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { guestCopy } from "@/features/guest/copy";
import { GuestAboutPanel, GuestDrawer, type GuestDrawerAction } from "@/features/guest/guest-drawer";
import { BillSheet, WaiterSheet } from "@/features/guest/service-sheets";
import { OrderingPausedNotice, isGuestUnreachable, useOrderingPaused } from "@/features/guest/ordering-status";
import { guestTableToken, isGuestSessionGone, recoverGuestSession } from "@/features/guest/session";
import { initials } from "@/lib/auth/scope";
import { accentForeground, mergeGuestBranding, sameBranding } from "@/lib/guest/branding";
import { mediaUrl } from "@/lib/media";
import { useGuest } from "@/stores/guest";

import "./guest.css";

export const guestField =
  "guest-pill h-12 w-full border border-[var(--guest-line)] bg-white px-4 text-base text-[var(--guest-ink)] shadow-[var(--guest-shadow-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--guest-orange)]";
export const guestPrimaryButton =
  "guest-pill guest-motion inline-flex min-h-14 w-full items-center justify-center bg-[var(--guest-orange)] px-5 text-base font-semibold text-white shadow-[var(--guest-shadow-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--guest-orange)] disabled:opacity-50";
export const guestSecondaryButton =
  "guest-pill guest-motion inline-flex min-h-14 w-full items-center justify-center border border-[var(--guest-line)] bg-white px-5 text-base font-medium text-[var(--guest-ink)] shadow-[var(--guest-shadow-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--guest-orange)] disabled:opacity-50";

export function useGuestCopy() {
  const locale = useGuest((state) => state.locale);
  const setLocale = useGuest((state) => state.setLocale);
  const dir = locale === "ar" ? "rtl" : "ltr";
  return { t: guestCopy[locale], locale, dir, setLocale };
}

export function useGuestPlaceLabel() {
  const { t } = useGuestCopy();
  const tableNumber = useGuest((state) => state.session?.tableNumber);
  return useMemo(() => {
    if (tableNumber) return t.tableLabel.replace("{n}", tableNumber);
    return t.driveThruLabel;
  }, [t.driveThruLabel, t.tableLabel, tableNumber]);
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

/** Quiet note when presence was not verified for this diner (rare after harden join). */
export function PresenceNote() {
  const { t } = useGuestCopy();
  const unverified = useGuest((state) => state.session?.presenceVerified === false);
  if (!unverified) return null;
  return (
    <p role="status" className="guest-card px-4 py-3 text-sm">
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
      {names.length > 0 ? <p className="text-[var(--guest-quiet)]">+ {names.join(", ")}</p> : null}
      {text ? (
        <p className="break-words rounded-[var(--guest-radius-thumb)] bg-[var(--secondary)] px-2 py-1">
          <span className="font-medium">{t.note}:</span> {text}
        </p>
      ) : null}
    </div>
  );
}

function BrandHeader() {
  const branding = useGuest((state) => state.branding);
  const branchName = useGuest((state) => state.session?.branchName ?? null);
  const placeLabel = useGuestPlaceLabel();
  const [logoFailed, setLogoFailed] = useState(false);
  const name = branding?.name ?? branchName;
  if (!name) {
    return (
      <span className="min-w-0">
        <Logo markClassName="size-7 text-[var(--guest-orange)]" wordClassName="text-2xl" />
        <p className="truncate text-sm text-[var(--guest-quiet)]">{placeLabel}</p>
      </span>
    );
  }

  const logo = branding?.logoUrl && !logoFailed ? mediaUrl(branding.logoUrl) : null;
  return (
    <span className="inline-flex min-w-0 items-center gap-3">
      <span className="guest-thumb flex size-11 shrink-0 items-center justify-center overflow-hidden bg-white text-sm font-semibold text-[var(--guest-ink)] shadow-[var(--guest-shadow-soft)]">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={name} className="size-full object-contain p-1" onError={() => setLogoFailed(true)} />
        ) : (
          <span aria-hidden>{initials(name)}</span>
        )}
      </span>
      <span className="min-w-0">
        <span className="guest-display block truncate text-xl text-[var(--guest-ink)]">{name}</span>
        <span className="block truncate text-sm text-[var(--guest-quiet)]">
          {[branchName && branding?.name ? branchName : null, placeLabel].filter(Boolean).join(" · ")}
        </span>
      </span>
    </span>
  );
}

export function RejoinTable({ message }: { message?: string }) {
  const { t } = useGuestCopy();
  const token = useGuest((state) => state.tableToken) ?? (typeof window === "undefined" ? null : guestTableToken());
  const [pending, setPending] = useState(false);

  async function rejoin() {
    if (!token) return;
    setPending(true);
    const ok = await recoverGuestSession();
    setPending(false);
    if (ok) {
      window.location.assign("/order");
      return;
    }
    window.location.assign(`/t/${encodeURIComponent(token)}`);
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm">{message ?? t.sessionGone}</p>
      {token ? (
        <button type="button" className={guestPrimaryButton} disabled={pending} onClick={() => void rejoin()}>
          {pending ? t.rejoining : t.rejoin}
        </button>
      ) : (
        <p className="text-sm text-[var(--guest-quiet)]">{t.scanAgain}</p>
      )}
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
      const ok = await recoverGuestSession();
      if (cancelled) return;
      if (!ok && (useGuest.getState().tableToken ?? guestTableToken())) setFailed(true);
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
  const placeLabel = useGuestPlaceLabel();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [waiterOpen, setWaiterOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);

  useEffect(() => {
    void useGuest.persist.rehydrate();
  }, []);

  const style = accent
    ? ({
        "--primary": accent,
        "--guest-orange": accent,
        "--primary-foreground": accentForeground(accent),
        "--ring": accent,
      } as CSSProperties)
    : undefined;

  function onDrawerAction(action: GuestDrawerAction) {
    if (action === "about") {
      setAboutOpen(true);
      return;
    }
    if (action === "waiter") {
      setWaiterOpen(true);
      return;
    }
    if (action === "bill") {
      setBillOpen(true);
      return;
    }
  }

  return (
    <div dir={dir} lang={locale} style={style} className="guest-theme min-h-dvh overflow-x-hidden">
      <header className="mx-auto flex w-full max-w-md items-start justify-between gap-3 px-4 py-4">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {!neutral ? (
            <button
              type="button"
              className="guest-pill guest-motion inline-flex size-11 shrink-0 items-center justify-center bg-white text-[var(--guest-ink)] shadow-[var(--guest-shadow-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--guest-orange)]"
              aria-label={t.openMenu}
              onClick={() => setDrawerOpen(true)}
            >
              <span aria-hidden className="flex flex-col gap-1.5">
                <span className="block h-0.5 w-5 rounded-full bg-current" />
                <span className="block h-0.5 w-5 rounded-full bg-current" />
                <span className="block h-0.5 w-5 rounded-full bg-current" />
              </span>
            </button>
          ) : null}
          {neutral ? <Logo markClassName="size-7 text-[var(--guest-orange)]" wordClassName="text-2xl" /> : <BrandHeader />}
        </div>
        <button
          type="button"
          className="guest-pill min-h-11 shrink-0 bg-white px-4 text-sm font-medium shadow-[var(--guest-shadow-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--guest-orange)]"
          onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
        >
          {t.language}
        </button>
      </header>
      <div className="mx-auto grid w-full max-w-md gap-4 px-4 py-4 pb-32">
        {paused ? <OrderingPausedNotice /> : null}
        <div>{resume ? <GuestResume>{children}</GuestResume> : children}</div>
      </div>
      {!neutral ? (
        <>
          <GuestDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            onAction={onDrawerAction}
            placeLabel={placeLabel}
          />
          <Sheet open={aboutOpen} onOpenChange={setAboutOpen}>
            <SheetContent
              side="bottom"
              showCloseButton={false}
              className="guest-theme mx-auto max-h-[85dvh] w-full max-w-md rounded-t-[var(--guest-radius-sheet)] border-0 bg-[var(--guest-canvas)] p-0 shadow-[var(--guest-shadow)]"
            >
              <SheetTitle className="sr-only">{t.about}</SheetTitle>
              <GuestAboutPanel placeLabel={placeLabel} />
              <div className="p-4">
                <button type="button" className={guestSecondaryButton} onClick={() => setAboutOpen(false)}>
                  {t.close}
                </button>
              </div>
            </SheetContent>
          </Sheet>
          <WaiterSheet open={waiterOpen} onOpenChange={setWaiterOpen} />
          <BillSheet open={billOpen} onOpenChange={setBillOpen} />
        </>
      ) : null}
    </div>
  );
}
