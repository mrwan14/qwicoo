# Role changes: what the backend must allow

The staff app now reads every role rule from one file:
[`src/lib/auth/permissions.ts`](../src/lib/auth/permissions.ts). The API (order-backend
`RequireRoles`) is still the real guard. Until the changes below ship, the new buttons show,
and saving returns **403**.

## The model

- **Brand Admin** owns the brand. They can do everything in every branch. These stay with them only:
  - brand settings
  - card-payment keys
  - menu items shared by all branches
  - turning off shared stock items and suppliers
- **Branch Admin** runs one branch completely, limited to their own branch.
- **Regional Manager** is on hold. Nothing changes for this role.
- **Cashier, Waiter, Kitchen and Runner** get only the screens their job needs.

## 1. Branch Admin: stock catalogue (add `BRANCH_ADMIN`)

| Endpoint | Note |
|---|---|
| `POST /api/v1/inventory/ingredients` | |
| `PATCH /api/v1/inventory/ingredients/{ingredient_id}` | **Refuse `is_active: false` from a Branch Admin**: turning a shared item off is for the Brand Admin only |
| `POST /api/v1/inventory/units` | |
| `POST /api/v1/inventory/conversions` | |
| `DELETE /api/v1/inventory/conversions/{conversion_id}` | |
| `POST /api/v1/inventory/recipes` | |
| `PUT /api/v1/inventory/recipes/{recipe_id}` | |
| `DELETE /api/v1/inventory/recipes/{recipe_id}` | |
| `POST /api/v1/inventory/suppliers` | |
| `PATCH /api/v1/inventory/suppliers/{supplier_id}` | **Refuse `is_active` changes from a Branch Admin** |
| `POST /api/v1/inventory/suppliers/{supplier_id}/ingredients` | |
| `PATCH /api/v1/inventory/suppliers/{supplier_id}/ingredients/{pack_id}` | |
| `DELETE /api/v1/inventory/suppliers/{supplier_id}/ingredients/{pack_id}` | |
| `POST /api/v1/inventory/imports/preview` | |
| `POST /api/v1/inventory/imports/commit` | |

These stay **Brand Admin and App Admin only**:

- `POST /api/v1/inventory/suppliers/{supplier_id}/deactivate`
- writes to a central kitchen

## 2. Branch Admin: other additions

| Endpoint | Change |
|---|---|
| `PATCH /api/v1/attendance-logs/{log_id}/manual-override` | add `BRANCH_ADMIN`, for their own branch's staff |
| `GET /api/v1/analytics/dashboard` | add `BRANCH_ADMIN`, limited to their branch |
| `GET /api/v1/analytics/menu-performance` | add `BRANCH_ADMIN`, limited to their branch |

## 3. Brand Admin: reports they couldn't see

| Endpoint | Change |
|---|---|
| `GET /api/v1/financials/z-reports` | add `BRAND_ADMIN` |
| `GET /api/v1/financials/z-report/{report_id}` | add `BRAND_ADMIN` |
| `GET /api/v1/financials/drawer/current` | add `BRAND_ADMIN` (read only) |
| Attendance report endpoints (Reports → Attendance) | add `BRAND_ADMIN` and `SUPER_ADMIN` |

## 4. No backend change needed

- **"Make a branch-only copy" of a shared menu item** uses existing endpoints:
  - `POST /api/v1/staff/menu/items` creates the copy.
  - The branch override hides the shared item (`is_visible: false`).
- **Cashier and Kitchen now see fewer Stock pages** (Cashier: waste only; Kitchen: counts and waste). The app enforces this, not the API.
  - Keep their stock **GET** access, because the Counts and Waste pages load stock items through it.
