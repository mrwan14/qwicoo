# Restaurant ops frontend

Staff and guest UI for the existing order-backend API. This repository does not contain the FastAPI app.

## Run

1. Start order-backend at `http://127.0.0.1:8000`.
2. Copy env and install:

```bash
cp .env.example .env.local
npm install
npm run gen:api
npm run dev
```

Open the URL Next prints. If port 3000 is already taken, Next uses the next free port.

`API_BASE_URL` is the origin only. The app appends `/api/v1`. Regenerate types with `npm run gen:api` after the API changes. Do not hand-edit `src/lib/api/schema.ts`.

`npm run smoke` logs in through the local app and checks one staff read plus the guest routes. Set `SMOKE_BASE` if the app is not on `http://127.0.0.1:3000`.

## Demo logins

| Email | Password | Role | Lands on |
| --- | --- | --- | --- |
| admin@gourmet.com | Admin123! | Super admin | `/app/brands` |
| admin.alezz@mezban.com | Password123! | Brand admin | `/app/brands` |
| branchadmin@gourmet.com | Admin123! | Branch admin | `/app/floor` |
| cashier@gourmet.com | Admin123! | Cashier | `/app/pos` |

Kitchen staff lands on `/app/kds`. Waiter and runner land on `/app/floor`. Regional manager lands on `/app/brands`.

Gourmet and Al Ezz are different tenants. Some Gourmet branches have no `brand_id`.

## Role homes

- `SUPER_ADMIN`, `BRAND_ADMIN`, `REGIONAL_MANAGER` → `/app/brands`
- `BRANCH_ADMIN`, `WAITER`, `RUNNER` → `/app/floor`
- `CASHIER` → `/app/pos`
- `KITCHEN_STAFF` → `/app/kds`

Expo is a screen (`/app/kds/expo`), not a role. The staff UI is English. Guest pages are English and Arabic, with RTL when Arabic is selected. Bilingual menu fields are data, not a staff locale switch.

## Modules

| Route | Who | What |
| --- | --- | --- |
| `/t/[token]` | Guest | GPS or PIN presence, then join |
| `/order` | Guest | Menu, validate price, add to cart |
| `/order/checkout` | Guest | Review cart and place the order |
| `/order/track` | Guest | Active order, pay, cancel, handover |
| `/order/service` | Guest | Table service requests |
| `/b/[branchId]/pickup` | Guest | Drive-thru and delivery fee |
| `/app/floor` | Floor roles | Live tables. A 500 shows an empty state with retry |
| `/app/floor/requests` | Waiter, runner | Service queue |
| `/app/pos` | Cashier | Ticket, validate, checkout, cancel |
| `/app/kds` | Kitchen | Station tickets and bump |
| `/app/kds/expo` | Expo | Pass, notes, handover verify |
| `/app/menu` | Menu admins | Categories, items, 86, modifiers, stations |
| `/app/menu/combos` | Menu admins | Combo menus and components |
| `/app/menu/overrides` | Menu admins | Branch price overrides |
| `/app/qr` | Menu admins | Guest link, image, signed URL, batch zip |
| `/app/payments` | Cashier | Pending offline payments |
| `/app/brands` | Brand admins | Brands, branches, logo upload |
| `/app/branches/[branchId]` | Brand admins | Profile, location, financials, SLA, PIN, tables |
| `/app/staff` | Branch admins | Staff accounts |
| `/app/features` | Brand admins | Platform and brand features |
| `/app/delivery` | Brand admins | Governorates, zones, fees |
| `/app/financials` | Back office | Drawer and Z reports |
| `/app/attendance` | Back office | Check-in and cashier transactions (read-only) |
| `/app/analytics` | Brand admins | Dashboard, menu, branches |
| `/app/audit` | Brand admins | Audit log filters |

Phone layouts keep the primary actions in a bottom bar or a ticket sheet. POS splits catalog and ticket from the `lg` breakpoint. KDS bump buttons are at least 56px tall. Admin uses a sidebar from `lg` and a bottom bar plus More below 640px.

Polling pauses while `document.visibilityState` is `hidden`.

## Endpoint checklist

Guest session cookies are set by `POST /api/guest/session/verify` and `POST /api/guest/session/join` (`/sessions/verify-presence`, `/sessions/join`). `DELETE /api/guest/session` clears the cookie. The token never goes back to the browser.

Guest calls: menu tree, branch menu, validate-item-selection, cart get/add/remove/clear, checkout, active order, cancel, handover token, verified-action, offline payment request, online initiate, service requests, drive-thru, delivery governorates/zones, calculate-fee.

Staff auth: `POST /api/auth/login` → `/auth/token`, `GET /auth/me`, logout cookie clear.

Operations: floor live tables, order transition, service-request list/status/escalate, POS checkout and POS cancel, menu tree, validate-item-selection, KDS tickets, item bump, station bump, expo orders, expo bump, expo notes, ticket-item bump, handover verify.

Menu: staff categories, items, availability, modifier groups and options, kitchen stations, catalog-item create, menus, combo components, branch override, catalog patch, QR token, QR image, signed URL, verify, batch export.

Organization: brands, brand detail, branches, logo, media presigned URL, branch profile/location/financials/SLA/PIN/tables, staff list/create/update/deactivate, platform and brand features, delivery governorates, zones, fees.

Back office: drawer current/open/close, Z list/generate/detail, attendance status/check-in/check-out/logs/override, cashier transactions list, analytics dashboard/menu/branches, audit logs.

Not called from the browser:

- `POST /payments/webhooks/{provider}` is documented on the payments screen and is never requested.
- Cashier transaction edit and delete are omitted. The attendance screen lists transactions as read-only.
- Catalog item create is a secondary button. A 500 tells the operator to use the staff item form.
- Floor and table list 500s render an empty state with retry. Creating a table stays available.
- The price sent to the cart comes from `POST /menu/validate-item-selection`, not from the card label.

## Click test

1. Open `/` and choose Staff sign in.
2. Use a seed account. Confirm the address matches the role-home table.
3. On a phone-width window, confirm the bottom bar and the More sheet.
4. Change brand and branch. Confirm the working location updates.
5. Hide the tab. The banner should say updates are paused.
6. Open `/t/demo` (or a real QR token), switch to Arabic, and confirm the page direction is RTL.
7. Sign out. A refresh of a staff route should return to `/login`.
