const CACHE_NAME = "corder-boss-pwa-v5";
const recentTags = new Map();
const DEDUP_TTL_MS = 45000;

function pruneRecentTags() {
  const now = Date.now();
  for (const [key, ts] of recentTags.entries()) {
    if (now - ts > DEDUP_TTL_MS) {
      recentTags.delete(key);
    }
  }
}

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/corder-logo.png",
  "/icon-192x192.png",
  "/icon-512x512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "CORDER_MARK_TAG_SHOWN" && typeof data.tag === "string" && data.tag) {
    pruneRecentTags();
    recentTags.set(data.tag, Date.now());
  }
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Corder Boss - Güvenlik & Kaçak Uyarısı",
    body: "Kritik bir kasa veya adisyon güvenlik uyarısı tespit edildi.",
    icon: "/icon-192x192.png",
    badge: "/icon-96x96.png",
    tag: `corder-boss-${Date.now()}`
  };
  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }
  event.waitUntil(
    (async () => {
      pruneRecentTags();
      const tag = payload.tag || `corder-boss-${Date.now()}`;
      if (recentTags.has(tag)) return;
      if (typeof self.registration.getNotifications === "function") {
        try {
          const existing = await self.registration.getNotifications({ tag });
          if (Array.isArray(existing) && existing.length > 0) {
            recentTags.set(tag, Date.now());
            return;
          }
        } catch {}
      }
      recentTags.set(tag, Date.now());
      try {
        const clientList = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        for (const client of clientList) {
          client.postMessage({ type: "CORDER_TAG_SHOWN", tag });
        }
      } catch {}
      await self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: payload.icon || "/icon-192x192.png",
        badge: payload.badge || "/icon-96x96.png",
        tag,
        renotify: true,
        silent: false,
        vibrate: [200, 100, 200],
        data: payload.data || { tab: "security" }
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("/");
      }
      return undefined;
    })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.headers.get("Authorization")) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.startsWith("/restaurant") ||
    url.pathname.startsWith("/platform") ||
    url.pathname.startsWith("/ws") ||
    url.pathname.startsWith("/health")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put("/index.html", copy);
            });
          }
          return response;
        })
        .catch(() =>
          caches.match("/index.html").then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  if (
    url.pathname === "/corder-logo.png" ||
    url.pathname.startsWith("/icon-") ||
    url.pathname === "/boss-icon.svg" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.startsWith("/assets/")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok && response.type === "basic") {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, copy);
              });
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
  }
});
