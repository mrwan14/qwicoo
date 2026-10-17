"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Coffee, Search, Users } from "lucide-react";
import { Logo } from "@/components/ops/logo";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { guestCopy } from "@/features/guest/copy";
import { GuestAboutPanel, GuestDrawer, type GuestDrawerAction } from "@/features/guest/guest-drawer";
import { BillSheet, WaiterSheet } from "@/features/guest/service-sheets";
import { GuestSkeleton, OrderingPausedNotice, isGuestUnreachable, useOrderingPaused } from "@/features/guest/ordering-status";
import { guestTableToken, isGuestSessionGone, recoverGuestSession } from "@/features/guest/session";
import { mergeGuestBranding, sameBranding } from "@/lib/guest/branding";
import { mediaUrl } from "@/lib/media";
import { useGuest } from "@/stores/guest";

import "./guest.css";

export const guestField = "guest-field guest-motion";
export const guestPrimaryButton = "guest-btn guest-btn-primary guest-motion";
export const guestSecondaryButton = "guest-btn guest-btn-secondary guest-motion";
export const guestGhostButton = "guest-btn guest-btn-ghost guest-motion";
export const guestIconButton = "guest-btn guest-btn-icon guest-motion";

const OpenDrawerContext = createContext<() => void>(() => {});

export function useOpenGuestDrawer() {
  return useContext(OpenDrawerContext);
}

const MenuChromeContext = createContext({ searchOpen: false, toggleSearch: () => {} });

export function useMenuChrome() {
  return useContext(MenuChromeContext);
}

function MenuTopBar() {
  const { t } = useGuestCopy();
  const openDrawer = useOpenGuestDrawer();
  const { searchOpen, toggleSearch } = useMenuChrome();
  const placeLabel = useGuestPlaceLabel();
  const branding = useGuest((state) => state.branding);
  const branchName = useGuest((state) => state.session?.branchName ?? null);
  const tableNumber = useGuest((state) => state.session?.tableNumber);
  const [logoFailed, setLogoFailed] = useState(false);
  const logo = branding?.logoUrl && !logoFailed ? mediaUrl(branding.logoUrl) : null;

  return (
    <header className="flex items-center gap-3 px-5 py-2">
      <button type="button" className="guest-menu-avatar guest-motion" aria-label={t.openMenu} onClick={openDrawer}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="size-full object-cover" onError={() => setLogoFailed(true)} />
        ) : (
          <Coffee className="size-5" aria-hidden />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="guest-menu-name truncate">{branding?.name || branchName || t.restaurant}</p>
        {branchName && branding?.name && branchName !== branding.name ? (
          <p className="truncate text-[11px] leading-[13px] text-[var(--guest-faint)]">{branchName}</p>
        ) : null}
      </div>
      {tableNumber ? (
        <span className="guest-badge guest-badge-place shrink-0 gap-1.5">
          <Users className="size-3" aria-hidden />
          {placeLabel}
        </span>
      ) : null}
      <button
        type="button"
        className="guest-menu-search guest-motion"
        aria-label={t.searchMenu}
        aria-pressed={searchOpen}
        onClick={toggleSearch}
      >
        <Search className="size-[18px]" aria-hidden />
      </button>
    </header>
  );
}

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
  const [logoFailed, setLogoFailed] = useState(false);
  const name = branding?.name ?? branchName;
  const branchCaption = branding?.name && branchName && branchName !== branding.name ? branchName : null;
  if (!name) {
    return <Logo markClassName="size-7 text-[var(--guest-orange)]" wordClassName="text-2xl" />;
  }

  const logo = branding?.logoUrl && !logoFailed ? mediaUrl(branding.logoUrl) : null;
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      {logo ? (
        <span className="guest-thumb flex size-9 shrink-0 items-center justify-center overflow-hidden bg-[var(--guest-sunken)] text-xs font-bold text-[var(--guest-ink)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" className="size-full object-contain p-0.5" onError={() => setLogoFailed(true)} />
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="guest-display block truncate text-[1.25rem]">{name}</span>
        {branchCaption ? <span className="guest-caption block truncate">{branchCaption}</span> : null}
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

  if (!ready) return <GuestSkeleton label={t.rejoining} />;
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
    if (token && !retried) return <GuestSkeleton label={t.rejoining} />;
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
    <div role="alert" className="guest-alert guest-alert-error grid gap-3">
      <h2 className="guest-display text-xl">{t.oopsTitle}</h2>
      <p className="guest-body">{error instanceof Error ? error.message : t.oops}</p>
      <button type="button" className={guestPrimaryButton} onClick={onRetry}>
        {t.retry}
      </button>
    </div>
  );
}

