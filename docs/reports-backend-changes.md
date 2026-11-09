# Reports: what the backend needs to add

The Reports section of the staff app (`/app/reports`) now:

- fixes the wrong totals
- compares every KPI with an earlier period
- keeps filters in the URL
- adds Taxes & charges, Sales by channel and Discounts & refunds, built from Z reports

Some of it works around gaps in the API. This list is what order-backend needs so the app can stop working around them and offer the reports that are still marked **On the way**.

Each item says what the app does today and what it needs.

## 1. Questions to confirm first (no code yet)

| # | Question | Why it matters |
|---|---|---|
| 1.1 | Are `ZReportResponse.order_sources` values **money amounts**, not order counts? | Sales by channel and the Z report page show them as money. |
| 1.2 | When a payment is refunded, does its `CashierTransactionItem.status` become `REFUNDED`? How is a **partial** refund shown? | Payments counts only `COMPLETED` as taken and shows `REFUNDED` rows as refunded. Partial refunds may be missed. |
| 1.3 | Is `GET /financials/z-reports` always newest first? | The app stops paging once it passes the start date. It only does this when the page is newest first, and reads to the end otherwise. |
| 1.4 | Does `GET /branches/{id}/attendance-logs?filter_type=monthly&target_date=YYYY-MM-01` return **that** month? | Attendance asks month by month for ranges longer than a day. If `target_date` is ignored, older months come back empty and the comparisons look too good. |

## 2. Filters on list endpoints (fixes what the app works around)

| Endpoint | Add | Today |
|---|---|---|
| `GET /api/v1/branches/{branch_id}/cashier-transactions` | `start`, `end` (dates in Cairo time); optional `status`, `payment_method`; a fixed sort order (newest first) | The app pages through up to 3,000 payments and filters them by date in the browser. Bigger periods are cut short, with a note. |
| `GET /api/v1/financials/z-reports` | `start`, `end` on `business_date`; a fixed newest-first order | Same: the app pages through and filters by date in the browser. |
| `GET /api/v1/branches/{branch_id}/attendance-logs` | `start`, `end` instead of `filter_type` + `target_date` | The app works out which months to ask for, then de-duplicates the records. |
| Attendance, brand-wide | `GET /api/v1/attendance-logs?brand_id=&start=&end=` | The app sends one request per branch, per month. |
| `GET /api/v1/analytics/menu-performance` | `zero_sales_items`: active items that sold nothing in the period | "Slowest items" only lists items that sold at least once. Items that never sell, the real slow movers, are invisible. |

## 3. New endpoints (reports marked "On the way")

In order of value:

### 3.1 Sales by hour and day

`GET /api/v1/analytics/sales-timeseries?start=&end=&branch_id=&bucket=hour|day`

- **Returns:** `[{ bucket_start, gmv, net_revenue, orders, aov }]`
- **Heatmap:** `bucket=hour_of_week`, 7 × 24 cells with average sales per weekday and hour.
- **Use:** staffing and prep, and a trend line on Sales overview. Today Sales overview has no chart over time.

### 3.2 Staff performance

`GET /api/v1/analytics/staff?start=&end=&branch_id=`

- **Returns,** per staff member: orders taken, sales, average order, discounts given, voids and cancellations, refunds issued.
- **Use:** voids and refunds per person are the main way to catch till theft.

### 3.3 Speed of service

`GET /api/v1/analytics/service-speed?start=&end=&branch_id=`

- **Returns:** median and 90th-percentile minutes for
  - placed → accepted
  - accepted → kitchen bump
  - bump → ready
  - ready → served or picked up
- **Splits:** by hour and by station.
- **Data:** the kitchen screen bump times already exist.

### 3.4 Shifts, drawers and tips

`GET /api/v1/financials/drawer-sessions?start=&end=`

- **Returns,** per drawer session: who opened and closed it, times, float, cash sales, pay-ins and pay-outs, counted cash, variance, voids, tips.

### 3.5 Customers (Brand Admin)

`GET /api/v1/analytics/customers?start=&end=`

- **Returns:** new vs returning guests, repeat rate, average visits, ratings and feedback if collected.

### 3.6 Menu engineering

- **Blocked on a decision:** it needs a cost per menu item, and recipes were removed (`9542b23`). Decide where item cost comes from before building this.
- **Returns:** per item, cost, margin, units sold, and a quadrant (star, plough horse, puzzle, dog).

### 3.7 Scheduled exports

`POST /api/v1/report-schedules`

- **Fields:** `{ report, filters, recipients[], frequency: daily|weekly|monthly, format: csv|pdf }`
- **Also needed:** list and delete, and an email job.
- **Note:** the Schedule button was taken off the report pages until this exists.

## 4. Roles

The Brand Admin can't open Till / Z, Taxes & charges, Sales by channel or Discounts & refunds until the Z report endpoints allow `BRAND_ADMIN`. See section 3 of [roles-backend-changes.md](roles-backend-changes.md).
