/*
 * Qwicoo staff service worker.
 * - Order alert notifications (push).
 * - Offline staff shell: /app pages and Next static assets are cached as they load, so the till,
 *   kitchen and handover screens still open when the network drops. API calls are never cached
 *   here; the app keeps its own IndexedDB copies (menu, tables, settings) and offline queue.
 */
const SHELL_CACHE = "qwicoo-shell-v1";
const STATIC_CACHE = "qwicoo-static-v1";
const KEEP = new Set([SHELL_CACHE, STATIC_CACHE]);
const NETWORK_TIMEOUT_MS = 4000;
const FALLBACK_PAGES = ["/app/pos", "/app/kds", "/app/kds/expo", "/app"];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (!KEEP.has(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  ),
);

function isStaffPath(pathname) {
  return pathname === "/app" || pathname.startsWith("/app/");
}

/** RSC payloads vary by a cache-busting `_rsc` param; key them by path only. */
function shellKey(request, url) {
  const isRsc = request.headers.get("RSC") === "1";
  return `${url.origin}${url.pathname}${isRsc ? "?__rsc" : ""}`;
}

function isStaticPath(pathname) {
  return pathname.startsWith("/_next/static/") || pathname.startsWith("/brand/") || pathname === "/manifest.webmanifest";
}

/** Cache static asset URLs we haven't kept yet (best effort; used to warm screens not opened yet). */
async function warmAssets(urls) {
  const cache = await caches.open(STATIC_CACHE);
  for (const raw of urls) {
    try {
      const url = new URL(raw, self.location.origin);
      if (url.origin !== self.location.origin || !isStaticPath(url.pathname)) continue;
      if (await cache.match(url.href)) continue;
      const response = await fetch(url.href);
      if (response.ok) await cache.put(url.href, response);
    } catch {
      // Skip; it will be cached when it loads normally.
    }
  }
}

function assetUrlsIn(html) {
  const found = new Set();
  for (const match of html.matchAll(/["'(](\/(?:_next\/static|brand)\/[^"')\s\\]+)/g)) found.add(match[1]);
  return [...found];
}

async function networkFirst(event, request, url) {
  const cache = await caches.open(SHELL_CACHE);
  const key = shellKey(request, url);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS)),
    ]);
    // Only keep real pages: a redirect to /login (signed out) must not become the offline copy.
    if (response.ok && !response.redirected && response.type === "basic") {
      await cache.put(key, response.clone());
      if ((response.headers.get("Content-Type") || "").includes("text/html")) {
        event.waitUntil(
          response
            .clone()
            .text()
            .then((html) => warmAssets(assetUrlsIn(html)))
            .catch(() => undefined),
        );
      }
    }
    return response;
  } catch (error) {
    const cached = await cache.match(key);
    if (cached) return cached;
    if (request.mode === "navigate") {
      for (const page of FALLBACK_PAGES) {
        const fallback = await cache.match(`${url.origin}${page}`);
        if (fallback) return fallback;
      }
    }
    throw error;
  }
}

/**
 * Static assets: network first, cached copy when offline. (Dev builds reuse chunk URLs, so a
 * cache-first rule would pin old code; production chunks are hashed and HTTP-cached anyway.)
 */
async function staticAsset(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (isStaticPath(url.pathname)) {
    event.respondWith(staticAsset(request));
    return;
  }
  // Navigations, RSC payloads, and the app's own HTML warm-up fetches (Accept: text/html).
  const wantsPage = request.mode === "navigate" || request.headers.get("RSC") === "1" || (request.headers.get("Accept") || "").includes("text/html");
  if (isStaffPath(url.pathname) && wantsPage) {
    event.respondWith(networkFirst(event, request, url));
  }
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "qwicoo:clear-shell") {
    event.waitUntil(caches.delete(SHELL_CACHE));
  }
  if (event.data && event.data.type === "qwicoo:warm-assets" && Array.isArray(event.data.urls)) {
    event.waitUntil(warmAssets(event.data.urls.slice(0, 400)));
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Qwicoo", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    (async () => {
      // A visible staff tab already shows the in-app toast and tone. Don't double up.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (windows.some((client) => client.visibilityState === "visible" && new URL(client.url).pathname.startsWith("/app"))) return;
      await self.registration.showNotification(data.title || "Qwicoo", {
        body: data.body || "",
        tag: data.tag || undefined,
        renotify: Boolean(data.tag),
        icon: "/icon.svg",
        badge: "/icon.svg",
        data: { url: data.url || "/app" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/app", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const staff = windows.find((client) => new URL(client.url).pathname.startsWith("/app"));
      if (staff) {
        await staff.focus();
        if ("navigate" in staff) await staff.navigate(target).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
