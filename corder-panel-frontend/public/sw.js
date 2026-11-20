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

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "CORDER_MARK_TAG_SHOWN" && typeof data.tag === "string" && data.tag) {
    pruneRecentTags();
    recentTags.set(data.tag, Date.now());
  }
});

async function showDeduplicatedPushNotification(payload) {
  pruneRecentTags();
  const tag =
    typeof payload.tag === "string" && payload.tag.trim()
      ? payload.tag.trim()
      : `corder-panel-${Date.now()}`;

  if (recentTags.has(tag)) {
    return;
  }

  if (typeof self.registration.getNotifications === "function") {
    try {
      const existing = await self.registration.getNotifications({ tag });
      if (Array.isArray(existing) && existing.length > 0) {
        recentTags.set(tag, Date.now());
        return;
      }
    } catch {
      // Ignore getNotifications errors
    }
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
  } catch {
    // Ignore client broadcast errors
  }

  await self.registration.showNotification(
    payload.title || "🔔 Corder Panel Bildirimi",
    {
      body: payload.body || "",
      icon: payload.icon || "/icon-192x192.png",
      badge: payload.badge || "/icon-96x96.png",
      tag,
      renotify: true,
      silent: false,
      vibrate: [200, 100, 200],
      data: payload.data || {},
    }
  );
}

self.addEventListener("push", (event) => {
  let payload = {
    title: "🔔 Corder Panel Bildirimi",
    body: "Yeni bir bildirim alındı.",
    icon: "/icon-192x192.png",
    badge: "/icon-96x96.png",
    tag: `corder-panel-${Date.now()}`,
    data: {},
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  event.waitUntil(showDeduplicatedPushNotification(payload));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
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
