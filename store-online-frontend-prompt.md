# B9 Store online orders — Cursor prompt

In `/Users/asd/code/food-app`, in the **dashboard worktree**, add POS phase B9 "Store online orders".
One commit. Do not push. Do not touch `src/features/guest/**`.

## Gate — stop unless all of these are true

- You are in the dashboard worktree, not `/Users/asd/code/food-app` on `feat/guest-redesign-v2`.
- The current branch is the dashboard branch (the one this window is using for mobile-v2 dashboard work).
- The delivery board (B4) commit already exists on that branch. Check with `git log --oneline` for a delivery-board / B4 commit. If it is missing, stop and say so.
- If any of the above is false, stop. Do not start B9 on `feat/guest-redesign-v2`.

## Backend (not in this repo; expected on order-backend `feat/mobile-v2`)

- `GET /api/v1/orders/store-online?status=new|packed|handed_over`
- `POST /api/v1/orders/{order_id}/store-online/packed`
- `POST /api/v1/orders/{order_id}/store-online/handed-over`
- `409 STORE_NOT_PACKED` when handover is attempted before pack
- Staff push kind `"store-online"` (phone); this app already has web-push subscriptions
- Cashier live event `STORE_ORDER_NEW` is backend-only. This app has **no staff cashier WebSocket**. Do not add one. Polling is the source of truth.

These paths are NOT in `src/lib/api/schema.ts` today. Do not hand-edit `schema.ts`.

## Feature check

- Probe `GET /api/v1/orders/store-online` (`status=new`) with `retry: false`.
- `200` → show the POS tab and the alert source.
- `404` or `405` → hide the tab and the alert source silently. Do not toast.
- Other errors → keep the tab if it was already shown; surface the usual `QueryErrorState` on the list only.
- Once the local API at `API_BASE_URL` serves the paths, run `npm run gen:api` and switch the client to `browserApi`. Until then, typed stubs.

## Stub contract (must match the backend prompt exactly)

Do not invent `id`, `vehicle`, `address_label`, or `is_paid`. Use these names so the tab works the moment the backend lands.

```ts
type StorePackStatus = "new" | "packed" | "handed_over";

type StoreOnlineLine = {
  order_item_id: string;
  item_id: string;
  name: string;
  quantity: number;
};

type StoreOnlineOrder = {
  order_id: string;
  display_number: string;
  pickup_number: number | null;
  store_pack_status: StorePackStatus;
  order_status: string;
  fulfillment_type: string; // DELIVERY | CURBSIDE | CURBSIDE_PICKUP | DRIVE_THRU | …
  customer_first_name: string | null;
  vehicle_info: { plate?: string; colour?: string; color?: string; make?: string } | null;
  delivery_address_label: string | null;
  arrived_at: string | null;
  payment_method: string | null;
  payment_status: string | null; // Paid when payment_status === "completed"
  total_amount: string;
  created_at: string;
  store_packed_at: string | null;
  store_packed_by_name: string | null;
  store_lines: StoreOnlineLine[];
  has_kitchen_items: boolean;
  branch_id?: string | null;
};
```

## B9.1 POS shell — `src/features/staff/pos-screen.tsx`

