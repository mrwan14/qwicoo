/**
 * Brand mark and wordmark. The mark reads as a Q and as a QR finder square,
 * and draws in `currentColor` so it works on light, dark, and tinted panels.
 */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      <rect x="3.5" y="3.5" width="25" height="25" rx="8.5" stroke="currentColor" strokeWidth="3" />
      <rect x="11.5" y="11.5" width="9" height="9" rx="2.5" fill="currentColor" />
      <path d="M21 21 L27.5 27.5" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({
  className = "",
  markClassName = "size-8 text-primary",
  wordClassName = "text-xl",
}: {
  className?: string;
  markClassName?: string;
  wordClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className={markClassName} />
      <span className={`font-display font-semibold tracking-tight ${wordClassName}`}>Qwicoo</span>
    </span>
  );
}
