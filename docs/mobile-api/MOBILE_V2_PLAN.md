# Qwicoo mobile — plan v2, revision 3 (multi-restaurant app, global account, Store, Delivery)

## Changes in this revision (rev 3, 15 Oct 2026)
- **Store oversell fixed (A7/A8):** Store stock is **reserved at checkout** (row-locked), converted to a deduction on PAID, released on cancel/expiry. Menu recipe deduction stays on PAID.
- **A6 expiry wording:** expiry releases stock only where it was reserved (Store lines); promo release unchanged.
- **A7 design check done:** recommendation is to **reuse `items` with `item_type='RETAIL'`** (existing feature `RETAIL_STORE`, branch overrides, availability, images) instead of a new `store_products` table; RETAIL lines will create no KDS ticket. Details in A7.
- **A3 acceptance gate:** backward-compatibility test for the current Mousa build + downgrade round-trip; A3 is not done until both pass.
- Q8 and Q15 remain pending. Rev 2 saved as `/workspace/qwicoo-mobile-plan-v2.rev2.bak.md`.

## Changes in rev 2 (15 Oct 2026)
- **Wallet removed from mobile scope** (Q5), demo wallet included: not in the Flutter contract; existing `/mobile/wallet/*` and the `demo_wallet` tender gated behind a new flag `MOBILE_WALLET_ENABLED=false` (backward-safe); no per-restaurant wallet in the account model; wallet auto-charge dropped from the bays phase.
- **Payments at launch** (Q13): cash + each restaurant's own Paymob (existing brand-owned Intention integration, no commission) for pickup and delivery. Refund recording and Paymob for mobile moved into launch scope, **before** delivery. Delivery payment: cash on delivery or Paymob prepaid.
- **Store management** (Q15): brand admins and branch admins, following the menu pattern — **ASSUMPTION — Marwan to confirm**.
- **Loyalty deferred** (Q19): former A8 removed from scope.
- **No email verification at launch** (Q8) — pending Marwan's confirmation.
- All other questions resolved with the recommended defaults.
- Phases renumbered: A0 baseline · A1 wallet gating · A2 MOBILE_APP + directory · A3 global identity · A4 public sign-up · A5 refund recording · A6 Paymob for mobile · A7 Store · A8 addresses + delivery · A9 push hardening · A10 drive-thru bays · A11 fallback removal. Previous revision (rev 1) saved as `/workspace/qwicoo-mobile-plan-v2.rev1.bak.md`.
Status: draft, 15 Oct 2026. **Supersedes** `/workspace/qwicoo-mobile-multibrand-plan.md` and `/workspace/qwicoo-mobile-cursor-brief.md` (no-register, one-brand-per-account). Facts verified read-only in `/Users/asd/src/order-backend` at `b8a844d` (local `main` = `feat/inventory`; mobile code identical to production `ccb1af9`). Staff dashboard: `/Users/asd/code/food-app` (Next.js 15.5; `src/features/{auth,guest,marketing,staff}`).

## Marwan's decisions (v2)
1. One Qwicoo app for all partner restaurants; super admin enables brand feature `MOBILE_APP`; only enabled brands appear. `MOBILE_BRAND_SLUG` pinning removed (temporary fallback only).
2. Flow: open app → pick restaurant (partners / featured) → sign up or log in → pick branch (if several) → browse menu + Store → order → track to completion/delivery.
3. Ordinary public sign-up.
4. One Qwicoo-wide account at every restaurant; order history per restaurant.
5. New Store: admin-uploaded products, separate from the menu, brands with `MOBILE_APP` only; stock; same cart as menu items.
6. Simple Delivery: restaurant's own drivers; restaurant marks "On the way", then "Delivered"; customer addresses; fee/zone set by the restaurant.
7. (rev 2) No wallet in mobile. Payments: cash + restaurant's own Paymob at launch. Loyalty deferred.

