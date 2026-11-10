"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, MapPin } from "lucide-react";

import { BottomSheet } from "@/features/guest/bottom-sheet";
import type { guestCopy } from "@/features/guest/copy";
import { GuestKeypad } from "@/features/guest/keypad";
import { GuestMotionSkeleton } from "@/features/guest/guest-motion";
import {
  decideAfterApiError,
  decideAfterGeolocation,
  decidePinJoin,
  geoOutcomeFromPosition,
  geoOutcomeFromPositionError,
  type JoinAction,
} from "@/features/guest/presence-join";
import { sessionStillValid, toGuestSession } from "@/features/guest/session";
import { guestPrimaryButton, useBrandName, useGuestCopy } from "@/features/guest/shell";
import type { components } from "@/lib/api/schema";
import { mergeGuestBranding } from "@/lib/guest/branding";
import { pickLocale } from "@/lib/i18n/locale-text";
import { useGuest } from "@/stores/guest";

type PresenceResponse = Omit<components["schemas"]["TableSessionResponse"], "session_token">;
type GuestText = (typeof guestCopy)[keyof typeof guestCopy];
type Step = "ask" | "pin";

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

/**
 * Scanning a table QR opens the menu straight away. The QR is remembered so the guest can
 * browse; joining the table (location or PIN) waits until they add something.
 */
export function TableEntry({ token }: { token: string }) {
  const router = useRouter();
  const { t } = useGuestCopy();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await useGuest.persist.rehydrate();
      if (cancelled) return;
      const state = useGuest.getState();
      // Guests get Arabic unless their phone is in English, until they pick a language themselves.
      if (!state.localeChosen && typeof navigator !== "undefined") {
        const english = (navigator.languages?.[0] ?? navigator.language ?? "").toLowerCase().startsWith("en");
        useGuest.setState({ locale: english ? "en" : "ar" });
      }
      const sameTable = state.tableToken === token;
      if (sameTable && state.session && (await sessionStillValid())) {
        if (!cancelled) router.replace("/order");
        return;
      }
      if (!sameTable || state.endedVisit) {
        // A new table, or a new visit at the same table: fresh "Guest N", no leftover receipt.
        useGuest.setState({
          session: null,
          tablePreview: null,
          cashRequestedOrderId: null,
          endedVisit: null,
          guestName: "",
          ...(sameTable ? {} : { branding: null }),
        });
      }
      useGuest.getState().setTableToken(token);
      if (!cancelled) router.replace("/order");
    })();
    return () => {
      cancelled = true;
    };
  }, [router, token]);

  return <GuestMotionSkeleton label={t.loading} />;
}

