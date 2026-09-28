-- Local-only scope test data. Run after order-backend's scripts/seed_demo_data.py
-- (Mezban tenant, brand "Al Ezz Grill & Burger", branches sheikh-zayed and new-cairo).
-- Rerunnable: fixed ids and ON CONFLICT / NOT EXISTS guards.
--
--   scripts/local/psql.sh -f scripts/local/scope-test-data.sql
--
-- Every account below uses the demo password Password123! (hash copied from
-- admin.alezz@mezban.com).

BEGIN;

CREATE TEMP TABLE ctx ON COMMIT DROP AS
SELECT
  t.id AS tenant_id,
  (SELECT hashed_password FROM users WHERE email = 'admin.alezz@mezban.com') AS pw,
  (SELECT id FROM branches WHERE slug = 'new-cairo' AND tenant_id = t.id) AS new_cairo
FROM tenants t
WHERE t.slug = 'mezban-hospitality';

DO $$
BEGIN
  IF (SELECT count(*) FROM ctx WHERE pw IS NOT NULL AND new_cairo IS NOT NULL) <> 1 THEN
    RAISE EXCEPTION 'Run seed_demo_data.py first (Mezban tenant, admin.alezz, new-cairo branch not found).';
  END IF;
END $$;

-- Brand B, with a branch in the same tenant, so cross-brand checks are real ownership checks.
INSERT INTO brands (id, name, slug, logo_url, theme_config, is_active)
VALUES ('b0000000-0000-4000-8000-00000000000b', 'Nile Kitchen', 'nile-kitchen',
        'http://localhost:3001/icon.svg', '{"primary_color": "#1f6f5c"}'::jsonb, true)
ON CONFLICT (id) DO UPDATE SET is_active = true;

INSERT INTO branches (id, tenant_id, brand_id, name, display_name, slug, address, timezone, currency,
                      latitude, longitude, geofence_radius_meters, is_active)
SELECT 'b0000000-0000-4000-8000-0000000000b1', tenant_id, 'b0000000-0000-4000-8000-00000000000b',
       '{"en": "Nile Downtown", "ar": "النيل وسط البلد"}'::jsonb, 'Nile Downtown', 'nile-downtown',
       'Cairo/Downtown', 'Africa/Cairo', 'EGP', 30.0444, 31.2357, 300, true
FROM ctx
ON CONFLICT (id) DO NOTHING;

-- Accounts: brand B admin, a platform admin inside this tenant, and two
-- accounts with no workspace (brand admin without a brand, waiter without branches).
INSERT INTO users (id, tenant_id, brand_id, email, hashed_password, full_name, role, is_active)
SELECT v.id::uuid, ctx.tenant_id, v.brand_id::uuid, v.email, ctx.pw, v.full_name, v.role::user_role, true
FROM ctx, (VALUES
  ('b0000000-0000-4000-8000-0000000000a1', 'b0000000-0000-4000-8000-00000000000b', 'admin.nile@mezban.com', 'Nile Brand Admin', 'BRAND_ADMIN'),
  ('b0000000-0000-4000-8000-0000000000a2', NULL, 'platform.local@mezban.com', 'Local App Admin', 'SUPER_ADMIN'),
  ('b0000000-0000-4000-8000-0000000000a3', NULL, 'nobrand.admin@mezban.com', 'Brand Admin Without Brand', 'BRAND_ADMIN'),
  ('b0000000-0000-4000-8000-0000000000a4', NULL, 'nobranch.waiter@mezban.com', 'Waiter Without Branch', 'WAITER')
) AS v(id, brand_id, email, full_name, role)
ON CONFLICT (email) DO NOTHING;

-- The Zayed cashier also works New Cairo, so the branch switcher shows for them.
INSERT INTO user_branch_access (id, user_id, branch_id, created_at, updated_at)
SELECT gen_random_uuid(), u.id, ctx.new_cairo, now(), now()
FROM ctx JOIN users u ON u.email = 'cashier.zayed@mezban.com'
WHERE NOT EXISTS (
  SELECT 1 FROM user_branch_access a WHERE a.user_id = u.id AND a.branch_id = ctx.new_cairo
);

-- One table per test branch, so the QR screen can mint a guest link for /t/[token].
INSERT INTO tables (id, branch_id, brand_id, table_number, capacity, zone_name, is_active)
SELECT v.id::uuid, br.id, br.brand_id, 'T1', 4, 'Indoor', true
FROM (VALUES
  ('b0000000-0000-4000-8000-0000000000c1', 'sheikh-zayed'),
  ('b0000000-0000-4000-8000-0000000000c2', 'nile-downtown')
) AS v(id, slug)
JOIN ctx ON true
JOIN branches br ON br.slug = v.slug AND br.tenant_id = ctx.tenant_id
ON CONFLICT DO NOTHING;

COMMIT;

SELECT u.email, u.role, b.name AS brand, count(a.id) AS branches
FROM users u
LEFT JOIN brands b ON b.id = u.brand_id
LEFT JOIN user_branch_access a ON a.user_id = u.id
WHERE u.email LIKE '%@mezban.com'
GROUP BY u.email, u.role, b.name
ORDER BY u.role, u.email;