## Corrections and facts carried in
- Ports 8000 and 8011 are both intentional — leave alone.
- **Cancel refund (answer): no proper refund is recorded.** `mobile_order_service.cancel_order` (~L1049) calls `void_unsettled_payments` (fails PENDING / PENDING_CASHIER_VERIFICATION), then flips any COMPLETED `Payment.status` to REFUNDED in place, expires the handover token and calls `release_checkout_benefits` → `void_promo_for_order` + `wallet_service.refund_wallet_for_order` (a demo-wallet `order_refund` ledger credit). There is no separate refund row, no amount/actor/reason record, no gateway call and no cash-drawer payout entry. Acceptable only while tenders are cash (cancel allowed only before the kitchen starts, so cash is normally uncollected) and demo wallet.
- Production Firebase unverified → push is probably log-only (`app/services/push/factory.py` falls back to `LogPushSender` without `FIREBASE_*`).
- Production mobile smoke-tested 2 Oct 2026: 41 passing.
- Already present and reusable: `BrandFeature` (`app/models/feature_flag.py`, `feature_key`, `is_enabled_by_super_admin`, `config_overrides`; checked with `MultiMenuService.is_feature_enabled_for_brand`); delivery zones/fees (`app/models/delivery.py`: `delivery_governorates` per brand, `delivery_zones`, `branch_delivery_fees` with fee, ETA minutes, min order; `app/api/v1/delivery.py` `/delivery/*` incl. `/calculate-fee`, gated by feature `DELIVERY_MODULE`; `app/services/delivery_service.py`); `FulfillmentType.DELIVERY` exists (`app/models/enums.py:156`; `orders.fulfillment_type` is a String); inventory module (`app/models/inventory.py`: units, ingredients, warehouses, `inventory_stock_balances`, movements, recipes; `app/services/inventory/deduction.py`); `Item.item_type` String (default `PREPARED`).
- Caution: `orders.status/order_type/source` are **native** PG enums (`app/models/order.py:87-97`). Do not add values to them (not cleanly reversible); use new String + CHECK columns instead.

## Ground rules (every backend phase)
- Branch `feat/mobile-v2` cut from **local `main` (`b8a844d`)**; leave uncommitted `server.pid`, `tests/test_inventory_phase1.py` alone. Never push; never touch `.env*`, Railway or the production DB. Marwan reviews and merges.
- One reversible Alembic revision per schema phase from head `e3a5b7c9d1f2`; String + CHECK, no native enums; upgrade → downgrade → upgrade tested locally.
- Additive and backward compatible for current builds (single-brand Mousa app): no removed/renamed fields or paths; new request fields optional; `MOBILE_BRAND_SLUG` used only when the client sends no brand.
- Each phase: regenerate `docs/mobile-api/{mobile-openapi,openapi}.{json,yaml}` (`scripts/export_openapi.py`), update `MOBILE_API_GUIDE.md`, `RELEASE_NOTES.md`, i18n ar/en (`app/core/i18n.py`); `tests/test_openapi_mobile_docs.py` passes; pytest no regressions beyond the 8 known failures (`test_mobile_pickup_realtime` re-run alone if it fails).
- **STOP** after each phase for Marwan's review.

---
# Part A — Backend

## A0 — Baseline (no migration)
Record pytest baseline; read-only local data report: customers per brand, duplicate emails across brands (case-insensitive), duplicate phones, customers with sessions/vehicles/my_usual/orders, demo-wallet rows (expected none in prod). Add brand loaders by id/slug in `app/services/mobile_brand.py`. STOP.

## A1 — Gate the wallet off (no migration)
- New setting `MOBILE_WALLET_ENABLED: bool = False` in `app/core/config.py` (separate from `MOBILE_DEMO_WALLET_ENABLED`; wallet routes require both). When off: `GET /mobile/wallet`, `POST /mobile/wallet/demo-topup` → 404 `WALLET_NOT_AVAILABLE` and marked `deprecated` / hidden from `mobile-openapi.*` (`include_in_schema` off, guide section removed); `mobile_tenders.py` does not register `demo_wallet` (checkout → existing `PAYMENT_METHOD_NOT_AVAILABLE`); `CustomerProfileResponse.wallet` stays present and always `null` (backward-safe for current builds); quote `payment_options` no longer lists demo_wallet.
- Keep tables `customer_wallets` / `wallet_ledger_entries` and code untouched (no data loss; revisit for deletion later). `release_checkout_benefits` keeps calling `refund_wallet_for_order` (no-op without wallet rows).
- Tests: wallet routes 404 by default; flags on (test override) keep existing `test_mobile_promo_wallet.py` wallet cases passing; docs test updated. STOP.