- Keep the existing New sale UI as-is (do not restyle it).
- Wrap it with a tab bar only when the feature check is on AND the role is `CASHIER`, `BRANCH_ADMIN`, `BRAND_ADMIN`, or `SUPER_ADMIN`.
- Hide the tab from `REGIONAL_MANAGER`, `WAITER`, `KITCHEN_STAFF`, `RUNNER`.
- Tabs: "New sale" (today's screen) and "Store online orders" with a count badge of `status=new`.
- Tab state in the URL: `?tab=store-online`. Default is New sale. Use `useSearchParams` + `router.replace` so toast "View" can open it.
- Tab chrome: sharp and square (copy the KDS station row in `kds-screen.tsx`: `min-h-11`, no `rounded-*`). New sale stays unchanged.

## B9.2 API — new `src/features/staff/pos/store-online-api.ts`

- Types above, plus `storeOnlineAvailable()`.
- `fetchStoreOnline(status)`, `markPacked(orderId)`, `markHandedOver(orderId)`.
- Use `browserApi` when the paths exist on `components["paths"]`; otherwise a small fetch helper that still sends cookies and `X-Branch-ID` / `X-Brand-ID` the same way `src/lib/api/browser.ts` does.
- On pack/handover success: `ignoreOwnChange(orderId, nextStatus)` and invalidate every store-online query for the branch.

## B9.3 Shared query key — `src/features/staff/alerts/queries.ts`

- Export `storeOnlineKey(branchId, status?)` as `["store-online", branchId, status]`.
- Export `fetchStoreOnlineNew()` that calls `fetchStoreOnline("new")`, so `OrderAlerts` and the tab share one cache (same pattern as `kdsTicketsKey` / `fetchKdsTickets`).

## B9.4 Tab UI — new `src/features/staff/pos/store-online-tab.tsx`

- Square cards. Each card:
  - `display_number` (and `pickup_number` when present) and channel (Delivery / Curbside / Drive-thru). Reuse `kdsCopy.driveThru`; add `delivery` + `curbside` keys on `posCopy`.
  - `customer_first_name`, plus `vehicle_info` plate/make or `delivery_address_label`.
  - "Paid" when `payment_status === "completed"`, otherwise "Cash due". Do not use `is_paid`.
  - Store lines as `name × quantity` (key by `order_item_id`).
  - "Waiting for the kitchen" when `has_kitchen_items`.
  - Packed button when `store_pack_status === "new"`.
  - Handed over button when `store_pack_status === "packed"` AND `!has_kitchen_items` (Store-only). Mixed kitchen+store orders are packed here, then leave Expo to hand food over.
- Filter chips: New / Packed / Handed over (square, like KDS stations). Empty state.
- `409 STORE_NOT_PACKED` → toast the catalog message (see B9.9).

## B9.5 Alerts diff — `src/features/staff/alerts/diff.ts`

- `AlertKind` += `"store-online"`.
- `StoreOnlineRow = { order_id: string; branch_id?: string | null; display_number?: string | null; pickup_number?: number | null; store_pack_status: string }`.
- `Snapshot` += `storeOnline?: StoreOnlineRow[]`.
- `KIND_SOURCE["store-online"] = "storeOnline"`.
- `ROLE_KINDS.CASHIER`: **add** `"store-online"` (keep `confirmation`, `floor-status`, `payment`). Do not replace the cashier list.
- `SUPER_ADMIN` / `BRAND_ADMIN` / `BRANCH_ADMIN`: add `"store-online"` (admins still need `adminOptIn` to hear anything).
- `diffSource` case `"storeOnline"`: new rows keyed by `order_id` whose `store_pack_status` is `"new"` (same `newRows` helper as kitchen). `place` = `placeLabel` (`pickup_number` / `display_number`).

## B9.6 Alerts watcher — `src/features/staff/alerts/order-alerts.tsx`

- `useQuery` for storeOnline when sources includes `"storeOnline"`, `queryKey storeOnlineKey(branchId, "new")`, `fetchStoreOnlineNew`, `refetchInterval POLL_MS` (7s), `retry: false`.
- Include `storeOnline.data` in the snapshot and the effect dependency list.
- `alertTitle` case: `fill(copy.newStoreOrder, { place })`.
- `PAGE["store-online"] = "/app/pos?tab=store-online"`.
- Toast + `playTone("new")` when a new store-online event appears (existing `toneFor` path).
- Re-chime: extract the kitchen pending loop into a small pure helper (e.g. `src/features/staff/alerts/rechime.ts`) keyed by source + entity id.
  - `RECHIME_MS = 45_000`, `MAX_RECHIMES = 2`, tick every 5s (keep current timing).
  - Kitchen behaviour must stay identical (`sub_ticket_id` pending key, `acknowledgedOrders` by order id).
  - Store-online pending key is `order_id`; it stops when the order leaves the new list or `acknowledgeOrder(orderId)` runs (opening the card or marking packed).
- Do not add a staff WebSocket.

## B9.7 Tests — `src/features/staff/alerts/diff.test.ts` and a new `rechime.test.ts`

- Add a store-online new row to `busy`.
- `kindsOf(CASHIER)` becomes `["confirmation", "payment", "store-online"]`. That assertion is the **diff of the busy snapshot**, not `ROLE_KINDS`. Cashier still has `floor-status` in `ROLE_KINDS`.
- Admin opt-in event count becomes 6 (was 5).
- New tests: a new store-online order raises one event; packed (row gone from the new list) raises none; `ignoreOwnChange` swallows the cashier's own pack.
- Re-chime helper tests: a live store-online id chimed at 45s and 90s, then stops (`count === 2`); leaving the new list or `acknowledgeOrder` stops further chimes.
- Kitchen re-chime tests if you extract that path — do not regress kitchen.

## B9.8 Expo — `src/features/staff/expo-screen.tsx`

- Line badge `"Store"` when a line has `badge === "Store"` (backend already sends this; `schema.ts` may not. Read it optionally: `"badge" in line ? line.badge : undefined`). Do not regenerate schema only for badge.
- Chip `"Store bag: New/Packed/Handed over"` from optional `order.store_pack_status`. Hide the chip when the field is missing.
- Labels from `kdsCopy.storeBag` + `posCopy` packed / handedOver / filterNew.

## B9.9 i18n

`src/lib/i18n/staff/pos.ts` (both `en` and `ar`):

- `storeOnlineTab` "Store online orders" / "طلبات المتجر أونلاين"
- `newSale` "New sale" / "بيع جديد"
- `packed` "Packed" / "تم التجهيز"
- `handedOver` "Handed over" / "تم التسليم"
- `markPacked` "Mark packed" / "تأكيد التجهيز"
- `markHandedOver` "Mark handed over" / "تأكيد التسليم"
- `waitingKitchen` "Waiting for the kitchen" / "بانتظار المطبخ"
- `cashDue` "Cash due" / "الدفع نقداً عند الاستلام"
- `paid` "Paid" / "مدفوع"
- `emptyStoreOnline` "No Store orders right now" / "لا توجد طلبات متجر حالياً"
- `delivery` "Delivery" / "توصيل"
- `curbside` "Curbside" / "استلام من السيارة"
- `storeOnlineFailed` "Store orders failed" / "تعذّر تحميل طلبات المتجر"
- `filterNew` "New" / "جديد"

`src/lib/i18n/staff/common.ts`:

- `newStoreOrder` "New Store order {place}" / "طلب متجر جديد {place}"

`src/lib/i18n/staff/kds.ts`:

- `storeBag` "Store bag" / "حقيبة المتجر"

`src/lib/api/error.ts` `CATALOG`:

- `STORE_NOT_PACKED`: en "Pack the Store items before handing over this order." / ar "جهّز منتجات المتجر قبل تسليم هذا الطلب."

Keep `src/lib/i18n/dictionaries.test.ts` passing (`en`/`ar` leaf keys must match).

## Done

- Run lint, tsc, tests, and the production build. All must pass.
- Do not commit guest files, `dist/`, `qwicoo-mobile.pen`, or this prompt file.
- Report: commit hash, files touched, whether `schema.ts` was regenerated or stubs remain, and whether the feature check hid the tab against the current API.
