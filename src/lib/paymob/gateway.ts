import type { components } from "@/lib/api/schema";

const SETTINGS_ROLES = new Set(["SUPER_ADMIN", "BRAND_ADMIN"]);
const REFUND_ROLES = new Set(["CASHIER", "BRANCH_ADMIN", "REGIONAL_MANAGER", "BRAND_ADMIN", "SUPER_ADMIN"]);

export function canManagePaymobGateway(role: string | null | undefined): boolean {
  return role != null && SETTINGS_ROLES.has(role);
}

export function canRefundPaymob(role: string | null | undefined): boolean {
  return role != null && REFUND_ROLES.has(role);
}

/** Empty or masked input keeps the stored secret. A typed value replaces it. */
export function secretForUpsert(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("****")) return undefined;
  return trimmed;
}

export function parseIntegrationId(raw: string): number | null | "invalid" {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return "invalid";
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value <= 0) return "invalid";
  return value;
}

export function normalizeCurrency(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return null;
  return code;
}

export type PaymobDraft = {
  secretKey: string;
  publicKey: string;
  hmacSecret: string;
  card: string;
  wallet: string;
  kiosk: string;
  currency: string;
  isLive: boolean;
  isActive: boolean;
};

export type PaymobUpsertResult =
  | { ok: true; body: components["schemas"]["PaymobGatewayUpsert"] }
  | { ok: false; reason: "currency" | "integration" | "secrets" };

export function paymobUpsertBody(draft: PaymobDraft, existing: boolean): PaymobUpsertResult {
  const currency = normalizeCurrency(draft.currency);
  if (!currency) return { ok: false, reason: "currency" };
  const card = parseIntegrationId(draft.card);
  const wallet = parseIntegrationId(draft.wallet);
  const kiosk = parseIntegrationId(draft.kiosk);
  if (card === "invalid" || wallet === "invalid" || kiosk === "invalid") return { ok: false, reason: "integration" };
  if (card == null && wallet == null && kiosk == null) return { ok: false, reason: "integration" };
  const secretKey = secretForUpsert(draft.secretKey);
  const publicKey = secretForUpsert(draft.publicKey);
  const hmacSecret = secretForUpsert(draft.hmacSecret);
  if (!existing && (!secretKey || !publicKey || !hmacSecret)) return { ok: false, reason: "secrets" };
  return {
    ok: true,
    body: {
      ...(secretKey ? { secret_key: secretKey } : {}),
      ...(publicKey ? { public_key: publicKey } : {}),
      ...(hmacSecret ? { hmac_secret: hmacSecret } : {}),
      integration_ids: { card, wallet, kiosk },
      currency,
      is_live: draft.isLive,
      is_active: draft.isActive,
    },
  };
}

export const SETUP_CHECKS = ["secret", "public", "hmac", "integration"] as const;
export type SetupCheckId = (typeof SETUP_CHECKS)[number];
export type SetupCheckState = "passed" | "failed" | "pending";

const SETUP_FAILURE: Record<string, SetupCheckId> = {
  PAYMOB_SECRET_KEY_FORMAT: "secret",
  PAYMOB_PUBLIC_KEY_FORMAT: "public",
  PAYMOB_HMAC_SECRET_MISSING: "hmac",
  PAYMOB_INTEGRATION_REQUIRED: "integration",
};

/** The test route returns the first failing check. Earlier checks passed; later ones were not run. */
export function setupChecklist(code: string | null): Record<SetupCheckId, SetupCheckState> {
  const result = {} as Record<SetupCheckId, SetupCheckState>;
  if (code == null) {
    for (const id of SETUP_CHECKS) result[id] = "passed";
    return result;
  }
  const failed = SETUP_FAILURE[code];
  if (!failed) {
    for (const id of SETUP_CHECKS) result[id] = "pending";
    return result;
  }
  let reached = false;
  for (const id of SETUP_CHECKS) {
    if (id === failed) {
      result[id] = "failed";
      reached = true;
    } else if (!reached) {
      result[id] = "passed";
    } else {
      result[id] = "pending";
    }
  }
  return result;
}

export type PaymobConnectionStatus = "disconnected" | "test" | "live";

export function paymobConnectionStatus(
  gateway: { is_active: boolean; is_live: boolean } | null,
): PaymobConnectionStatus {
  if (!gateway?.is_active) return "disconnected";
  return gateway.is_live ? "live" : "test";
}

export function paymobDashboardUrls(origin: string): { callback: string; redirect: string } {
  const base = origin.replace(/\/+$/, "");
  return {
    callback: `${base}/api/v1/payments/webhooks/paymob`,
    redirect: `${base}/api/v1/payments/paymob/return`,
  };
}