## A2 — `MOBILE_APP` feature and restaurant directory (revision)
- Migration: seed `platform_features` row `MOBILE_APP` (default off); data step enables it for `mousa-cafe` in `brand_features`. Add `brands.mobile_featured` Boolean default false, `brands.mobile_sort_order` int default 0, `brands.mobile_logo_url`/`mobile_cover_url` String NULL. Downgrade removes rows/columns.
- Public endpoints (`app/api/v1/mobile/restaurants.py`, `app/schemas/mobile_restaurants.py`, `app/services/mobile_restaurant_service.py`): `GET /mobile/restaurants?featured=&q=&lat=&lng=` → `{items:[{id, slug, name, logo_url, cover_url, featured, branch_count, nearest_branch_km, fulfilment:{pickup, drive_thru, curbside, delivery}, has_store, payment_methods:["cash","card"]}]}`; `GET /mobile/restaurants/{slug}`. Ordering: featured first by `mobile_sort_order`, then distance if location shared, else name.
- Branch/catalog routes accept optional `brand_slug`, plus aliases `/mobile/restaurants/{slug}/branches[/{id}[/catalog]]`; no slug → `MOBILE_BRAND_SLUG` fallback → else 400 `BRAND_REQUIRED`.
- `app/services/branch_service.py:252` gate → "brand has `MOBILE_APP`" (`MOBILE_APP_NOT_ENABLED_FOR_BRAND`). Super admin toggles via existing feature-flag API.
- Tests: only enabled brands listed; disabled → 404 `RESTAURANT_NOT_FOUND`; old calls still return Mousa. STOP.

## A3 — Global identity + per-brand membership (revision)
- `customers` = global identity (email unique globally, case-insensitive). New `customer_brand_memberships` (`id`, `customer_id`, `brand_id`, `tenant_id`, `status` String CHECK active/blocked, `joined_at`, `last_order_at`, `preferred_branch_id`, `my_usual` JSONB, `my_usual_updated_at`, `marketing_opt_in`; unique `(customer_id, brand_id)`). **No wallet in the membership or account model.**
- Migration (reversible): create memberships and backfill one per existing customer; make `customers.brand_id`/`tenant_id` nullable (legacy origin brand); dual-write `preferred_branch_id`/`my_usual` for one release; add `uq_customers_email_global` on `lower(email)` only if A0 shows no cross-brand duplicates (expected clean: only Mousa). Downgrade reverses.
- Dedupe (only if needed): keep most recent login as primary, re-point sessions/devices/vehicles/orders/promo redemptions, mark others `deleted_at` + `merged_into_id`, require in-app confirm (`ACCOUNT_MERGE_REQUIRED`).
- Brand context: header `X-Qwicoo-Brand: <slug>` or token `brand_id` (active restaurant), then fallback. `app/api/deps_customer.py` → `CustomerContext{customer, session_id, brand|None, membership|None}`; `require_brand_context` auto-creates membership on first brand action; blocked membership → 403 `MEMBERSHIP_BLOCKED`.
- Touch: `customer_auth_service.py`, `app/core/customer_security.py`, `websocket.py` (`customer_{id}` channel, no brand check), profile, my_usual, orders, promo, vehicles services.
- Endpoints (additive): `POST /mobile/auth/switch-restaurant {brand_slug}`; `GET /mobile/profile/restaurants` (memberships + order counts); `GET /mobile/orders?brand=` (per restaurant, with "All").
- Tests: one login orders at A and B; history per brand; cross-brand access 404.
- **Acceptance gate (A3 is not done until both pass):**
  1. `tests/test_mobile_v2_backcompat.py` — simulates the current single-brand Mousa build *after* the migration: no `X-Qwicoo-Brand` header, old login body `{email, password, remember_me}` (no `brand_slug`), and an access + refresh token minted **before** the migration (old claims). It must: log in, refresh (rotation still works), call `GET /mobile/branches` and `/branches/{id}/catalog` and get Mousa, `POST /orders/quote` and `POST /orders` (cash) successfully, read `GET /profile/me` and `/profile/my-usual` with unchanged response shapes (no removed/renamed fields), and open the customer WebSocket.
  2. `tests/test_migration_a3_roundtrip.py` — on a seeded DB: `upgrade` → data checks (one membership per customer, my_usual/preferred branch copied) → `downgrade -1` → `customers.brand_id`/`tenant_id` NOT NULL restored with original values, membership data copied back, global email index gone → `upgrade` again idempotently.
  STOP.