/** Location first, PIN as the fallback. Calls onJoined once a verified table session exists. */
function usePresenceJoin(token: string | null, onJoined: () => void) {
  const { t, locale } = useGuestCopy();
  const [step, setStep] = useState<Step>("ask");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function reset() {
    setStep("ask");
    setPin("");
    setError("");
    setPending(false);
  }

  async function submit(
    action: JoinAction,
    coords?: { latitude: number; longitude: number; accuracy_m: number | null },
  ) {
    if (!token) return;
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
          setError(t.outside);
          return;
        }
        if (effect.type === "api_error") {
          setError(joinErrorMessage(effect.code, t));
          return;
        }
        setError(joinErrorMessage(payload.code, t));
        return;
      }
      const state = useGuest.getState();
      state.setSession(toGuestSession(payload));
      state.setTableToken(token);
      state.setBranding(mergeGuestBranding(state.branding, payload));
      onJoined();
    } catch {
      setError(t.orderingPausedJoin);
    } finally {
      setPending(false);
    }
  }

  function applyGeoEffect(
    action: JoinAction,
    outcome: ReturnType<typeof geoOutcomeFromPosition> | ReturnType<typeof geoOutcomeFromPositionError> | { kind: "unsupported" },
  ) {
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
    if (effect.type === "location_blocked") setError(locationBlockedMessage(effect.reason, t));
  }

  function locate() {
    setPending(true);
    setError("");
    if (!navigator.geolocation) {
      applyGeoEffect("verify", { kind: "unsupported" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        applyGeoEffect(
          "verify",
          geoOutcomeFromPosition({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          }),
        ),
      (err) => applyGeoEffect("verify", geoOutcomeFromPositionError(err?.code)),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function joinWithPin() {
    if (pin.trim().length !== PIN_LENGTH) return;
    const effect = decidePinJoin(pin.trim());
    if (effect.type !== "submit_pin") return;
    void submit(effect.action);
  }

  return { step, setStep, pin, setPin, error, setError, pending, locate, joinWithPin, reset };
}

/** "Confirm you're at {restaurant}": the one-time presence check, raised by the first add. */
export function JoinTableSheet({
  open,
  onOpenChange,
  onJoined,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoined: () => void;
}) {
  const { t, locale } = useGuestCopy();
  const token = useGuest((state) => state.tableToken);
  const preview = useGuest((state) => state.tablePreview);
  const brandName = useBrandName();
  const place = brandName || preview?.branchName || t.restaurant;
  const join = usePresenceJoin(token, () => {
    onOpenChange(false);
    onJoined();
  });
  const { reset } = join;
  const wasOpen = useRef(open);

  useEffect(() => {
    if (open && !wasOpen.current) reset();
    wasOpen.current = open;
  }, [open, reset]);

  const table = preview?.tableNumber;
  const body = table ? t.joinBody.replace("{n}", table) : t.joinBodyNoTable;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={join.step === "pin" ? t.joinPinTitle : t.joinTitle.replace("{place}", place)}
      titleHidden
      footer={
        join.step === "pin" ? (
          <button
            type="button"
            className={`${guestPrimaryButton} w-full`}
            disabled={join.pending || join.pin.trim().length !== PIN_LENGTH}
            onClick={join.joinWithPin}
          >
            {join.pending ? t.verifying : t.confirmPin}
          </button>
        ) : (
          <div className="grid gap-1">
            <button type="button" className={`${guestPrimaryButton} w-full`} disabled={join.pending} onClick={join.locate}>
              <MapPin className="size-5" aria-hidden />
              {join.pending ? t.verifying : join.error ? t.joinTryAgain : t.shareLocation}
            </button>
            <button
              type="button"
              className="min-h-12 text-[15px] font-semibold text-[var(--guest-brand-text)]"
              onClick={() => {
                join.setError("");
                join.setStep("pin");
              }}
            >
              {t.joinUsePin}
            </button>
          </div>
        )
      }
    >
      {join.step === "pin" ? (
        <div className="grid gap-5 pb-2">
          <div className="grid gap-1.5 text-center">
            <span className="guest-join-icon mx-auto">
              <KeyRound className="size-7" aria-hidden />
            </span>
            <h2 className="guest-sheet-title">{t.joinPinTitle}</h2>
            <p className="guest-body text-[15px]">{t.joinPinBody}</p>
          </div>
          <GuestKeypad value={join.pin} onChange={join.setPin} length={PIN_LENGTH} disabled={join.pending} />
          {join.error ? (
            <p role="alert" className="guest-alert guest-alert-error text-sm">
              {join.error}
            </p>
          ) : null}
          <button type="button" className="min-h-11 text-sm font-semibold text-[var(--guest-quiet)]" onClick={() => join.setStep("ask")}>
            {t.back}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 pb-2 text-center" lang={locale}>
          <span className="guest-join-icon mx-auto">
            <MapPin className="size-7" aria-hidden />
          </span>
          <div className="grid gap-1.5">
            <h2 className="guest-sheet-title">{t.joinTitle.replace("{place}", place)}</h2>
            <p className="guest-body text-[15px] leading-relaxed">{body}</p>
          </div>
          {join.error ? (
            <p role="alert" className="guest-alert guest-alert-error text-start text-sm">
              {join.error}
            </p>
          ) : null}
        </div>
      )}
    </BottomSheet>
  );
}

/** Branch and table for the header before the guest joins, from the QR preview. */
export function previewFromQr(
  payload: { branch_id: string; table_number: string; branch_name: unknown; ordering_paused?: unknown },
  locale: "en" | "ar",
) {
  return {
    branchId: payload.branch_id,
    tableNumber: String(payload.table_number ?? ""),
    branchName: pickLocale(payload.branch_name as Parameters<typeof pickLocale>[0], locale),
    orderingPaused: payload.ordering_paused === true,
  };
}
