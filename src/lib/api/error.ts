import { inventoryErrorCatalog } from "@/features/staff/inventory/errors";
import type { LocaleCode } from "@/lib/i18n/locale-text";

type Catalog = {
  en: string;
  /** Guest-facing Arabic copy. Matches the API catalog so a translated reply maps back to its code. */
  ar?: string;
  /** Other wordings the API uses for the same error (its own English catalog text). */
  aliases?: readonly string[];
};

/**
 * Known API error codes. The API translates catalog codes into the request's
 * locale (Arabic by default), so a reply may carry the code, the English text,
 * or the Arabic text. All three resolve to the same entry.
 */
const CATALOG: Record<string, Catalog> = {
  ...inventoryErrorCatalog,
  GEOLOCATION_REQUIRED: {
    en: "Allow location access, or enter the table PIN, to join this table.",
    ar: "إحداثيات الموقع الجغرافي مطلوبة للتحقق من النطاق الجغرافي للفرع",
    aliases: ["Client geolocation coordinates are required for branch geofence verification"],
  },
  OUT_OF_GEOFENCE: {
    en: "You seem to be outside the restaurant. Enter the table PIN to continue.",
    ar: "أنت خارج النطاق الجغرافي المسموح به للفرع",
    aliases: ["You are outside the permitted branch geofence radius"],
  },
  LOCATION_OR_PIN_REQUIRED: {
    en: "Allow location access, or enter the table PIN, to join this table.",
    ar: "اسمح بالموقع أو أدخل رمز الطاولة للانضمام.",
    aliases: ["LOCATION_OR_PIN_REQUIRED"],
  },
  LOCATION_TOO_INACCURATE: {
    en: "Your location isn't precise enough. Move closer, or enter the table PIN.",
    ar: "موقعك غير دقيق بما يكفي. اقترب أكثر، أو أدخل رمز الطاولة.",
    aliases: ["LOCATION_TOO_INACCURATE"],
  },
  PIN_LOCKED: {
    en: "Too many PIN attempts. Wait a moment, then try again or ask staff for help.",
    ar: "محاولات كثيرة لرمز الطاولة. انتظر قليلاً ثم حاول مجدداً أو اطلب المساعدة من الفريق.",
    aliases: ["PIN_LOCKED"],
  },
  INVALID_OR_EXPIRED_PIN: {
    en: "That PIN isn't valid or has expired. Ask a staff member for the current PIN.",
    ar: "الرمز غير صالح أو منتهي الصلاحية. اطلب الرمز الحالي من أحد الموظفين.",
    aliases: ["The provided access PIN is invalid or has expired."],
  },
  TABLE_INACTIVE: {
    en: "This table isn't available right now. Ask a staff member for help.",
    ar: "الطاولة أو الفرع غير متاح حالياً",
    aliases: ["The table or branch is not currently active"],
  },
  UNAUTHORIZED: {
    en: "You don't have permission to do that.",
    ar: "غير مصرح لك بالوصول إلى هذه العملية",
    aliases: ["You are not authorized to perform this operation"],
  },
  ENTITY_NOT_FOUND: {
    en: "We couldn't find that. It may have been removed.",
    ar: "العنصر المطلوب غير موجود",
    aliases: ["The requested entity was not found"],
  },
  TOKEN_INVALID: {
    en: "This link or code isn't valid. Scan the table QR code again.",
    ar: "رمز التحقق غير صالح أو تالف",
    aliases: ["Verification token is invalid or corrupted"],
  },
  TOKEN_EXPIRED: {
    en: "This link has expired. Scan the table QR code again.",
    ar: "انتهت صلاحية الرمز",
    aliases: ["Token has expired"],
  },
  SESSION_TERMINATED_TABLE_AVAILABLE: {
    en: "This table's session has ended. Scan the QR code to start a new one.",
    ar: "انتهت جلسة الطاولة وأصبحت الطاولة متاحة لضيوف جدد",
    aliases: ["Table session has terminated and the table is now available"],
  },
  SESSION_NOT_FOUND: {
    en: "Your table session ended. Rejoin to keep ordering.",
    ar: "جلسة الطاولة غير موجودة أو انتهت",
    aliases: ["Table session not found or no longer active", "Could not validate guest session credentials"],
  },
  GUEST_SESSION_ENDED: {
    en: "Your table session ended. Rejoin to keep ordering.",
    ar: "انتهت جلسة الطاولة. انضم مجدداً لمتابعة الطلب.",
    aliases: ["Guest session has ended"],
  },
  INPUT_VALIDATION_FAILED: {
    en: "Some details are missing or invalid. Check the form and try again.",
    ar: "بيانات الطلب المدخلة غير صحيحة",
    aliases: ["Input validation failed"],
  },
  INTERNAL_SERVER_ERROR: {
    en: "Something went wrong on our side. Try again in a moment.",
    ar: "حدث خطأ غير متوقع في النظام",
    aliases: ["An unexpected internal error occurred"],
  },
  ITEM_UNAVAILABLE: {
    en: "That item is sold out right now.",
    ar: "العنصر المطلوب غير متوفر حالياً",
    aliases: ["The requested item is currently unavailable"],
  },
  ITEM_NOT_FOUND: {
    en: "That item is no longer on the menu.",
    ar: "عنصر القائمة المطلوب غير موجود",
    aliases: ["The requested menu item was not found"],
  },
  MODIFIER_GROUP_REQUIRED: {
    en: "Choose the required options before adding this item.",
    ar: "مجموعة التعديلات هذه مطلوبة ويجب اختيار خيار واحد على الأقل",
    aliases: ["This modifier group is required; at least one option must be selected"],
  },
  MODIFIER_SELECTION_OUT_OF_BOUNDS: {
    en: "Check how many options are selected for this item.",
    ar: "عدد الخيارات المحددة خارج النطاق المسموح به للمجموعة",
    aliases: ["The number of selected options is out of the allowed bounds for this group"],
  },
  MODIFIER_OPTION_INVALID: {
    en: "One of the selected options isn't available for this item.",
    ar: "خيار التعديل المحدد غير صالح أو لا ينتمي لهذا العنصر",
    aliases: ["The selected modifier option is invalid or does not belong to this item"],
  },
  MODIFIER_OPTION_UNAVAILABLE: {
    en: "One of the selected options is sold out.",
    ar: "خيار التعديل المحدد غير متوفر حالياً",
    aliases: ["The selected modifier option is currently unavailable"],
  },
  DUPLICATE_MODIFIER_OPTION: {
    en: "The same option was picked twice. Remove the duplicate and try again.",
    ar: "لا يمكن تكرار نفس خيار التعديل في نفس المجموعة",
    aliases: ["Duplicate modifier option selections are not allowed"],
  },
  DUPLICATE_MODIFIER_GROUP: {
    en: "The same option group was sent twice. Remove the duplicate and try again.",
    ar: "لا يمكن تكرار تقديم نفس مجموعة التعديلات",
    aliases: ["Duplicate modifier group selections are not allowed"],
  },
  INVALID_STATE_TRANSITION: {
    en: "This order can't move to that status from where it is now.",
    ar: "الانتقال بين حالات الطلب غير صالح",
    aliases: ["Invalid order status transition"],
  },
  CANCELLATION_RESTRICTED_TO_STAFF: {
    en: "Orders already in progress can only be cancelled by a branch admin.",
    ar: "لا يمكن إلغاء الطلب بعد اعتماده إلا من قبل مسؤول الفرع",
    aliases: ["Orders in progress can only be cancelled by a branch administrator"],
  },
  CANCELLATION_REASON_REQUIRED: {
    en: "Add a reason for the cancellation.",
    ar: "سبب الإلغاء مطلوب",
    aliases: ["A cancellation reason is required"],
  },
  NO_ACTIVE_ORDER: {
    en: "This table has no open order.",
    ar: "لا يوجد طلب نشط لهذه الطاولة",
    aliases: ["No active order found for this table"],
  },
  MOBILE_APP_NOT_ENABLED_FOR_BRAND: {
    en: "The Qwicoo app isn't turned on for this restaurant.",
    ar: "تطبيق كويكو غير مفعّل لهذا المطعم.",
  },
  RETAIL_MODULE_LOCKED: {
    en: "The Store isn't enabled for this brand.",
    ar: "المتجر غير مفعّل لهذه العلامة.",
  },
  STORE_NOT_PACKED: {
    en: "Pack the Store items before handing over this order.",
    ar: "جهّز منتجات المتجر قبل تسليم هذا الطلب.",
  },
  STORE_STOCK_BELOW_RESERVED: {
    en: "You can't set stock below what's held for open orders.",
    ar: "لا يمكن ضبط المخزون أقل مما هو محجوز للطلبات المفتوحة.",
  },
  CASH_DRAWER_NOT_OPEN: {
    en: "No cash drawer is open. Open the till before refunding collected cash.",
    ar: "لا يوجد درج نقدية مفتوح. افتح الصندوق قبل رد مبلغ تم قبضه.",
  },
  DELIVERY_DRAWER_NOT_OPEN: {
    en: "No cash drawer is open for this branch. Open the drawer before handing over this delivery.",
    ar: "لا يوجد درج نقدية مفتوح في هذا الفرع. افتح الدرج قبل تسليم الطلب.",
  },
  DELIVERY_NOT_AVAILABLE: {
    en: "Delivery isn't available for this order.",
    ar: "التوصيل غير متاح لهذا الطلب.",
  },
  DELIVERY_NOT_READY: {
    en: "This delivery isn't ready for that step yet.",
    ar: "هذا الطلب غير جاهز لهذه الخطوة بعد.",
  },
  CASH_NOT_COLLECTED: {
    en: "Confirm that the driver handed over the cash, then try again.",
    ar: "أكّد أن السائق سلّم المبلغ نقداً، ثم أعد المحاولة.",
  },
  ORDER_NOT_FOUND: {
    en: "We couldn't find that order.",
    ar: "الطلب غير موجود",
    aliases: ["The requested order was not found"],
  },
  EMPTY_ORDER: {
    en: "Add at least one item before sending the order.",
    ar: "لا يمكن تقديم طلب فارغ بدون عناصر",
    aliases: ["Cannot checkout an empty order without items"],
  },
  ACTIVE_REQUEST_EXISTS: {
    en: "This request is already with the staff.",
    ar: "يوجد طلب خدمة نشط من هذا النوع مسبقاً لهذه الطاولة",
    aliases: ["An active service request of this type already exists for this table"],
  },
  SERVICE_REQUEST_COOLDOWN: {
    en: "Please wait a minute before sending the same request again.",
    ar: "يرجى الانتظار 60 ثانية قبل إرسال طلب خدمة آخر من هذا النوع",
    aliases: ["Please wait 60 seconds before submitting another service request of this type"],
  },
  SERVICE_REQUEST_NOT_FOUND: {
    en: "That request is no longer open.",
    ar: "طلب الخدمة غير موجود",
    aliases: ["The requested service request was not found"],
  },
  INVALID_SERVICE_REQUEST_TRANSITION: {
    en: "That request can't be updated that way.",
    ar: "تغيير حالة طلب الخدمة غير صالح",
    aliases: ["Invalid service request status transition"],
  },
  ORDER_ALREADY_PAID: {
    en: "This order is already paid.",
    ar: "تم سداد قيمة هذا الطلب بالكامل مسبقاً",
    aliases: ["This order has already been fully settled"],
  },
  PAYMENT_AMOUNT_INVALID: {
    en: "Enter an amount above zero and no more than what is left to pay.",
    ar: "مبلغ السداد غير صالح أو يتجاوز الرصيد المتبقي",
    aliases: ["Payment amount must be greater than zero and cannot exceed the pending balance"],
  },
  PAYMENT_NOT_FOUND: {
    en: "We couldn't find that payment.",
    ar: "عملية الدفع غير موجودة",
    aliases: ["The requested payment transaction was not found"],
  },
  PAYMENT_ALREADY_SETTLED: {
    en: "This payment is already settled.",
    ar: "عملية الدفع تمت تسويتها مسبقاً",
    aliases: ["This payment transaction is already settled"],
  },
  INVALID_WEBHOOK_SIGNATURE: {
    en: "The payment confirmation couldn't be verified.",
    ar: "توقيع الويب هوك غير صالح",
    aliases: ["Invalid webhook cryptographic signature"],
  },
  ACTIVE_OFFLINE_PAYMENT_EXISTS: {
    en: "A cash or card payment for this table is already waiting for staff.",
    ar: "يوجد طلب سداد نقدي أو عبر نقطة البيع قيد المعالجة مسبقاً لهذه الطاولة",
    aliases: ["A pending cash/POS settlement request already exists for this table"],
  },
  ORDER_CANCELLED_CANNOT_PAY: {
    en: "This order was cancelled, so it can't be paid.",
    ar: "لا يمكن سداد طلب تم إلغاؤه",
    aliases: ["Cannot process payment for a cancelled order"],
  },
  ORDER_CANCELLED: {
    en: "This order was cancelled.",
    ar: "تم إلغاء هذا الطلب.",
    aliases: [
      "This order was cancelled, so there isn't a pickup code.",
      "تم إلغاء هذا الطلب، لذلك لا يوجد رمز استلام.",
    ],
  },
  ORDER_NOT_READY_FOR_HANDOVER: {
    en: "This order isn't ready for pickup yet.",
    ar: "هذا الطلب ليس جاهزاً للاستلام بعد.",
    aliases: ["This order isn't ready for pickup yet."],
  },
  PAYMENT_REQUIRED_BEFORE_HANDOVER: {
    en: "Take payment first, then scan again.",
    ar: "حصّل المبلغ أولاً، ثم امسح الرمز مجدداً.",
  },
  RATE_LIMITED: {
    en: "Too many attempts. Please wait a minute and try again.",
    ar: "محاولات كثيرة. يرجى الانتظار دقيقة ثم المحاولة مجدداً.",
    aliases: [
      "Too many requests. Please wait a moment and try again.",
      "طلبات كثيرة جدًا. يُرجى الانتظار قليلًا ثم المحاولة مرة أخرى.",
    ],
  },
  PRESENCE_VERIFICATION_REQUIRED: {
    en: "A staff member needs to confirm your table first. They'll be with you shortly.",
    ar: "يحتاج أحد الموظفين إلى تأكيد طاولتك أولاً. سيكون معك خلال لحظات.",
  },
  ACTIVE_ORDER_EXISTS: {
    en: "You already have an order with us. Here it is.",
    ar: "لديك طلب مفتوح معنا بالفعل. ها هو.",
  },
  CART_VERSION_CONFLICT: {
    en: "Cart updated by someone at your table",
    ar: "حدّث أحد على طاولتك السلة",
    aliases: ["The cart was updated elsewhere. Retry with the current version"],
  },
  CART_SUBMIT_CONFLICT: {
    en: "Cart updated by someone at your table",
    ar: "حدّث أحد على طاولتك السلة",
  },
  IF_MATCH_REQUIRED: {
    en: "Please try that again.",
    ar: "يرجى المحاولة مجدداً.",
    aliases: ["If-Match header is required", "رأس If-Match مطلوب"],
  },
  IDEMPOTENCY_KEY_REQUIRED: {
    en: "Please try that again.",
    ar: "يرجى المحاولة مجدداً.",
    aliases: ["Idempotency-Key header is required", "رأس Idempotency-Key مطلوب"],
  },
  EMPTY_CART: {
    en: "Your cart is empty. Take a look at the menu!",
    ar: "سلتك فارغة. ألقِ نظرة على القائمة!",
  },
  CROSS_TENANT_ACCESS_FORBIDDEN: { en: "That brand is outside your workspace." },
  BRANCH_ACCESS_FORBIDDEN: { en: "That branch is outside your workspace." },
  BRANCH_NOT_FOUND: { en: "We couldn't find that branch." },
  BRAND_SLUG_ALREADY_EXISTS: { en: "A brand with this name already exists. Try a different name." },
  BRANCH_SLUG_ALREADY_EXISTS: { en: "A branch with this name already exists in this brand. Try a different name." },
  SLUG_ALREADY_EXISTS: { en: "That name is already taken. Try a different one." },
  ROLE_FORBIDDEN: { en: "Your role can't do this." },
  API_UNREACHABLE: {
    en: "Can't reach the server. Check the connection and try again.",
    aliases: ["API unreachable."],
  },
  ASSISTANT_DISABLED: {
    en: "Not available yet",
    ar: "غير متاح بعد",
  },
  ASSISTANT_LIMIT_REACHED: {
    en: "You've reached this month's question limit.",
    ar: "وصلت إلى حد الأسئلة لهذا الشهر.",
  },
  PAYMOB_CURRENCY_MISMATCH: {
    en: "Paymob is set to a different currency than this branch.",
    ar: "عملة Paymob مختلفة عن عملة الفرع.",
  },
  PAYMOB_PHONE_REQUIRED: {
    en: "Enter a phone number so Paymob can take this payment.",
    ar: "أدخل رقم هاتف حتى يتمكن Paymob من تحصيل هذه الدفعة.",
  },
  PAYMOB_AUTH_FAILED: {
    en: "Paymob rejected the secret key. Check it in the Paymob dashboard and save it again.",
    ar: "رفض Paymob المفتاح السري. راجع المفتاح في لوحة Paymob ثم احفظه من جديد.",
  },
  PAYMOB_INTEGRATION_INVALID: {
    en: "Paymob doesn't recognize one of the integration ids. Check the card, wallet, and kiosk ids.",
    ar: "لم يتعرف Paymob على أحد معرّفات التكامل. راجع معرّفات البطاقة والمحفظة والكشك.",
  },
  PAYMOB_REJECTED: {
    en: "Paymob couldn't start this payment. Try again in a moment.",
    ar: "تعذّر على Paymob بدء هذه الدفعة. حاول مرة أخرى بعد لحظات.",
  },
  PUBLIC_API_BASE_URL_UNSET: {
    en: "Online payments aren't reachable yet. The public API address still needs to be set.",
    ar: "المدفوعات عبر الإنترنت غير متاحة بعد. عنوان الواجهة العام ما زال غير مضبوط.",
  },
  PAYMOB_REFUND_EXCEEDS_CAPTURED: {
    en: "That refund is more than the amount still available on this payment.",
    ar: "مبلغ الاسترداد أكبر من المبلغ المتبقي على هذه الدفعة.",
  },
  ACCESS_FORBIDDEN_BRAND_MISMATCH: {
    en: "You can only change Paymob for your own brand.",
    ar: "يمكنك تعديل Paymob لعلامتك فقط.",
  },
  PAYMOB_SECRET_KEY_FORMAT: {
    en: "The secret key doesn't match this mode. Test keys start with egy_sk_test_, and live keys start with egy_sk_live_.",
    ar: "المفتاح السري لا يطابق هذا الوضع. مفاتيح التجربة تبدأ بـ egy_sk_test_ ومفاتيح التشغيل تبدأ بـ egy_sk_live_.",
  },
  PAYMOB_PUBLIC_KEY_FORMAT: {
    en: "The public key doesn't match this mode. Test keys start with egy_pk_test_, and live keys start with egy_pk_live_.",
    ar: "المفتاح العام لا يطابق هذا الوضع. مفاتيح التجربة تبدأ بـ egy_pk_test_ ومفاتيح التشغيل تبدأ بـ egy_pk_live_.",
  },
  PAYMOB_HMAC_SECRET_MISSING: {
    en: "The HMAC secret is missing.",
    ar: "سر HMAC غير موجود.",
  },
  PAYMOB_INTEGRATION_REQUIRED: {
    en: "Add at least one integration id: card, wallet, or kiosk.",
    ar: "أضف معرّف تكامل واحداً على الأقل: بطاقة أو محفظة أو كشك.",
  },
  PAYMOB_GATEWAY_NOT_CONFIGURED: {
    en: "Paymob isn't connected for this brand yet.",
    ar: "Paymob غير متصل لهذه العلامة بعد.",
  },
  PAYMOB_SECRETS_REQUIRED: {
    en: "Enter the secret key, public key, and HMAC secret to connect Paymob.",
    ar: "أدخل المفتاح السري والمفتاح العام وسر HMAC لربط Paymob.",
  },
  PAYMOB_GATEWAY_INACTIVE: {
    en: "Online payments are turned off for this brand.",
    ar: "المدفوعات عبر الإنترنت متوقفة لهذه العلامة.",
  },
  PAYMOB_PHONE_INVALID: {
    en: "Enter a phone number with 8 to 15 digits. A leading + is fine.",
    ar: "أدخل رقم هاتف من 8 إلى 15 رقماً. يمكن أن يبدأ بعلامة +.",
  },
  PAYMOB_REFUND_NOT_CAPTURABLE: {
    en: "Only a completed Paymob payment can be refunded.",
    ar: "يمكن استرداد دفعة Paymob المكتملة فقط.",
  },
  PAYMOB_PAYMENT_IN_PROGRESS: {
    en: "A payment is already in progress for this order. Wait a moment, then try again.",
    ar: "هناك دفعة قيد التنفيذ لهذا الطلب. انتظر قليلاً ثم حاول مرة أخرى.",
  },
  IDEMPOTENCY_KEY_MISMATCH: {
    en: "That payment attempt changed. Start it again.",
    ar: "تغيّرت محاولة الدفع. ابدأها من جديد.",
  },
};