### Per-brand behaviour under a global account
| Thing | Scope | Notes |
|---|---|---|
| Identity, password, email, phone (normalised E.164, not unique), avatar, language | Global | `customers` |
| Sessions, refresh tokens | Global per device login | active restaurant per request/token |
| FCM tokens / devices | Global, one row per device | single Qwicoo app → global unique `fcm_token` is correct; pushes carry `brand_slug` + restaurant name |
| Notifications log | Per order (so per brand) | unchanged |
| Orders / history | Per brand (+ "All" tab) | via branch → brand |
| My usual, preferred branch | Per brand | membership |
| Vehicles | Global | `customer_vehicles.brand_id` becomes legacy/nullable; verification global |
| Addresses | Global | A8 |
| Promos | Per brand | existing `promo_codes.brand_id` |
| Blocking | Restaurant blocks membership; super admin blocks global account | |
| Wallet | **Out of scope** | gated off (A1) |
| Loyalty | **Deferred** | |

## A4 — Public sign-up and auth polish (no migration)
- `POST /mobile/auth/register` public; optional `brand_slug` creates membership; global email (409 `EMAIL_ALREADY_REGISTERED`). Login `{email, password, remember_me, brand_slug?}`; `AuthResponse` adds `memberships[]`, `active_restaurant`.
- **No email verification at launch — pending Marwan's confirmation (Q8).** Rate limits on register/login/forgot. Global forgot/reset with the Qwicoo deep link. STOP.

## A5 — Refund recording (revision) — launch scope
- `payment_refunds` (`id`, `payment_id`, `order_id`, `amount` Numeric(10,2), `method` String, `reason`, `actor_type` String CHECK customer/staff/system, `actor_id`, `cash_drawer_session_id` NULL, `provider` String NULL, `provider_ref` NULL, `status` String CHECK pending/succeeded/failed, `created_at`).
- Cancel paths (`mobile_order_service.cancel_order`, `order_service.py:758`, `paymob_payment_service.py` refund paths) write a refund row in addition to the REFUNDED status flip (kept for compatibility). Collected cash refunds require an open drawer session and appear as payouts in drawer/Z-report (`app/models/financials.py` `CashDrawerSession`); Paymob refunds via existing `paymob_refunds.py` with `status` pending → succeeded on callback.
- Staff read API `GET /orders/{id}/refunds`; reports include refunds. Tests: cash-uncollected cancel (no refund row, payment voided), collected cash, Paymob refund success/failure, drawer maths. STOP.

## A6 — Paymob for mobile (revision) — launch scope
- `PaymobTender` in `app/services/mobile_tenders.py` using the existing Intention API (`paymob_payment_service.py`) with **the restaurant's own** keys (`app/models/payment_gateway.py`, `brand_payment_gateways`, decrypted with `PAYMENT_SECRETS_KEY`; no Qwicoo commission), redirect/notification URLs from `PUBLIC_API_BASE_URL`; settlement only via HMAC webhook `/api/v1/webhooks/paymob`; paid → `mark_order_paid` → inventory deduction; expiry job (every 15 min) cancels unpaid card orders, releases the promo redemption, and releases stock **only where it was reserved** (Store/RETAIL lines, A7); menu recipe stock is untouched because it is deducted only on PAID.
- Migration: `orders.payment_due_by` DateTime NULL (card orders must be paid before the kitchen sees them); link of Payment ↔ Intention reuses existing columns where possible.
- Checkout: `payment_method: "cash" | "card"`; card response `payment:{status:"awaiting_payment", checkout_url, expires_at}`; card orders are published to KDS only after the webhook marks them paid. Card availability per brand = active gateway configured (`payment_methods` in restaurant listing). Errors: `PAYMENT_GATEWAY_NOT_CONFIGURED`, `PAYMENT_EXPIRED`.
- Customer cancel of a paid card order → A5 refund via Paymob.
- Tests with mocked Paymob HTTP: keys per brand, HMAC ok/bad, idempotent webhook, expiry, cross-brand mismatch, no secrets in logs. Sandbox E2E only with test keys configured by Marwan. STOP.

