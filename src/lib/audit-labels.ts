const NAMED: Record<string, string> = {
  AUTH_LOGIN_SUCCESS: "Signed in",
  AUTH_LOGIN_FAILED: "Sign-in failed",
  AUTH_UNAUTHORIZED: "Sign-in was refused",
  ACCESS_FORBIDDEN: "Access was refused",
  AUTH_PASSWORD_RESET_REQUESTED: "Asked to reset a password",
  AUTH_PASSWORD_RESET_SUCCESS: "Reset a password",
  AUTH_PASSWORD_RESET_BLOCKED: "Password reset was refused",
  PAYMENT_INITIATED: "Started a card payment",
  PAYMENT_PROCESSED_ONLINE: "Completed a card payment",
  OFFLINE_PAYMENT_REQUESTED: "Recorded a payment to confirm",
  CASH_PAYMENT_VERIFIED: "Confirmed a payment",
  POS_ORDER_CANCELLED: "Cancelled a till order",
  ORDER_CREATED: "Placed an order",
  ORDER_STATUS_CHANGED: "Updated an order",
  ORDER_CANCELLED_BY_CUSTOMER: "Guest cancelled an order",
  ORDER_SLA_BREACHED: "An order waited too long",
  DRIVE_THRU_ORDER_CREATED: "Placed a drive-thru order",
  HANDOVER_VERIFIED: "Checked the guest code",
  BRANCH_CREATED: "Added a branch",
  BRANCH_UPDATED: "Updated a branch",
  BRANCH_SOFT_DELETED: "Removed a branch",
  BRANCH_LOCATION_UPDATED: "Updated a branch address",
  BRANCH_FINANCIAL_SETTINGS_UPDATED: "Updated branch prices and tax",
  BRANCH_PIN_ROTATED: "Changed the guest code",
  BRANCH_SLA_CONFIG_UPDATED: "Updated waiting-time rules",
  BRAND_CREATED: "Added a brand",
  BRAND_UPDATED: "Updated a brand",
  BRAND_DEACTIVATED: "Turned a brand off",
  BRAND_LOGO_UPDATED: "Updated a brand logo",
  CATEGORY_CREATED: "Added a menu category",
  CATEGORY_UPDATED: "Updated a menu category",
  ITEM_CREATED: "Added a menu item",
  ITEM_UPDATED: "Updated a menu item",
  MENU_ITEM_UPDATED: "Updated a menu item",
  MENU_ITEM_IMAGE_UPDATED: "Updated a menu photo",
  MODIFIER_GROUP_CREATED: "Added an option group",
  MODIFIER_GROUP_UPDATED: "Updated an option group",
  MODIFIER_GROUP_DELETED: "Removed an option group",
  MODIFIER_OPTION_CREATED: "Added an option",
  MODIFIER_OPTION_UPDATED: "Updated an option",
  MODIFIER_OPTION_DELETED: "Removed an option",
  TABLE_CREATED: "Added a table",
  TABLE_UPDATED: "Updated a table",
  TABLE_DELETED: "Removed a table",
  INVITATION_ACCEPTED: "Accepted a staff invitation",
  SERVICE_REQUEST_CREATED: "Asked staff for help",
  SERVICE_REQUEST_UPDATED: "Updated a table request",
  SERVICE_REQUEST_ESCALATED: "A table request waited too long",
  GUEST_SESSION_FORCE_CLOSED: "Closed a table session",
  CUSTOMER_ACCOUNT_DELETED: "Deleted a guest account",
  VEHICLE_VERIFIED: "Checked a vehicle",
};

const BY_ENDING: readonly [string, string][] = [
  ["ATTENDANCE_CHECK-IN", "Checked in"],
  ["ATTENDANCE_CHECK-OUT", "Checked out"],
  ["MANUAL-OVERRIDE", "Corrected an attendance record"],
  ["Z-REPORT_GENERATE", "Created the end-of-day report"],
  ["DRAWER_OPEN", "Started the shift"],
  ["DRAWER_CLOSE", "Ended the shift"],
  ["ORDERS_CHECKOUT", "Sent an order from the till"],
  ["EXPO-NOTES", "Updated the handover note"],
  ["EXPO-BUMP", "Marked the order ready to hand over"],
  ["HANDOVER_VERIFY", "Checked the guest code"],
  ["OFFLINE_REQUEST", "Recorded a payment to confirm"],
  ["ONLINE_INITIATE", "Started a card payment"],
];

const STATUS: Record<string, string> = {
  SUCCESS: "Succeeded",
  FAILED: "Failed",
  BLOCKED: "Refused",
};

function routeKey(action: string): string {
  return action
    .trim()
    .toUpperCase()
    .replace(/^HTTP_(POST|PUT|PATCH|DELETE|GET)_/, "")
    .replace(/^API_V1_/, "");
}

function humanize(key: string): string {
  const cleaned = key
    .replace(/\{[^}]+\}/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!cleaned) return "Recorded an action";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** Plain name for an audit action. The stored code is unchanged. */
export function auditActionLabel(action: string | null | undefined): string {
  const raw = action?.trim();
  if (!raw) return "Recorded an action";
  const upper = raw.toUpperCase();
  if (NAMED[upper]) return NAMED[upper];
  const key = routeKey(raw);
  if (NAMED[key]) return NAMED[key];
  const known = BY_ENDING.find(([ending]) => key.endsWith(ending));
  if (known) return known[1];
  if (key.includes("_STATIONS_") && key.endsWith("_BUMP")) return "Marked a station ready";
  if (key.endsWith("_BUMP")) return "Marked a dish ready";
  if (key.endsWith("_VERIFY")) return "Confirmed a payment";
  if (key.includes("WEBHOOKS_")) return "Received a card payment update";
  if (key.endsWith("_CANCEL")) return "Cancelled an order";
  if (key.endsWith("_TRANSITION")) return "Updated an order";
  if (key.endsWith("_ARRIVED")) return "Guest arrived for pickup";
  return humanize(key);
}

export function auditStatusLabel(status: string | null | undefined): string {
  const raw = status?.trim();
  if (!raw) return "";
  return STATUS[raw.toUpperCase()] ?? humanize(raw);
}
