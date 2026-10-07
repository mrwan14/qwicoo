"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { guestCopy } from "@/features/guest/copy";
import { toGuestSession } from "@/features/guest/session";
import { guestField, guestPrimaryButton, guestSecondaryButton, useGuestCopy } from "@/features/guest/shell";
import type { components } from "@/lib/api/schema";
import { mergeGuestBranding } from "@/lib/guest/branding";
import { useGuest } from "@/stores/guest";

type PresenceResponse = Omit<components["schemas"]["TableSessionResponse"], "session_token">;

/** Only codes we have guest copy for get their own message; anything else is the same calm fallback. */
function joinErrorMessage(code: string | null | undefined, t: (typeof guestCopy)[keyof typeof guestCopy]): string {
  if (code === "OUT_OF_GEOFENCE" || code === "GEOLOCATION_REQUIRED") return t.outside;
  if (code === "INVALID_OR_EXPIRED_PIN") return t.badPin;
  return t.tableCodeFailed;
}

export function PresenceForm({ token }: { token: string }) {
  const router = useRouter();
  const { t, locale } = useGuestCopy();
  const setSession = useGuest((state) => state.setSession);
  const guestName = useGuest((state) => state.guestName);
  const setGuestName = useGuest((state) => state.setGuestName);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [lastAction, setLastAction] = useState<"verify" | "join">("join");
  const storedToken = useGuest((state) => state.tableToken);

  useEffect(() => {
    if (storedToken === token) void submit("join");
    // Rejoin this table automatically when we already have its token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, storedToken]);

  async function submit(action: "verify" | "join", coords?: { latitude: number; longitude: number }) {
    setLastAction(action);
    setPending(true);
    setError("");
    const body: components["schemas"]["TablePresenceVerifyRequest"] = {
      qr_token: token,
      ...(coords
        ? { client_latitude: coords.latitude, client_longitude: coords.longitude }
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
      if (!response.ok && coords && !pin.trim() && payload.code === "OUT_OF_GEOFENCE") {
        await submit(action);
        return;
      }
      if ([502, 503, 504].includes(response.status)) {
        setError(t.orderingPaused);
        return;
      }
      if (!response.ok) {
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

  function locate(action: "verify" | "join") {
    setLastAction(action);
    setPending(true);
    if (!navigator.geolocation) {
      void submit(action);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void submit(action, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        void submit(action);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div className="mx-auto grid max-w-md gap-4 rounded-2xl bg-card p-5 shadow-elev-1">
      <div>
        <h1 className="font-display text-[length:var(--text-28)]">{t.presenceTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.presenceBody}</p>
      </div>
      <label className="grid gap-1 text-sm font-medium">
        {t.yourName}
        <input
          className={guestField}
          autoComplete="name"
          value={guestName}
          onChange={(event) => setGuestName(event.target.value)}
        />
        <span className="font-normal text-muted-foreground">{t.nameHint}</span>
      </label>
      <button
        type="button"
        className="min-h-11 justify-self-start text-sm font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onClick={() => setShowPin((current) => !current)}
      >
        {showPin ? t.hidePin : t.havePin}
      </button>
      {showPin ? (
        <label className="grid gap-1 text-sm font-medium">
          {t.pin}
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            className={`${guestField} tracking-widest`}
            value={pin}
            onChange={(event) => setPin(event.target.value)}
          />
          <span className="font-normal text-muted-foreground">{t.pinHint}</span>
        </label>
      ) : null}
      {error ? (
        <div role="alert" className="grid gap-2 rounded-xl border border-destructive/40 p-3">
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            className={guestSecondaryButton}
            disabled={pending}
            onClick={() => (lastAction === "verify" ? locate("verify") : void submit("join"))}
          >
            {t.retry}
          </button>
        </div>
      ) : null}
      <div className="grid gap-1">
        <button
          type="button"
          className={guestPrimaryButton}
          disabled={pending}
          onClick={() => locate("verify")}
        >
          {pending && lastAction === "verify" ? t.verifying : t.useLocation}
        </button>
        <p className="text-sm text-muted-foreground">{t.locationHint}</p>
      </div>
      <div className="grid gap-1">
        <button
          type="button"
          className={guestSecondaryButton}
          disabled={pending}
          onClick={() => void submit("join")}
        >
          {pending && lastAction === "join" ? t.verifying : t.join}
        </button>
        <p className="text-sm text-muted-foreground">{t.joinHint}</p>
      </div>
    </div>
  );
}