export function GuestShell({
  children,
  neutral = false,
  resume = !neutral,
  header = true,
  menu = false,
}: {
  children: ReactNode;
  neutral?: boolean;
  /** Recover a dropped table session. Off for pickup and the join form. */
  resume?: boolean;
  /** The join flow draws its own top bar. Menu and order keep this one. */
  header?: boolean;
  /** Menu screen draws the Palette F header itself. */
  menu?: boolean;
}) {
  const { t, locale, dir, setLocale } = useGuestCopy();
  const paused = useOrderingPaused();
  const placeLabel = useGuestPlaceLabel();
  const tableNumber = useGuest((state) => state.session?.tableNumber);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [waiterOpen, setWaiterOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);

  useEffect(() => {
    void useGuest.persist.rehydrate();
  }, []);

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
    <MenuChromeContext.Provider value={{ searchOpen, toggleSearch: () => setSearchOpen((open) => !open) }}>
    <OpenDrawerContext.Provider value={() => setDrawerOpen(true)}>
    <div dir={dir} lang={locale} className="guest-theme min-h-dvh">
      <div className="guest-phone">
        {menu ? <MenuTopBar /> : null}
        {header && !menu ? <header className="flex items-center justify-between gap-2.5 px-5 pb-1.5 pt-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {!neutral ? (
              <button
                type="button"
                className="guest-icon-btn guest-motion shrink-0"
                aria-label={t.openMenu}
                onClick={() => setDrawerOpen(true)}
              >
                <span aria-hidden className="flex flex-col gap-[5px]">
                  <span className="block h-[2px] w-4 rounded-full bg-current" />
                  <span className="block h-[2px] w-4 rounded-full bg-current" />
                  <span className="block h-[2px] w-4 rounded-full bg-current" />
                </span>
              </button>
            ) : null}
            {neutral ? <Logo markClassName="size-7 text-[var(--guest-orange)]" wordClassName="text-xl" /> : <BrandHeader />}
          </div>
          {!neutral && tableNumber ? (
            <span className="guest-badge guest-badge-place shrink-0">{placeLabel}</span>
          ) : null}
          <button
            type="button"
            className="guest-lang guest-motion shrink-0"
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
          >
            {t.language}
          </button>
        </header> : null}
        <div
          className={
            menu
              ? "grid min-w-0 px-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))]"
              : header
              ? "grid min-w-0 gap-3 px-5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-1"
              : "flex min-h-dvh flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4"
          }
        >
          {paused ? <OrderingPausedNotice /> : null}
          <div className={header ? undefined : "flex min-h-0 flex-1 flex-col"}>
            {resume ? <GuestResume>{children}</GuestResume> : children}
          </div>
        </div>
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
              className="guest-theme guest-sheet guest-phone mx-auto max-h-[90dvh] w-full border-0 p-0"
            >
              <div className="flex justify-center pt-3">
                <div className="guest-sheet-handle" aria-hidden />
              </div>
              <SheetTitle className="sr-only">{t.about}</SheetTitle>
              <GuestAboutPanel placeLabel={placeLabel} />
              <div className="guest-sheet-footer">
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
    </OpenDrawerContext.Provider>
    </MenuChromeContext.Provider>
  );
}