## A7 — Store (revision)
### Design check (do first) — reuse `items` vs new `store_products`
Read from code at `b8a844d`:
- `Item` (`app/models/catalog.py`) already has `brand_id`, `category_id`, `menu_id`, localised `name`/`description` JSONB, `base_price`, `image_url`, `is_available` (86 switch), `is_active`, `deleted_at`, `scope` (`MenuItemScope`, non-native), `station_id`/`station`, and **`item_type` String(30)** whose documented values are `PREPARED`, `RETAIL`, `COMBO` (`app/schemas/staff_menu.py:97`).
- RETAIL is already gated by brand feature **`RETAIL_STORE`** (`MultiMenuService.validate_item_type`, `app/services/multi_menu_service.py:379`; enforced in `staff_menu_service.py:347/477` → 403 `RETAIL_MODULE_LOCKED`).
- `BranchMenuOverride` (`app/models/menu.py`): per-branch `price_override`, `is_available`, `is_visible`; used by the mobile catalogue (`mobile_pricing_service.mobile_catalog_statement`, `effective_price`, `effective_available`) — branch-own items via `Category.branch_id` already give the "branch admin owns branch products" menu pattern (Q15).
- KDS: `KDSExpoService` (`app/services/kds_expo_service.py:72,132`) already treats RETAIL specially — it creates a ticket item at station `ASSEMBLY` with status READY (so today a RETAIL line **does** create a KDS ticket item).
- Inventory: recipes target `MENU_ITEM` (`RecipeTarget`), and `b8a844d` added "stocked prep deduction", so a RETAIL item can map 1:1 to an ingredient and deduct on PAID through the existing `deduct_for_paid_order`.
- The mobile catalogue query does not filter `item_type`, so any RETAIL items are currently mixed into the menu catalogue.

**Recommendation: reuse `items` with `item_type='RETAIL'`; do not create `store_products`.** Reasons: images, bilingual names, prices, branch overrides, 86/availability, branch-own items, staff menu screens, feature gate (`RETAIL_STORE`), order lines (`order_items.item_id`), reports and inventory recipes all already work for items; a mixed cart needs no new line kind or nullable `item_id`; promos and pricing reuse one path. Costs: (a) a per-branch quantity + reservation is needed (not on overrides today); (b) KDS must stop creating the ASSEMBLY ticket for RETAIL; (c) the mobile catalogue must exclude RETAIL and the Store endpoint include only RETAIL; (d) "Store" requires both `RETAIL_STORE` and `MOBILE_APP`. A separate table would duplicate all of the above for little gain.

### Implementation
- **Migration (reversible):** `branch_menu_overrides.stock_quantity` Numeric(12,3) NULL (NULL = not tracked here), `branch_menu_overrides.reserved_quantity` Numeric(12,3) NOT NULL default 0, CHECK `reserved_quantity >= 0` and `stock_quantity IS NULL OR stock_quantity >= reserved_quantity`; `items.max_per_order` int NULL; new `stock_reservations` (`id`, `order_id`, `order_item_id`, `branch_id`, `item_id`, `ingredient_id` NULL, `quantity`, `status` String CHECK held/consumed/released, `expires_at`, `created_at`, `resolved_at`; index (order_id), partial index on held). Downgrade drops them.
- **Stock source per RETAIL item:** if the item has a 1:1 inventory recipe → availability = branch warehouse `inventory_stock_balances` minus held reservations for that ingredient; else `branch_menu_overrides.stock_quantity − reserved_quantity`; else (no tracking) just `is_available`.
- **Reserve at checkout (oversell fix):** in `place_order`, inside the order transaction, lock rows (`SELECT … FOR UPDATE` on the override row, or on the `inventory_stock_balances` row for ingredient-linked items), check available ≥ qty (`STORE_OUT_OF_STOCK`, `STORE_MAX_PER_ORDER`), increment `reserved_quantity` / insert `stock_reservations` status `held`. Applies to pickup, cash-on-delivery and card orders alike.
- **Convert on PAID:** in `order_lifecycle.mark_order_paid` (cash) and the Paymob webhook (card): for each held reservation, decrement `stock_quantity` and `reserved_quantity` (or, for ingredient-linked, let `deduct_for_paid_order` post the movement and mark the reservation `consumed`) — idempotent per reservation.
- **Release:** on cancel (`cancel_order`, staff cancel), A6 card expiry, and a reservation TTL sweep (held > N hours with order still unpaid and not active → release; default 24 h, configurable) → `reserved_quantity −= qty`, status `released`. Refund after PAID (A5) → stock reversal via existing `reverse_sale` / quantity increment.
- **Menu recipe deduction stays on PAID** (unchanged); reservations apply only to RETAIL lines.
- **KDS:** change `KDSExpoService` RETAIL branch to **create no `KitchenTicketItem`**; Expo/handover/packing list reads RETAIL lines from `order_items` with a "Store" badge. Check POS/dine-in RETAIL behaviour in `tests/test_kds_expo_and_drive_thru.py` and related tests; if other channels rely on the ASSEMBLY ticket, restrict the change to orders where `order_channel(order) == "MOBILE"` and note it.
- **Catalogue split:** `mobile_catalog_statement` excludes RETAIL for the menu; new `GET /mobile/restaurants/{slug}/branches/{id}/store` returns RETAIL only → `{categories:[{id, name, products:[{id, name, description, image_url, price, is_available, stock_hint:"in_stock|low|out", max_per_order}]}]}`. Store items go in the normal `items[]` of quote/checkout (no new `store_items` field needed). Requires `MOBILE_APP` + `RETAIL_STORE` (else 403 `STORE_NOT_ENABLED`). Compat note: Mousa currently has no RETAIL items expected (verify in A0); if it has, they move from catalogue to Store — flag to the Flutter dev.
- **Permissions — ASSUMPTION — Marwan to confirm (Q15):** same as the menu: BRAND_ADMIN/SUPER_ADMIN manage brand-wide RETAIL items and any branch's override/stock; BRANCH_ADMIN manages its own branch's items (branch categories), its branch overrides, stock and availability, and reads brand-wide items only. Reuse existing staff menu endpoints (`app/api/v1/staff_menu.py`) with `item_type=RETAIL`; add `PATCH /staff/menu/items/{id}/branches/{branch_id}/stock {stock_quantity}`.
- **Tests:** two concurrent checkouts for the last unit (one gets `STORE_OUT_OF_STOCK`); COD order holds stock until Delivered/PAID then converts; cancel and expiry release; card webhook converts; ingredient-linked path; no KDS ticket for RETAIL; menu items unaffected; role matrix; brand isolation. STOP.