/** Free-text API replies that carry a known meaning. */
const PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^Role '.*' is not authorized to perform this operation\.?$/i, "ROLE_FORBIDDEN"],
  [/^Insufficient permissions\b/i, "ROLE_FORBIDDEN"],
  [/^Access to branch '.*' is forbidden for role\b/i, "BRANCH_ACCESS_FORBIDDEN"],
  [/^Branch '.*' not found within active tenant\.?$/i, "BRANCH_NOT_FOUND"],
];

const BY_TEXT = new Map<string, string>();
for (const [code, entry] of Object.entries(CATALOG)) {
  for (const text of [entry.en, entry.ar, ...(entry.aliases ?? [])]) {
    if (text) BY_TEXT.set(text.trim().toLowerCase(), code);
  }
}

const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

function rawDetail(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  if ("code" in error && typeof error.code === "string" && error.code in CATALOG) return error.code;
  if (!("detail" in error)) return null;
  const detail = error.detail;
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (detail && typeof detail === "object" && "code" in detail && typeof detail.code === "string") {
    return detail.code;
  }
  if (detail && typeof detail === "object" && "detail" in detail) {
    const nested = detail.detail;
    if (typeof nested === "string" && nested.trim()) return nested.trim();
  }
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (item && typeof item === "object" && "msg" in item ? String(item.msg) : ""))
      .filter(Boolean);
    if (messages.length) return messages.join(" ");
  }
  return null;
}

