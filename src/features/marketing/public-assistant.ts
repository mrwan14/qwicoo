import type { LocaleCode } from "@/lib/i18n/locale-text";
import type { components } from "@/lib/api/schema";

export type LeadField = "name" | "restaurant" | "contact" | "city" | "branches" | "message";

export type LeadDraft = {
  name: string;
  restaurant: string;
  contact: string;
  city: string;
  branches: string;
  message: string;
};

export type LauncherState = { open: boolean; mounted: boolean };

const PUBLIC_CHAT = "/api/v1/assistant/public/chat";
const PUBLIC_LEAD = "/api/v1/assistant/public/lead";

/** First open mounts the chat bundle and keeps it mounted after close. */
export function launcherReducer(state: LauncherState, action: "open" | "close"): LauncherState {
  if (action === "open") return { open: true, mounted: true };
  return { ...state, open: false };
}

export function leadFormPhase(received: boolean): "form" | "thanks" {
  return received ? "thanks" : "form";
}

function within(value: string, min: number, max: number): boolean {
  const length = value.trim().length;
  return length >= min && length <= max;
}

function reachable(value: string): boolean {
  const cleaned = value.trim();
  return within(cleaned, 5, 160) && (cleaned.includes("@") || /\d/.test(cleaned));
}

/** Field rules mirror PartnerLeadRequest. The chat transcript never receives these values. */
export function validateLead(
  draft: LeadDraft,
  locale: LocaleCode,
): { ok: true; body: components["schemas"]["PartnerLeadRequest"] } | { ok: false; errors: LeadField[] } {
  const errors: LeadField[] = [];
  if (!within(draft.name, 2, 120)) errors.push("name");
  if (!within(draft.restaurant, 2, 160)) errors.push("restaurant");
  if (!reachable(draft.contact)) errors.push("contact");
  if (!within(draft.city, 2, 80)) errors.push("city");
  const branches = Number(draft.branches);
  if (!Number.isInteger(branches) || branches < 1 || branches > 500) errors.push("branches");
  if (draft.message.trim().length > 1000) errors.push("message");
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    body: {
      name: draft.name.trim(),
      restaurant_name: draft.restaurant.trim(),
      phone_or_email: draft.contact.trim(),
      city: draft.city.trim(),
      branches_count: Number(draft.branches),
      message: draft.message.trim(),
      locale,
    },
  };
}

/** Public assistant calls carry the language and nothing that identifies a staff session. */
export function publicAssistantInit(locale: LocaleCode, body: unknown): RequestInit {
  return {
    method: "POST",
    credentials: "omit",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "accept-language": locale,
    },
    body: JSON.stringify(body),
  };
}

export function publicChatUrl(): string {
  return PUBLIC_CHAT;
}

export function publicLeadUrl(): string {
  return PUBLIC_LEAD;
}

export function publicRequestHasNoAuth(init: RequestInit): boolean {
  const headers = new Headers(init.headers);
  return init.credentials === "omit" && !headers.has("authorization") && !headers.has("x-brand-id") && !headers.has("x-branch-id");
}
