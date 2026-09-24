const base = process.env.SMOKE_BASE ?? "http://127.0.0.1:3000";

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
await expectOk("/t/demo");
await expectOk("/order");
await expectOk("/b/demo/pickup");

const adminCookie = await login("admin@gourmet.com", "Admin123!");
const me = await authed("/api/v1/auth/me", adminCookie);
console.log(`signed in as ${me.role}`);
const brands = await authed("/api/v1/brands?limit=1", adminCookie);
const branches = await authed("/api/v1/branches", adminCookie);
const branchList = Array.isArray(branches) ? branches : branches.items ?? branches.records ?? [];
const branchId = branchList[0]?.id ?? "";
const brandId = brands.items?.[0]?.id ?? branchList[0]?.brand_id ?? "";

const cashierCookie = await login("cashier@gourmet.com", "Admin123!");
const cashier = await authed("/api/v1/auth/me", cashierCookie);
console.log(`cashier role ${cashier.role}`);
const menu = await fetch(`${base}/api/v1/menu/tree`, {
  headers: {
    cookie: cashierCookie,
    ...(branchId ? { "X-Branch-ID": branchId } : {}),
    ...(brandId ? { "X-Brand-ID": brandId } : {}),
  },
});
if (!menu.ok) throw new Error(`/api/v1/menu/tree returned ${menu.status}`);
console.log(`${menu.status} /api/v1/menu/tree`);

console.log("smoke ok");
