"use client";

import { useEffect, useState } from "react";

import { isRoleDenied } from "@/lib/api/error";

export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const sync = () => setVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return visible;
}

/** Polling interval that stops while the browser tab is hidden. */
export function usePollingInterval(ms: number): number | false {
  const visible = usePageVisible();
  return visible ? ms : false;
}

/** For `refetchInterval`: a role refusal won't change on the next poll, so stop asking. */
export function pollUnlessRoleDenied(interval: number | false) {
  return (query: { state: { error: unknown } }) => (isRoleDenied(query.state.error) ? false : interval);
}
