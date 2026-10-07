/* Qwicoo staff service worker: order alert notifications only. No caching. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
