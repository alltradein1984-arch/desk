// Desk service worker. CACHE_VER bump forces phones to drop stale app shells.
const CACHE_VER = "desk-static-v37";
const SCOPE = self.registration.scope;
const OPEN_HOSTS = ["fomo.family"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE_VER).then(c => c.addAll([
    "./", "./index.html", "./manifest.json", "./sw.js", "./icon-192.png", "./icon.svg"
  ]).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_VER).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Network-first for navigations / HTML so Auditor always gets the latest chart code.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const dest = req.destination;
  // Pairing grant + other encrypted feeds: never cache (network-only, ignore HTTP cache).
  if (req.url && /\/data\/[^/]+\.enc\.json/.test(req.url)) {
    e.respondWith(fetch(req, { cache: "no-store" }));
    return;
  }
  const isDoc = req.mode === "navigate" || dest === "document" || (req.url && req.url.endsWith("/index.html"));
  if (!isDoc) return; // don't touch API / iframe / image traffic
  e.respondWith((async () => {
    try {
      const fresh = await fetch(req, { cache: "no-store" });
      const cache = await caches.open(CACHE_VER);
      cache.put(req, fresh.clone());
      return fresh;
    } catch (err) {
      const hit = await caches.match(req);
      if (hit) return hit;
      throw err;
    }
  })());
});

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = {}; }
  const title = String(d.t || "Desk").slice(0, 80);
  e.waitUntil(self.registration.showNotification(title, {
    body: String(d.b || "").slice(0, 200),
    tag: d.g ? String(d.g).slice(0, 64) : undefined,
    renotify: !!d.g,
    requireInteraction: !!d.urgent,
    icon: "icon-192.png",
    badge: "icon-192.png",
    data: { u: d.u, k: d.k }
  }));
});

function safeTarget(u) {
  try {
    const x = new URL(u);
    if (x.protocol !== "https:" || x.username || x.password) return null;
    if (x.href.startsWith(SCOPE)) return x.href;
    if (OPEN_HOSTS.includes(x.hostname)) return x.href;
  } catch (err) { /* fall through */ }
  return null;
}

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const target = safeTarget(e.notification.data && e.notification.data.u) || SCOPE;
  e.waitUntil(self.clients.openWindow(target));
});
