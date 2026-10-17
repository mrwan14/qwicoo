"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ShieldAlert, CircleCheck } from "lucide-react";

import type { guestCopy } from "@/features/guest/copy";
import { GuestKeypad } from "@/features/guest/keypad";
import {
  decideAfterApiError,
  decideAfterGeolocation,
  decidePinJoin,
  geoOutcomeFromPosition,
  geoOutcomeFromPositionError,
  type JoinAction,
} from "@/features/guest/presence-join";
import { sessionStillValid, toGuestSession } from "@/features/guest/session";
import { GuestMotionSkeleton, GuestWelcome } from "@/features/guest/guest-motion";
import { guestPrimaryButton, useGuestCopy } from "@/features/guest/shell";
import type { components } from "@/lib/api/schema";
import { mergeGuestBranding } from "@/lib/guest/branding";
import { pickLocale } from "@/lib/i18n/locale-text";
import { useGuest } from "@/stores/guest";

type PresenceResponse = Omit<components["schemas"]["TableSessionResponse"], "session_token">;
type GuestText = (typeof guestCopy)[keyof typeof guestCopy];
type Step = "landing" | "permission" | "pin" | "blocked" | "joined";

const PIN_LENGTH = 6;

/** Only codes we have guest copy for get their own message; anything else is the same calm fallback. */
export function joinErrorMessage(code: string | null | undefined, t: GuestText): string {
  if (code === "OUT_OF_GEOFENCE" || code === "GEOLOCATION_REQUIRED") return t.outside;
  if (code === "INVALID_OR_EXPIRED_PIN") return t.badPin;
  if (code === "LOCATION_OR_PIN_REQUIRED") return t.locationOrPinRequired;
  if (code === "LOCATION_TOO_INACCURATE") return t.locationTooInaccurate;
  if (code === "PIN_LOCKED") return t.pinLocked;
  return t.tableCodeFailed;
}

function locationBlockedMessage(reason: "denied" | "timeout" | "unavailable" | "unsupported", t: GuestText): string {
  if (reason === "denied") return t.locationDenied;
  if (reason === "timeout") return t.locationTimeout;
  if (reason === "unsupported") return t.locationUnsupported;
  return t.locationUnavailable;
}

