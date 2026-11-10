import { ApiError, asApiError } from "@/lib/api/error";
import type { SplitMode } from "@/lib/guest/bill-split";
import type { components } from "@/lib/api/schema";
import { useGuest } from "@/stores/guest";

type OrderStatus = components["schemas"]["OrderStatus"];

export type BillLine = {
  name: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
  modifiers: string[];
  notes: string | null;
  guest_name: string | null;
  is_mine: boolean;
};

export type BillRound = {
  order_id: string;
  number: number;
  status: OrderStatus;
  created_at: string;
  is_paid: boolean;
  cancellation_reason: string | null;
  subtotal: string;
  discount_total: string;
  service_fee_total: string;
  tax_total: string;
  total_amount: string;
  paid_amount: string;
  lines: BillLine[];
};

export type BillPayment = {
  id: string;
  amount: string;
  method: string;
  status: "paid" | "pending";
  guest_name: string | null;
  is_mine: boolean;
  created_at: string;
};

export type TableBill = {
  session_id: string;
  table_number: string;
  currency: string;
  visit_open: boolean;
  rounds: BillRound[];
  subtotal: string;
  discount_total: string;
  service_fee_total: string;
  tax_total: string;
  total: string;
  paid: string;
  held: string;
  remaining: string;
  my_items_due: string;
  guests_count: number;
  payments: BillPayment[];
  card_available: boolean;
};

export type BillPayMethod = "CASH" | "CARD_TERMINAL" | "PAYMOB";

export type VisitReview = { id: string; rating: number; comment: string | null; created_at: string };

function headers(extra?: Record<string, string>): HeadersInit {
  const { locale, session } = useGuest.getState();
  return {
    accept: "application/json",
    "accept-language": locale,
    ...(session?.branchId ? { "x-branch-id": session.branchId } : {}),
    ...extra,
  };
}

async function call<T>(path: string, init: RequestInit, fallback: string): Promise<T> {
  const response = await fetch(`/api/guest/api/v1${path}`, { ...init, credentials: "include", cache: "no-store" });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) throw asApiError(payload, response, fallback, useGuest.getState().locale);
  return payload as T;
}

export function fetchTableBill(fallback: string): Promise<TableBill> {
  return call<TableBill>("/sessions/bill", { method: "GET", headers: headers() }, fallback);
}

export function payTableBill(
  body: { amount: string; method: BillPayMethod; split_mode: SplitMode; guest_name?: string; phone?: string },
  idempotencyKey: string,
  fallback: string,
): Promise<{ payment_id: string; amount: string; method: BillPayMethod; checkout_url: string | null }> {
  return call(
    "/sessions/bill/pay",
    {
      method: "POST",
      headers: headers({ "content-type": "application/json", "idempotency-key": idempotencyKey }),
      body: JSON.stringify(body),
    },
    fallback,
  );
}

export function fetchMyReview(fallback: string): Promise<VisitReview | null> {
  return call<VisitReview | null>("/sessions/review", { method: "GET", headers: headers() }, fallback);
}

export function submitReview(
  body: { rating: number; comment?: string; guest_name?: string },
  fallback: string,
): Promise<VisitReview> {
  return call<VisitReview>(
    "/sessions/review",
    { method: "POST", headers: headers({ "content-type": "application/json" }), body: JSON.stringify(body) },
    fallback,
  );
}

/** Renew the guest cookie. Returns false once the visit is closed (410) or the cookie is gone. */
export async function refreshGuestToken(): Promise<"ok" | "ended" | "failed"> {
  try {
    const response = await fetch("/api/guest/session/refresh", { method: "POST", credentials: "include", cache: "no-store" });
    if (response.ok) return "ok";
    if (response.status === 410 || response.status === 401) return "ended";
    return "failed";
  } catch {
    return "failed";
  }
}

export function isVisitEndedError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 410 || error.code === "GUEST_SESSION_ENDED");
}