## A8 — Addresses and Delivery (revision) — after A5/A6
- `customer_addresses` (global; label, street, building, floor, apartment, landmark, lat/lng NULL, phone NULL, is_default, deleted_at). Zones are per brand: the restaurant matches its own zone at quote; customer picks a zone if ambiguous (`delivery_zone_id` on quote).
- Orders: `delivery_status` String CHECK awaiting_dispatch/on_the_way/delivered, `delivery_address_snapshot` JSONB, `delivery_fee`, `delivery_zone_id`, `out_for_delivery_at`, `delivered_at`, `delivered_by_user_id`. Native `order_status` untouched: READY → awaiting_dispatch; staff On the way; staff Delivered → existing `DELIVERED` (staff "Delivered" closes it; no customer confirm required).
- Fee from existing `branch_delivery_fees` (flat per zone + min order) via `delivery_service.py`; requires `DELIVERY_MODULE` + `MOBILE_APP` + `branches.is_mobile_delivery_enabled` (new, default false).
- Payment: **cash on delivery** (driver collects; staff records cash at Delivered → drawer of the branch → `mark_order_paid`; Store stock is already reserved since checkout (A7) and converts to a deduction here) or **Paymob prepaid** (A6; kitchen sees it after payment).
- Mobile: `/mobile/addresses` CRUD + set-default; quote/checkout `fulfillment_type:"delivery"`, `address_id`; response `delivery:{status, status_label, fee, eta_minutes, address}`. Staff: `POST /orders/{id}/delivery/on-the-way`, `/delivered` (with `cash_collected` for COD), `GET /orders/delivery?status=`. Push/WS `order_on_the_way`, `order_delivered`. Errors `DELIVERY_NOT_AVAILABLE`, `ADDRESS_OUT_OF_ZONE`, `BELOW_MIN_ORDER`. STOP.

## A9 — Push delivery hardening (no migration)
Single Qwicoo Firebase project; Marwan sets prod credentials; super-admin `GET /admin/push/status` shows sender type (FCM vs log); pushes include restaurant name/brand_slug; FCM payload tests. STOP.

## A10 — Drive-thru bays (revision)
`branches.drive_thru_bay_count`, `orders.pickup_bay`, customer-reported bay on arrival, ready-at-bay push. (Wallet auto-charge removed.) STOP.

## A11 — Fallback removal (later)
After all builds are on the Qwicoo app: remove `MOBILE_BRAND_SLUG`, end dual-write, drop legacy `customers.brand_id` (separate revision). STOP — final review.

### Launch line
Launch = A0–A8 (+ A9 strongly recommended). A10–A11 post-launch.

### Deferred (out of scope)
- Loyalty tiers/points (former A8 in rev 1).
- Customer wallet / stored value / top-up / auto-charge (tables kept, endpoints gated off).
- Email verification (pending Q8).

