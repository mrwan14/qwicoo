import "./ask-mark.css";

/**
 * The Ask Qwicoo mark: a rounded chat bubble holding the two linked rings from the Qwicoo icon,
 * so it reads as "chat" and as "Qwicoo" at once. Used by the public launcher and chat, and by the
 * staff Ask Qwicoo button and panel, so customers recognise it after they sign up.
 *
 * tone "dark": ink bubble for light surfaces. tone "light": cream bubble for ink surfaces.
 * thinking: the rings breathe while an answer is on its way.
 */
export function AskQwicooMark({
  size = 28,
  tone = "dark",
  thinking = false,
  className = "",
}: {
  size?: number;
  tone?: "dark" | "light";
  thinking?: boolean;
  className?: string;
}) {
  const bubble = tone === "dark" ? "var(--ink, #1f1f1f)" : "var(--canvas, #f5f2ec)";
  const ring = "var(--orange, #f76c33)";
  return (
    <svg
      aria-hidden
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={`shrink-0 ${thinking ? "qw-ask-thinking" : ""} ${className}`}
    >
      {/* Bubble: a soft pill with a rounded tail at the bottom start. */}
      <path
        fill={bubble}
        d="M13 3h6c6.08 0 11 4.92 11 11s-4.92 11-11 11h-5.2l-5.6 4.1c-.9.66-2.13-.13-1.9-1.22l.62-3.03A11 11 0 0 1 2 14C2 7.92 6.92 3 13 3Z"
      />
      {/* The Qwicoo rings, joined by a short bar like the app icon. */}
      <circle className="qw-ask-ring" cx="11.4" cy="14" r="4.2" fill="none" stroke={ring} strokeWidth="2.7" />
      <circle className="qw-ask-ring" cx="20.6" cy="14" r="4.2" fill="none" stroke={ring} strokeWidth="2.7" />
      <path d="M15.2 14h1.6" stroke={ring} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