export function errorCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.trim();
  if (text in CATALOG) return text;
  const byText = BY_TEXT.get(text.toLowerCase());
  if (byText) return byText;
  for (const [pattern, code] of PATTERNS) {
    if (pattern.test(text)) return code;
  }
  return null;
}

/** A message safe to show in `locale`: known codes get our copy, and Arabic never leaks into English. */
export function friendlyMessage(raw: string | null, fallback: string, locale: LocaleCode = "en"): string {
  const code = errorCode(raw);
  if (code) {
    const entry = CATALOG[code];
    if (locale === "ar") return entry.ar ?? (raw && ARABIC.test(raw) ? raw : fallback);
    return entry.en;
  }
  if (!raw) return fallback;
  if (locale === "en" && ARABIC.test(raw)) return fallback;
  return raw;
}

export function errorDetail(error: unknown, fallback: string, locale: LocaleCode = "en"): string {
  return friendlyMessage(rawDetail(error), fallback, locale);
}

export class ApiError extends Error {
  status: number;
  code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function asApiError(error: unknown, response: Response, fallback: string, locale: LocaleCode = "en"): ApiError {
  const raw = rawDetail(error);
  const code = errorCode(raw) ?? (response.status === 410 ? "GUEST_SESSION_ENDED" : null);
  return new ApiError(response.status, friendlyMessage(raw ?? code, fallback, locale), code);
}

/** The API refused this caller's role, as opposed to a scope, network, or data problem. */
export function isRoleDenied(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 403 &&
    (error.code === "ROLE_FORBIDDEN" || error.code === "UNAUTHORIZED")
  );
}
