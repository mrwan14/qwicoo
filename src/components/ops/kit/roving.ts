import type { KeyboardEvent } from "react";

/**
 * Arrow-key movement for a row of tabs or radio buttons. Left and right swap in RTL.
 * Focuses and returns the next index, or null when the key isn't a movement key.
 */
export function moveInRow(event: KeyboardEvent<HTMLElement>, role: "tab" | "radio"): number | null {
  const row = event.currentTarget.parentElement;
  if (!row) return null;
  const items = Array.from(row.querySelectorAll<HTMLElement>(`:scope > [role="${role}"]:not(:disabled)`));
  const index = items.indexOf(event.currentTarget);
  if (index < 0 || items.length === 0) return null;
  const rtl = getComputedStyle(row).direction === "rtl";
  const forward = (index + 1) % items.length;
  const back = (index - 1 + items.length) % items.length;
  let next: number;
  switch (event.key) {
    case "ArrowRight":
      next = rtl ? back : forward;
      break;
    case "ArrowLeft":
      next = rtl ? forward : back;
      break;
    case "ArrowDown":
      next = forward;
      break;
    case "ArrowUp":
      next = back;
      break;
    case "Home":
      next = 0;
      break;
    case "End":
      next = items.length - 1;
      break;
    default:
      return null;
  }
  event.preventDefault();
  items[next].focus();
  return next;
}
