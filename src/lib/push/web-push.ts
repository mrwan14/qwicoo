"use client";

import { browserApi } from "@/lib/api/browser";

const SW_URL = "/sw.js";

export type PushSupport = "supported" | "ios-install" | "unsupported";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (ok) return "supported";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone ? "ios-install" : "unsupported";
}

export async function registerStaffServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (pushSupport() !== "supported") return null;
  try {
    return await navigator.serviceWorker.register(SW_URL, { scope: "/" });
  } catch {
    return null;
  }
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = `${base64url}${"=".repeat((4 - (base64url.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function fetchPushKey(): Promise<string | null> {
  const { data, response } = await browserApi.GET("/api/v1/staff/push/public-key");
  if (!response.ok || !data?.enabled || !data.public_key) return null;
  return data.public_key;
}

/** Subscribe (or refresh) this browser for the current branch. Call only after permission is granted. */
export async function syncPushSubscription(options: { branchId: string; orderAlertsOptIn: boolean }): Promise<boolean> {
  const key = await fetchPushKey();
  if (!key) return false;
  const registration = (await registerStaffServiceWorker()) ?? null;
  if (!registration) return false;
  await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }));
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
  const { response } = await browserApi.POST("/api/v1/staff/push/subscriptions", {
    body: {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      branch_id: options.branchId,
      order_alerts_opt_in: options.orderAlertsOptIn,
    },
  });
  return response.ok;
}

/** Remove this browser's subscription on the server and in the browser. Never throws. */
export async function removePushSubscription(): Promise<void> {
  try {
    if (pushSupport() !== "supported") return;
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    // Plain fetch: this also runs while signing out, where a 401 must not loop back into sign-out.
    await fetch("/api/v1/staff/push/subscriptions", {
      method: "DELETE",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => undefined);
    await subscription.unsubscribe().catch(() => undefined);
  } catch {
    // Nothing to clean up.
  }
}
