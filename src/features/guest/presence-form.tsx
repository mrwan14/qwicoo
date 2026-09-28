"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useGuestCopy } from "@/features/guest/shell";
import type { components } from "@/lib/api/schema";
import { mergeGuestBranding } from "@/lib/guest/branding";
import { useGuest, type GuestSession } from "@/stores/guest";

type PresenceResponse = Omit<components["schemas"]["TableSessionResponse"], "session_token">;

function toSession(data: PresenceResponse): GuestSession {
  const brandId = (data as { brand_id?: unknown }).brand_id;
  return {
    sessionId: data.session_id,
    branchId: data.branch_id,
    brandId: typeof brandId === "string" ? brandId : null,
    tableId: data.table_id,
    tableNumber: data.table_number,
    branchName: typeof data.branch_name === "string" ? data.branch_name : null,
  };
}

export function PresenceForm({ token }: { token: string }) {
  const router = useRouter();
  const { t } = useGuestCopy();
  const setSession = useGuest((state) => state.setSession);
  const guestName = useGuest((state) => state.guestName);
  const setGuestName = useGuest((state) => state.setGuestName);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(action: "verify" | "join", coords?: { latitude: number; longitude: number }) {
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
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as PresenceResponse & { detail?: string };
      if (!response.ok) {
        const detail = typeof payload.detail === "string" ? payload.detail : t.retry;
        if (detail === "OUT_OF_GEOFENCE") setError(t.outside);
        else if (detail.toLowerCase().includes("pin")) setError(t.badPin);
        else setError(detail);
        return;
      }
      setSession(toSession(payload));
      useGuest.getState().setBranding(mergeGuestBranding(null, payload));
      router.push("/order");
    } catch {
      setError(t.retry);
    } finally {
      setPending(false);
    }
  }

  function locate(action: "verify" | "join") {
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
          className="h-12 rounded-lg border px-3"
          value={guestName}
          onChange={(event) => setGuestName(event.target.value)}
        />
        <span className="font-normal text-muted-foreground">{t.nameHint}</span>
      </label>
      <label className="grid gap-1 text-sm font-medium">
        {t.pin}
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          className="h-12 rounded-lg border px-3 tracking-widest"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
        />
        <span className="font-normal text-muted-foreground">{t.pinHint}</span>
      </label>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="min-h-12 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        disabled={pending}
        onClick={() => void submit("join")}
      >
        {pending ? t.verifying : t.join}
      </button>
      <button
        type="button"
        className="min-h-12 rounded-xl border px-4 text-sm font-medium disabled:opacity-50"
        disabled={pending}
        onClick={() => locate("verify")}
      >
        {t.useLocation}
      </button>
    </div>
  );
}
