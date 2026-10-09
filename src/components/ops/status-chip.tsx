import type { components } from "@/lib/api/schema";

type Tone = "available" | "browsing" | "ordered" | "ready" | "soldout" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  available: "bg-[var(--status-available-bg)] text-[var(--status-available)]",
  browsing: "bg-[var(--status-browsing-bg)] text-[var(--status-browsing)]",
  ordered: "bg-[var(--status-ordered-bg)] text-[var(--status-ordered)]",
  ready: "bg-[var(--status-ready-bg)] text-[var(--status-ready)]",
  soldout: "bg-[var(--status-soldout-bg)] text-[var(--status-soldout)]",
  neutral: "bg-muted text-muted-foreground",
};

export function occupancyTone(state: components["schemas"]["TableOccupancyState"] | string): Tone {
  switch (state) {
    case "AVAILABLE":
      return "available";
    case "SEATED":
      return "browsing";
    case "AWAITING_FOOD":
    case "BILL_REQUESTED":
      return "ordered";
    case "FOOD_SERVED":
      return "ready";
    default:
      return "neutral";
  }
}

export function StatusChip({ tone, children }: { tone: Tone; children: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}

export function toneSurface(tone: Tone): string {
  return TONE_CLASS[tone];
}
