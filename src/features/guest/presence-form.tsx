"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { guestCopy } from "@/features/guest/copy";
import {
  decideAfterApiError,
  decideAfterGeolocation,
  decidePinJoin,
  geoOutcomeFromPosition,
  geoOutcomeFromPositionError,
  pinJoinEnabled,
  type JoinAction,
} from "@/features/guest/presence-join";
import { sessionStillValid, toGuestSession } from "@/features/guest/session";
import { GuestReveal } from "@/features/guest/guest-motion";
import { guestField, guestPrimaryButton, guestSecondaryButton, useGuestCopy } from "@/features/guest/shell";
import type { components } from "@/lib/api/schema";
import { mergeGuestBranding } from "@/lib/guest/branding";
import { useGuest } from "@/stores/guest";

type PresenceResponse = Omit<components["schemas"]["TableSessionResponse"], "session_token">;
type GuestText = (typeof guestCopy)[keyof typeof guestCopy];

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

export function PresenceForm({ token }: { token: string }) {
  const router = useRouter();
  const { t, locale } = useGuestCopy();
  const setSession = useGuest((state) => state.setSession);
  const guestName = useGuest((state) => state.guestName);
  const setGuestName = useGuest((state) => state.setGuestName);
  const storedToken = useGuest((state) => state.tableToken);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [lastAction, setLastAction] = useState<"verify" | "join">("verify");
  const [checkingReturn, setCheckingReturn] = useState(true);

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

  async function submit(
    action: JoinAction,
    coords?: { latitude: number; longitude: number; accuracy_m: number | null },
  ) {
    setLastAction(action);
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
        setError(t.orderingPaused);
        return;
      }
      if (!response.ok) {
        const effect = decideAfterApiError(payload.code, pin.trim());
        if (effect.type === "show_outside") {
          setShowPin(true);
          setError(t.outside);
          return;
        }
        if (effect.type === "api_error") {
          if (effect.revealPin) setShowPin(true);
          setError(joinErrorMessage(effect.code, t));
          return;
        }
        setError(joinErrorMessage(payload.code, t));
        return;
      }
      setSession(toGuestSession(payload));
      useGuest.getState().setTableToken(token);
      useGuest.getState().setBranding(mergeGuestBranding(null, payload));
      router.push("/order");
    } catch {
      setError(t.orderingPaused);
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
      if (effect.revealPin) setShowPin(true);
      setError(locationBlockedMessage(effect.reason, t));
    }
  }

  function locate(action: JoinAction) {
    setLastAction(action);
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
    const effect = decidePinJoin(pin.trim());
    if (effect.type !== "submit_pin") return;
    void submit(effect.action);
  }

  if (checkingReturn) {
    return (
      <div className="mx-auto grid w-full gap-4 py-6">
        <p className="guest-body">{t.verifying}</p>
      </div>
    );
  }

  return (
    <GuestReveal className="mx-auto grid w-full gap-5 py-2">
      <div data-guest-reveal>
        <h1 className="guest-display guest-display-lg">{t.presenceTitle}</h1>
        <p className="guest-body mt-2">{t.presenceBody}</p>
      </div>
      <label data-guest-reveal className="grid gap-1.5 guest-title">
        {t.yourName}
        <input
          className={guestField}
          autoComplete="name"
          value={guestName}
          onChange={(event) => setGuestName(event.target.value)}
        />
        <span className="guest-body font-normal">{t.nameHint}</span>
      </label>
      <button
        type="button"
        data-guest-reveal
        className="guest-body min-h-11 justify-self-start font-semibold text-[var(--guest-orange)] underline-offset-2 hover:underline"
        onClick={() => setShowPin((current) => !current)}
      >
        {showPin ? t.hidePin : t.havePin}
      </button>
      {showPin ? (
        <label data-guest-reveal className="grid gap-1.5 guest-title">
          {t.pin}
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            className={`${guestField} tracking-widest`}
            value={pin}
            onChange={(event) => setPin(event.target.value)}
          />
          <span className="guest-body font-normal">{t.pinHint}</span>
        </label>
      ) : null}
      {error ? (
        <div
          role="alert"
          data-guest-reveal
          className="grid gap-3 rounded-[var(--guest-radius-card)] border border-destructive/40 bg-white p-3"
        >
          <p className="text-sm text-destructive">{error}</p>
          <div className="grid gap-2">
            <button
              type="button"
              className={guestSecondaryButton}
              disabled={pending}
              onClick={() => locate("verify")}
            >
              {t.allowLocation}
            </button>
            <button
              type="button"
              className={guestSecondaryButton}
              disabled={pending}
              onClick={() => setShowPin(true)}
            >
              {t.enterPin}
            </button>
          </div>
        </div>
      ) : null}
      <div data-guest-reveal className="grid gap-1.5">
        <button
          type="button"
          className={guestPrimaryButton}
          disabled={pending}
          onClick={() => locate("verify")}
        >
          {pending && lastAction === "verify" ? t.verifying : t.useLocation}
        </button>
        <p className="guest-body">{t.locationHint}</p>
      </div>
      <div data-guest-reveal className="grid gap-1.5">
        <button
          type="button"
          className={guestSecondaryButton}
          disabled={pending || !pinJoinEnabled(pin)}
          onClick={() => joinWithPin()}
        >
          {pending && lastAction === "join" ? t.verifying : t.join}
        </button>
        <p className="guest-body">{t.joinHint}</p>
      </div>
    </GuestReveal>
  );
}
