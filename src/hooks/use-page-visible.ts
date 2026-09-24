"use client";

import { useEffect, useState } from "react";

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