---
## How mobile orders flow into staff systems (v2)
| Flow | KDS / Expo | Handover | Payments / cash drawer | Inventory | Reports |
|---|---|---|---|---|---|
| Menu items (pickup / drive-thru / curbside) | as today: station tickets, `ORDER_SUBMITTED` to kitchen/runners | QR pickup pass | cash at pickup or Paymob prepaid (A6) | deduct on PAID (recipes) | channel MOBILE |
| Store (RETAIL items) | **no KDS ticket**; shown on Expo/packing list with "Store" badge | packed with order | same order payment | **reserved at checkout**, converted on PAID, released on cancel/expiry | `item_type=RETAIL` → Store sales split in reports (filter) |
| Delivery | same KDS; Expo "Ready" → `awaiting_dispatch`; staff On the way / Delivered | no QR; staff marks delivered | cash on delivery recorded at Delivered (branch drawer) or Paymob prepaid | on PAID | delivery fee as separate line in reports and Z-report |
| Cancel | KDS cancel event | token expired | A5 refund row; cash payout in drawer if collected; Paymob refund via gateway | reverse deduction (`reverse_sale`) | refunds report |

---
# Part B — Staff dashboard (`/Users/asd/code/food-app`, Next.js)
Style: sharp, square, **no border radius**; English and Arabic (RTL). Work in `src/features/staff`; never deploy.
- B1 Super admin: brand list → toggle `MOBILE_APP`, featured flag, sort order, logo/cover upload.
- B2 Store = RETAIL items in the existing menu screens (filter/tab "Store"), per the ASSUMPTION in A7; add per-branch stock quantity and reserved/available display: list/create/edit (bilingual name/description, image, price, SKU, status, link to inventory ingredient, max per order); per-branch availability/stock/price override; low-stock badge.
- B3 Delivery settings: per-branch mobile delivery toggle; reuse governorates/zones/fees screens (`/delivery/*`).
- B4 Orders board: filters (Mobile, Delivery, Store); delivery column with buttons **On the way** / **Delivered** (+ cash collected confirm); address and phone panel; Store lines in a "Pack" section; Expo shows Store badge.
- B5 Customers (brand scope): members list with order counts, block membership (brand-level, not global account).
- B6 Refunds (after A5): refund history, drawer payouts. B7 Paymob status per brand (gateway configured / card enabled) after A6. B8 Bays after A10. No wallet or loyalty screens.
- Each screen ar/en strings, RTL check, screenshots for review; STOP per sub-phase.

---
# Part C — Flutter API contract (Qwicoo app)
Base `https://api.qwicoo.com/api/v1/mobile`; `Accept-Language: ar|en`; `Authorization: Bearer <access>`; brand-scoped calls send `X-Qwicoo-Brand: <slug>`. Money strings `"20.52"`; UTC ISO times.

**Not in the app:** wallet (any form) and loyalty. Do not call `/wallet/*`; `profile.wallet` is always null.

**Flow:** `GET /restaurants?featured=true` → pick → (`POST /auth/register` | `/auth/login`) → `GET /restaurants/{slug}/branches` (auto-pick if one) → `GET …/branches/{id}/catalog` + `GET …/branches/{id}/store` → cart → `POST /orders/quote` → `POST /orders` → track via `GET /orders/{id}` + WS `wss://…/api/v1/ws?token=` + push → pickup pass (pickup) or delivery status (delivery).

