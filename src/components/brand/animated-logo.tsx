"use client";

import { useEffect, useRef, useState } from "react";

import { LOGO_ASPECT, LOGO_VIDEO } from "./logo-assets";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/** The Qwicoo animated logo. Plays once, muted; reduced motion gets the still. */
export function AnimatedLogo({
  className = "",
  startAt = 0,
  onEnded,
}: {
  className?: string;
  /** Seconds to skip, e.g. to play only the settle at the end. */
  startAt?: number;
  onEnded?: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = video.current;
    if (!el || reduced) return;
    if (startAt > 0) el.currentTime = startAt;
    void el.play().catch(() => undefined);
  }, [reduced, startAt]);

  // No frame: `darken` keeps the logo strokes and drops the flat canvas wherever the surface
  // underneath is at or below LOGO_SURFACE, so no rectangle shows whatever the decoder's colour.
  const frame = `block w-full mix-blend-darken ${className}`;
  const style = { aspectRatio: LOGO_ASPECT };
  if (reduced) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={LOGO_VIDEO.poster} alt="Qwicoo" className={frame} style={style} />;
  }
  return (
    <video
      ref={video}
      className={frame}
      style={style}
      poster={LOGO_VIDEO.poster}
      autoPlay
      muted
      playsInline
      preload="auto"
      aria-label="Qwicoo"
      role="img"
      onEnded={onEnded}
    >
      <source src={LOGO_VIDEO.webm} type="video/webm" />
      <source src={LOGO_VIDEO.mp4} type="video/mp4" />
    </video>
  );
}
