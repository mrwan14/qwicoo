// Scope routing check against the local app + local API with the data from
// scope-test-data.sql. Prints one row per account.
//
//   node scripts/local/verify-scope.mjs            (app on http://127.0.0.1:3001)
const base = process.env.SMOKE_BASE ?? "http://127.0.0.1:3001";
const password = process.env.SCOPE_TEST_PASSWORD ?? "Password123!";
const BRAND_B = "b0000000-0000-4000-8000-00000000000b";
const BRANCH_B = "b0000000-0000-4000-8000-0000000000b1";

const ACCOUNTS = [
  "platform.local@mezban.com",
  "admin.alezz@mezban.com",
  "admin.nile@mezban.com",
  "expo.zayed@mezban.com",
  "cashier.zayed@mezban.com",
  "grill.zayed@mezban.com",
  "runner.zayed@mezban.com",
  "nobrand.admin@mezban.com",
  "nobranch.waiter@mezban.com",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function login(email) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (response.status === 429) {
      await sleep(15_000);
      continue;
    }
    if (!response.ok) throw new Error(`login ${email}: ${response.status} ${await response.text()}`);
    return (response.headers.getSetCookie?.() ?? []).map((entry) => entry.split(";")[0]).join("; ");
  }
  throw new Error(`login ${email}: still rate limited`);
}

async function where(path, cookie) {
  const response = await fetch(`${base}${path}`, { headers: { cookie }, redirect: "manual" });
  const location = response.headers.get("location");
  if (location) {
    const url = new URL(location, base);
    return `${response.status} -> ${url.pathname}${url.search}`;
  }
  // Server redirect() after streaming starts lands in the RSC payload instead of a Location header.
  const body = await response.text();
  const streamed = body.match(/NEXT_REDIRECT;(?:replace|push);([^;]+);(\d+)/);
  if (streamed) return `${streamed[2]} (streamed) -> ${streamed[1]}`;
  return `${response.status}`;
}

async function api(path, cookie, headers = {}) {
  const response = await fetch(`${base}/api/v1${path}`, { headers: { cookie, ...headers } });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

const rows = [];
for (const legacy of ["/admin", "/restaurant-dashboard"]) {
  rows.push({ account: "(logged out)", check: legacy, result: await where(legacy, "") });
}
rows.push({ account: "(logged out)", check: "/app/pos", result: await where("/app/pos", "") });

for (const email of ACCOUNTS) {
  const cookie = await login(email);
  const me = (await api("/auth/me", cookie)).body;
  const branches = (me.accessible_branches ?? []).map((branch) => branch.name).join(", ") || "none";
  rows.push({ account: email, check: "me", result: `${me.role} · ${me.home_scope} · ${me.brand_name ?? "no brand"} · ${branches}` });
  rows.push({ account: email, check: "/app", result: await where("/app", cookie) });
  if (email !== "admin.nile@mezban.com") {
    rows.push({ account: email, check: "brand B dashboard", result: await where(`/app/brands/${BRAND_B}`, cookie) });
    rows.push({ account: email, check: "brand B branch", result: await where(`/app/branches/${BRANCH_B}`, cookie) });
    rows.push({ account: email, check: "?branch=B", result: await where(`/app/menu?branch=${BRANCH_B}`, cookie) });
    const foreign = await api(`/menu/tree?branch_id=${BRANCH_B}`, cookie, { "x-branch-id": BRANCH_B });
    rows.push({ account: email, check: "API branch B menu", result: `${foreign.status} ${foreign.body?.detail ?? ""}`.trim() });
  }
  rows.push({ account: email, check: "/app/brands", result: await where("/app/brands", cookie) });
  rows.push({ account: email, check: "old bookmark", result: await where("/app/settings/old", cookie) });
}

console.table(rows);
