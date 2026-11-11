/** Staff calls for guest-visit features the generated schema does not list yet. */
import { query, staffJson } from "@/lib/api/staff-json";

export type ReviewRow = {
  id: string;
  branch_id: string;
  table_number: string | null;
  guest_name: string | null;
  rating: number;
  comment: string | null;
  is_low: boolean;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
};

export type ReviewsPage = {
  count: number;
  average: number | null;
  distribution: Record<string, number>;
  unresolved_low: number;
  items: ReviewRow[];
};

export type WalkoutRow = {
  order_id: string;
  branch_id: string;
  table_number: string | null;
  total_amount: string;
  reason: string | null;
  marked_by: string | null;
  walked_out_at: string;
};

export type WalkoutsPage = { count: number; amount: string; items: WalkoutRow[] };

export type Period = { branchId?: string | null; start?: string | null; end?: string | null };

export function fetchReviews(
  period: Period & { lowOnly?: boolean; rating?: number | null; limit?: number },
  fallback: string,
): Promise<ReviewsPage> {
  return staffJson(
    `/api/v1/reviews${query({
      branch_id: period.branchId,
      start_date: period.start,
      end_date: period.end,
      low_only: period.lowOnly || undefined,
      rating: period.rating ?? undefined,
      limit: period.limit ?? 100,
    })}`,
    { method: "GET" },
    fallback,
  );
}

export function fetchReviewsSummary(branchId: string | null, fallback: string): Promise<{ unresolved_low: number }> {
  return staffJson(`/api/v1/reviews/summary${query({ branch_id: branchId })}`, { method: "GET" }, fallback);
}

export function resolveReview(id: string, note: string, fallback: string): Promise<ReviewRow> {
  return staffJson(
    `/api/v1/reviews/${encodeURIComponent(id)}/resolve`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ note: note.trim() || null }) },
    fallback,
  );
}

export function fetchWalkouts(period: Period, fallback: string): Promise<WalkoutsPage> {
  return staffJson(
    `/api/v1/analytics/walkouts${query({ branch_id: period.branchId, start_date: period.start, end_date: period.end })}`,
    { method: "GET" },
    fallback,
  );
}

export function markWalkout(
  orderId: string,
  reason: string,
  fallback: string,
): Promise<{ order_id: string; unpaid_amount: string; table_status: string | null }> {
  return staffJson(
    `/api/v1/orders/${encodeURIComponent(orderId)}/walkout`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: reason.trim() }) },
    fallback,
  );
}