| Area | Endpoint | Key fields |
|---|---|---|
| Restaurants | `GET /restaurants`, `GET /restaurants/{slug}` | id, slug, name, logo_url, cover_url, featured, fulfilment{}, has_store, branch_count |
| Auth | `POST /auth/register` {full_name, email, phone, password, terms_accepted, remember_me, brand_slug?}; `POST /auth/login` {email, password, remember_me, brand_slug?}; `POST /auth/refresh`; `POST /auth/logout` {fcm_token?}; forgot / reset preview / reset / change-password | AuthResponse {access_token, refresh_token, expires_in, customer, memberships[], active_restaurant} |
| Profile | `GET/PATCH /profile/me`, avatar, `DELETE /profile/me`, `GET /profile/restaurants` | |
| Per restaurant | `GET/PUT/DELETE /profile/my-usual` (brand header) | selected_groups, special_instructions |
| Branches & menu | `GET /restaurants/{slug}/branches`, `…/branches/{id}/catalog` | modifier groups, is_available (sold out) |
| Store | `GET /restaurants/{slug}/branches/{id}/store` | products[], price, is_available, stock_hint, max_per_order |
| Addresses | `GET/POST /addresses`, `PATCH/DELETE /addresses/{id}`, `PATCH /addresses/{id}/set-default` | label, street, building, floor, apartment, landmark, lat/lng, governorate_id, zone_id |
| Orders | `POST /orders/quote`, `POST /orders` {branch_id, fulfillment_type: pickup|drive_thru|curbside|delivery, vehicle_id?, address_id?, items[] (menu and Store items alike), promo_code?, payment_method: cash|card}; `GET /orders?brand=`, `/orders/active`, `/orders/{id}`, `/orders/{id}/pickup-pass`, `/orders/{id}/arrived`, `/orders/{id}/cancel` | status placed/preparing/ready/completed/cancelled; delivery{status awaiting_dispatch/on_the_way/delivered, fee, eta_minutes}; payment{status, checkout_url?, expires_at?} — open checkout_url for card; order goes to the kitchen after payment |
| Vehicles | `/vehicles*` (global) | make, model, color, plate_number, verification_status |
| Promo | `POST /promotions/validate` {code, branch_id, items} | |
| Push | `POST/DELETE /notifications/fcm-token` {fcm_token, device_os} | events: order_preparing, order_ready, order_on_the_way, order_delivered, order_cancelled (+ brand_slug) |

Error codes (new): `BRAND_REQUIRED`, `RESTAURANT_NOT_FOUND`, `MOBILE_APP_NOT_ENABLED_FOR_BRAND`, `EMAIL_ALREADY_REGISTERED`, `MEMBERSHIP_BLOCKED`, `STORE_NOT_ENABLED`, `STORE_OUT_OF_STOCK`, `STORE_MAX_PER_ORDER`, `DELIVERY_NOT_AVAILABLE`, `ADDRESS_OUT_OF_ZONE`, `BELOW_MIN_ORDER`, `PAYMENT_METHOD_NOT_AVAILABLE` (existing), `PAYMENT_GATEWAY_NOT_CONFIGURED`, `PAYMENT_EXPIRED`, `ACCOUNT_MERGE_REQUIRED` (only if dedupe needed). Existing codes unchanged (see guide §10).

---
## Carried-over gaps from v1
Bays (A10), Paymob for mobile (A6, launch), refund recording (A5, launch — currently none), FCM unverified/probably log-only (A9); loyalty deferred, phone not unique/normalised (Q7), customer token does not `require` brand claims (handled in A2), docs copy at `/workspace/qwicoo-mobile-api-docs/` is stale.

---
## Open questions for Marwan
### Pending
- **Q8 Email verification:** none at launch — *pending Marwan's confirmation*.
- **Q15 Store management:** brand admins and branch admins, menu pattern (branch admins manage own-branch products, stock, availability; read-only on brand-wide products) — **ASSUMPTION — Marwan to confirm**.

### Resolved
1. `MOBILE_BRAND_SLUG` fallback kept for old Mousa builds until A11, then removed.
2. Restaurant order: featured by `mobile_sort_order`, then distance, else name.
3. Add plain counter `pickup` alongside drive_thru/curbside.
4. Duplicate emails: none expected; if found, keep most recent login and require in-app merge confirmation.
5. **Wallet: removed from mobile scope** (incl. demo); endpoints gated off by `MOBILE_WALLET_ENABLED=false`.
6. Vehicles global per customer; verification global.
7. Phone not unique; normalised to E.164.
9. Store stock: inventory ingredient link when used, else per-branch quantity on the branch override; reserved at checkout (rev 3).
10. Store products available for pickup and delivery, same cart.
11. Global address book; restaurant matches its own zone at quote.
12. Staff "Delivered" closes the order; no customer confirmation step.
13. **Payments: cash + each restaurant's own Paymob (no commission) for pickup and delivery at launch;** delivery = cash on delivery or Paymob prepaid. Refunds (A5) and Paymob (A6) are launch scope.
14. Delivery fee from existing `branch_delivery_fees` (flat per zone + min order).
16. Restaurants block memberships; only super admin blocks a global account.
17. Order history per restaurant with an "All" tab.
18. Cash refunds of collected money require an open drawer session.
19. **Loyalty: deferred, out of scope.**
20. Single Qwicoo Firebase project; Marwan configures production credentials.
