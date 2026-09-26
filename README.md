# Qwicoo frontend

Staff and guest UI for the order-backend API. This repository does not contain the FastAPI app.

## Run

1. Start order-backend locally (the invite flow needs the branch that ships `/api/v1/invitations`; it runs at `http://127.0.0.1:8010` on the dev machine).
2. Copy env and install:

```bash
cp .env.example .env.local
npm install
API_BASE_URL=http://127.0.0.1:8010 npm run gen:api
npm run dev
```

The dev server listens on `http://localhost:3001`. The API builds invitation links from its `FRONTEND_URL`, which defaults to that origin, so emailed links open the local app.

`API_BASE_URL` is the origin only. The app appends `/api/v1`. Regenerate types with `npm run gen:api` after the API changes (pass `API_BASE_URL` to point it at the right API). Do not hand-edit `src/lib/api/schema.ts`.

`npm run smoke` logs in through the local app as the App Admin, checks the auth, brand, branch, and invitation reads, and hits the public routes. Set `SMOKE_BASE` if the app is not on `http://127.0.0.1:3001`; `SMOKE_ADMIN_EMAIL` / `SMOKE_ADMIN_PASSWORD` override the account; `SMOKE_STAFF_EMAIL` / `SMOKE_STAFF_PASSWORD` enable the staff menu read.

## Entry routes

- `/` is the public landing page.
- `/admin` signs in `SUPER_ADMIN` only.
- `/restaurant-dashboard` asks for a role first (Brand manager, Branch manager, Staff), then signs in. `?role=brand|branch|staff` keeps the choice on refresh.
- `/login` redirects to `/restaurant-dashboard`.
- `/invite/accept?token=…` is the public page an invited person opens from their email. It previews the invitation, asks for a password, then signs them in.
- Sign-in rejects an account whose role is outside the chosen group. Brand manager is `BRAND_ADMIN` and `REGIONAL_MANAGER`; Branch manager is `BRANCH_ADMIN`; Staff is `CASHIER`, `WAITER`, `RUNNER`, `KITCHEN_STAFF`.

The login form is plain email and password. No credentials are embedded in the client and nothing signs in automatically.

## Accounts after a database reset

The API reset script (`scripts/reset_bootstrap_app_admin.py` in order-backend) wipes the database and seeds one account. Everyone else is invited by email.

| Email | Password | Role | Sign in at | Lands on |
| --- | --- | --- | --- | --- |
| admin@qwicoo.com | Qwicoo!Admin2026 | App Admin (`SUPER_ADMIN`) | `/admin` | `/app/brands` |

Local development only. The API's `APP_ADMIN_PASSWORD` overrides the seeded password; production must not keep the default.

### Invitations

Inviters open People (`/app/invitations`, App Admin) or Team (`/app/team`, brand and branch admins), enter an email, pick a role, and send. The API emails a link through Resend; the browser never talks to Resend and never sees the raw token. The list shows Pending, Accepted, Expired, and Revoked with Resend and Revoke on pending rows.

Who can invite whom (the API is the authority; the dropdown mirrors it):

| Inviter | Roles offered | Scope fields |
| --- | --- | --- |
| `SUPER_ADMIN` | `BRAND_ADMIN`, `REGIONAL_MANAGER`, `BRANCH_ADMIN`, `CASHIER`, `WAITER`, `KITCHEN_STAFF`, `RUNNER` | Brand always; branch for branch-scoped roles |
| `BRAND_ADMIN` | `BRANCH_ADMIN`, `REGIONAL_MANAGER`, `CASHIER`, `WAITER`, `KITCHEN_STAFF`, `RUNNER` | Brand is the inviter's own; branch for branch-scoped roles |
| `BRANCH_ADMIN` | `CASHIER`, `WAITER`, `KITCHEN_STAFF`, `RUNNER` | Branch, limited to the inviter's branches |

Branch-scoped roles are `BRANCH_ADMIN` and the four operational roles. `SUPER_ADMIN` is never invitable. An App Admin with no brands sees a prompt to create one first.

Accepting: `GET /api/invite/preview` and `POST /api/invite/accept` are public Next route handlers in front of `/invitations/preview` and `/invitations/accept`. On success the accept handler sets the same httpOnly `staff_token` cookie as login and the browser goes to the role home. API errors map to 404 (invalid or used link), 409 (email already registered), 410 (expired), 502 (email delivery failed, nothing saved).

Kitchen staff lands on `/app/kds`. Waiter and runner land on `/app/floor`. Regional manager lands on `/app/brands`.

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
| `/app/invitations` | App Admin | Invite people, list and manage invitations |
| `/app/team` | Brand and branch admins | Same screen, scoped to their brand or branches |
| `/invite/accept` | Invited person | Preview invitation, set password, sign in |
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

Invitations: `GET /api/invite/preview` → `/invitations/preview` (public), `POST /api/invite/accept` → `/invitations/accept` (public, sets the staff cookie), then through the cookie proxy: `GET/POST /invitations`, `POST /invitations/{id}/resend`, `POST /invitations/{id}/revoke`.

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

1. Open `/admin` and sign in as the App Admin. You land on `/app/brands`.
2. Open People. With no brands you get a prompt to create one. Create a brand and a branch, then invite a `BRAND_ADMIN`. Open the emailed link, set a password, and confirm you land in the brand admin shell. As that brand admin, open Team and invite a `CASHIER` into the branch; after accepting, the cashier lands on `/app/pos`. Trying the cashier at `/admin` should be refused.
3. On a phone-width window, confirm the bottom bar and the More sheet.
4. Change brand and branch. Confirm the working location updates.
5. Hide the tab. The banner should say updates are paused.
6. Open `/t/demo` (or a real QR token), switch to Arabic, and confirm the page direction is RTL.
7. Sign out. You land on `/`. A refresh of a staff route should return to `/restaurant-dashboard`.
