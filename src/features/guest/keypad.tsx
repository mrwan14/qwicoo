"use client";

import { useGuestCopy } from "@/features/guest/shell";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"] as const;

function BackspaceIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden>
      <path d="M9.2 6.5h9.3a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H9.2L4 12l5.2-5.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="m11 10 4 4m0-4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Six-digit table PIN pad. The branch PIN is always 6 digits. */
export function GuestKeypad({
  value,
  onChange,
  length = 6,
  disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  disabled?: boolean;
}) {
  const { t } = useGuestCopy();
  const digits = value.replace(/\D/g, "").slice(0, length);

  function press(key: (typeof KEYS)[number]) {
    if (disabled || key === "") return;
    if (key === "back") {
      onChange(digits.slice(0, -1));
      return;
    }
    if (digits.length >= length) return;
    onChange(digits + key);
  }

  return (
    <div className="grid gap-4">
      <div className="guest-pin-row" aria-hidden>
        {Array.from({ length }, (_, index) => (
          <span key={index} className="guest-pin-box">
            {digits[index] ?? ""}
          </span>
        ))}
      </div>
      <div className="guest-keypad" role="group" aria-label={t.pin}>
        {KEYS.map((key, index) =>
          key === "" ? (
            <span key={index} />
          ) : (
            <button
              key={key}
              type="button"
              className="guest-key guest-motion"
              disabled={disabled}
              aria-label={key === "back" ? t.deleteDigit : undefined}
              onClick={() => press(key)}
            >
              {key === "back" ? <BackspaceIcon /> : key}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
