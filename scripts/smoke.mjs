const base = process.env.SMOKE_BASE ?? "http://127.0.0.1:3001";

// App Admin is the only account that exists after a database reset. Override
// for other environments; never commit real credentials.
const adminEmail = process.env.SMOKE_ADMIN_EMAIL ?? "admin@qwicoo.com";
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD ?? "Qwicoo!Admin2026";
// Optional second account (any invited staff role) for the menu read.
const staffEmail = process.env.SMOKE_STAFF_EMAIL ?? "";
const staffPassword = process.env.SMOKE_STAFF_PASSWORD ?? "";

async function expectOk(path) {
  const response = await fetch(`${base}${path}`, { redirect: "manual" });
  if (response.status >= 500) {
    throw new Error(`${path} returned ${response.status}`);
  }
  console.log(`${response.status} ${path}`);
}

function cookieHeader(response) {
  const raw = response.headers.getSetCookie?.() ?? [];
  return raw.map((entry) => entry.split(";")[0]).join("; ");
}

async function login(email, password) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Login failed for ${email}: ${response.status} ${detail}`);
  }
  return cookieHeader(response);
}

async function authed(path, cookie) {
  const response = await fetch(`${base}${path}`, { headers: { cookie } });
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  console.log(`${response.status} ${path}`);
  return response.json();
}

await expectOk("/");
await expectOk("/login");

// Old split sign-in pages must redirect to /login, not error.
for (const legacy of ["/admin", "/restaurant-dashboard"]) {
  const response = await fetch(`${base}${legacy}`, { redirect: "manual" });
  const location = response.headers.get("location") ?? "";
  if (response.status !== 308 || !location.endsWith("/login")) {
    throw new Error(`${legacy} returned ${response.status} -> ${location}`);
  }
  console.log(`${response.status} ${legacy} -> /login`);
}
await expectOk("/invite/accept");
await expectOk("/forgot-password");
await expectOk("/reset-password");
await expectOk("/t/demo");
await expectOk("/order");
await expectOk("/b/demo/pickup");

// Public invite preview must reject a junk token without a 5xx.
const preview = await fetch(`${base}/api/invite/preview?token=not-a-real-token-value`);
if (preview.status >= 500) throw new Error(`/api/invite/preview returned ${preview.status}`);
console.log(`${preview.status} /api/invite/preview (junk token)`);

const adminCookie = await login(adminEmail, adminPassword);
const me = await authed("/api/v1/auth/me", adminCookie);
console.log(`signed in as ${me.role}`);
console.log(`home scope ${me.home_scope}`);
await authed("/api/v1/brands?limit=1", adminCookie);
const invitations = await authed("/api/v1/invitations", adminCookie);
console.log(`invitations total ${invitations.total}`);

if (staffEmail && staffPassword) {
  const staffCookie = await login(staffEmail, staffPassword);
  const staff = await authed("/api/v1/auth/me", staffCookie);
  console.log(`staff role ${staff.role}, home scope ${staff.home_scope}`);
  // Scope headers come from the caller's own /auth/me, never from another account.
  const branchId = staff.accessible_branches?.[0]?.id ?? "";
  const brandId = staff.brand_id ?? "";
  const menu = await fetch(`${base}/api/v1/menu/tree`, {
    headers: {
      cookie: staffCookie,
      ...(branchId ? { "X-Branch-ID": branchId } : {}),
      ...(brandId ? { "X-Brand-ID": brandId } : {}),
    },
  });
  if (!menu.ok) throw new Error(`/api/v1/menu/tree returned ${menu.status}`);
  console.log(`${menu.status} /api/v1/menu/tree`);
} else {
  console.log("skipping staff leg (set SMOKE_STAFF_EMAIL and SMOKE_STAFF_PASSWORD)");
}

console.log("smoke ok");