function fill(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

export function PresenceForm({ token }: { token: string }) {
  const router = useRouter();
  const { t, locale, setLocale } = useGuestCopy();
  const setSession = useGuest((state) => state.setSession);
  const storedToken = useGuest((state) => state.tableToken);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState<Step>("landing");
  const [checkingReturn, setCheckingReturn] = useState(true);
  const [preview, setPreview] = useState<{ branchName: string; tableNumber: string } | null>(null);
  const [previewSettled, setPreviewSettled] = useState(false);
  const [joined, setJoined] = useState<{ tableNumber: string; place: string } | null>(null);

  const place = preview?.branchName || t.restaurant;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await useGuest.persist.rehydrate();
      if (cancelled) return;
      const state = useGuest.getState();
      if (state.tableToken === token && state.session && (await sessionStillValid())) {
        if (!cancelled) router.replace("/order");
        return;
      }
      if (!cancelled) setCheckingReturn(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, storedToken, router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/guest/api/v1/qr/verify", {
          method: "POST",
          headers: { "content-type": "application/json", "accept-language": locale },
          body: JSON.stringify({ token }),
        });
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as components["schemas"]["QRVerificationResponse"];
        if (!payload.is_valid || cancelled) return;
        const branchName = pickLocale(payload.branch_name, locale);
        setPreview({
          branchName,
          tableNumber: payload.table_number ? String(payload.table_number) : "",
        });
      } catch {
        // The landing still works without a label. Joining still requires location or the PIN.
      } finally {
        if (!cancelled) setPreviewSettled(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, locale]);

  async function submit(
    action: JoinAction,
    coords?: { latitude: number; longitude: number; accuracy_m: number | null },
  ) {
    setPending(true);
    setError("");
    const body: components["schemas"]["TablePresenceVerifyRequest"] = {
      qr_token: token,
      ...(coords
        ? {
            client_latitude: coords.latitude,
            client_longitude: coords.longitude,
            ...(coords.accuracy_m != null ? { accuracy_m: coords.accuracy_m } : {}),
          }
        : {}),
      ...(pin.trim() ? { access_pin: pin.trim() } : {}),
    };
    try {
      const response = await fetch(`/api/guest/session/${action}`, {
        method: "POST",
        headers: { "content-type": "application/json", "accept-language": locale },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as PresenceResponse & { code?: string | null };
      if ([502, 503, 504].includes(response.status)) {
        setError(t.orderingPausedJoin);
        return;
      }
      if (!response.ok) {
        const effect = decideAfterApiError(payload.code, pin.trim());
        if (effect.type === "show_outside") {
          setStep("blocked");
          setError(t.outside);
          return;
        }
        if (effect.type === "api_error") {
          if (effect.revealPin && step !== "pin") setStep("blocked");
          setError(joinErrorMessage(effect.code, t));
          return;
        }
        setError(joinErrorMessage(payload.code, t));
        return;
      }
      const session = toGuestSession(payload);
      setSession(session);
      useGuest.getState().setTableToken(token);
      useGuest.getState().setBranding(mergeGuestBranding(null, payload));
      const branding = useGuest.getState().branding;
      const tableNumber = session.tableNumber || preview?.tableNumber || "";
      const joinedPlace = [branding?.name, session.branchName || preview?.branchName].filter(Boolean).join(" · ");
      setJoined({ tableNumber, place: joinedPlace });
      setStep("joined");
    } catch {
      setError(t.orderingPausedJoin);
    } finally {
      setPending(false);
    }
  }

  function applyGeoEffect(action: JoinAction, outcome: ReturnType<typeof geoOutcomeFromPosition> | ReturnType<typeof geoOutcomeFromPositionError> | { kind: "unsupported" }) {
    const effect = decideAfterGeolocation(action, outcome, pin.trim());
    if (effect.type === "submit") {
      void submit(effect.action, effect.coords);
      return;
    }
    if (effect.type === "submit_pin") {
      void submit(effect.action);
      return;
    }
    setPending(false);
    if (effect.type === "location_blocked") {
      setStep("blocked");
      setError(locationBlockedMessage(effect.reason, t));
    }
  }

  function locate(action: JoinAction) {
    setPending(true);
    setError("");
    if (!navigator.geolocation) {
      applyGeoEffect(action, { kind: "unsupported" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyGeoEffect(
          action,
          geoOutcomeFromPosition({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          }),
        );
      },
      (err) => {
        applyGeoEffect(action, geoOutcomeFromPositionError(err?.code));
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function joinWithPin() {
    if (pin.trim().length !== PIN_LENGTH) return;
    const effect = decidePinJoin(pin.trim());
    if (effect.type !== "submit_pin") return;
    void submit(effect.action);
  }

  if (checkingReturn || !previewSettled) {
    return <GuestMotionSkeleton label={t.verifying} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex items-center justify-between">
        {step === "landing" || step === "joined" ? (
          <span />
        ) : (
          <button type="button" className="guest-icon-btn guest-motion" aria-label={t.back} onClick={() => setStep("landing")}>
            <Chevron />
          </button>
        )}
        <button type="button" className="guest-lang guest-motion" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}>
          {t.language}
        </button>
      </div>

      {step === "landing" ? (
        <Landing
          welcome={t.presenceTitle}
          place={preview?.branchName}
          body={t.presenceBody}
          tableNumber={preview?.tableNumber}
          tableLabel={t.tableLabel}
          openMenu={t.openMenu}
          poweredBy={t.poweredBy}
          onOpen={() => {
            setError("");
            setStep("permission");
          }}
        />
      ) : null}

      {step === "permission" ? (
        <Prompt
          icon={<MapPin aria-hidden className="size-10 text-[var(--guest-orange-deep)]" />}
          tone="accent"
          title={t.confirmHere}
          body={fill(t.shareLocationBody, { place })}
          error={error}
          primary={pending ? t.verifying : t.shareLocation}
          primaryDisabled={pending}
          onPrimary={() => locate("verify")}
          secondary={t.enterPinInstead}
          onSecondary={() => {
            setError("");
            setStep("pin");
          }}
        />
      ) : null}

      {step === "pin" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-6">
          <div className="grid gap-2">
            <h1 className="guest-display guest-display-lg">{t.enterPin}</h1>
            <p className="guest-body">{t.pinAsk}</p>
          </div>
          <GuestKeypad value={pin} onChange={setPin} length={PIN_LENGTH} disabled={pending} />
          {error ? <p role="alert" className="guest-alert guest-alert-error text-sm">{error}</p> : null}
          <div className="mt-auto">
            <button
              type="button"
              className={guestPrimaryButton}
              disabled={pending || pin.trim().length !== PIN_LENGTH}
              onClick={joinWithPin}
            >
              {pending ? t.verifying : t.confirmPin}
            </button>
          </div>
        </div>
      ) : null}

      {step === "blocked" ? (
        <Prompt
          icon={<ShieldAlert aria-hidden className="size-10 text-[var(--guest-error)]" />}
          tone="error"
          title={t.blockedTitle}
          body={error || fill(t.blockedBody, { place })}
          primary={pending ? t.verifying : t.retry}
          primaryDisabled={pending}
          onPrimary={() => locate("verify")}
          secondary={t.enterPin}
          onSecondary={() => {
            setError("");
            setStep("pin");
          }}
        />
      ) : null}

      {step === "joined" && joined ? (
        <Prompt
          icon={<CircleCheck aria-hidden className="size-10 text-[var(--guest-sage)]" />}
          tone="ok"
          title={fill(t.joinedTitle, { n: joined.tableNumber })}
          body={joined.place}
          primary={t.seeMenu}
          onPrimary={() => router.push("/order")}
        />
      ) : null}
    </div>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 rtl:scale-x-[-1]" fill="none" aria-hidden>
      <path d="M14.5 6.5 9 12l5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Landing({
  welcome,
  place,
  body,
  tableNumber,
  tableLabel,
  openMenu,
  poweredBy,
  onOpen,
}: {
  welcome: string;
  place?: string;
  body: string;
  tableNumber?: string;
  tableLabel: string;
  openMenu: string;
  poweredBy: string;
  onOpen: () => void;
}) {
  return (
    <GuestWelcome
      kicker={place ? welcome : undefined}
      title={place || welcome}
      body={place ? undefined : body}
      badge={tableNumber ? fill(tableLabel, { n: tableNumber }) : undefined}
    >
      <button type="button" className={guestPrimaryButton} onClick={onOpen}>
        {openMenu}
      </button>
      <p className="text-center text-[11px] text-[var(--guest-faint)]">{poweredBy}</p>
    </GuestWelcome>
  );
}

function Prompt({
  icon,
  tone,
  title,
  body,
  error,
  primary,
  primaryDisabled,
  onPrimary,
  secondary,
  onSecondary,
}: {
  icon: ReactNode;
  tone: "accent" | "error" | "ok";
  title: string;
  body: string;
  error?: string;
  primary: string;
  primaryDisabled?: boolean;
  onPrimary: () => void;
  secondary?: string;
  onSecondary?: () => void;
}) {
  const circle =
    tone === "error"
      ? "bg-[var(--guest-error-soft)]"
      : tone === "ok"
        ? "bg-[var(--guest-success-soft)]"
        : "bg-[var(--guest-orange-soft)]";
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-2 text-center">
        <div className={`flex size-[8.75rem] items-center justify-center rounded-full ${circle}`}>{icon}</div>
        <div className="grid gap-2">
          <h1 className="guest-display guest-display-lg">{title}</h1>
          {body ? <p className="guest-body">{body}</p> : null}
        </div>
        {error ? <p role="alert" className="guest-alert guest-alert-error text-start text-sm">{error}</p> : null}
      </div>
      <div className="grid gap-3">
        <button type="button" className={guestPrimaryButton} disabled={primaryDisabled} onClick={onPrimary}>
          {primary}
        </button>
        {secondary && onSecondary ? (
          <button type="button" className="min-h-11 text-[15px] font-semibold text-[var(--guest-orange-deep)]" onClick={onSecondary}>
            {secondary}
          </button>
        ) : null}
      </div>
    </div>
  );
}
