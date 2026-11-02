// Desk service worker (Step 7): shows push notifications and opens the right page on tap.
// Payload (encrypted in transit per Web Push / RFC 8291): {t: title, b: body, u: url, g: tag, k: kind, urgent}
// A tap only ever opens https URLs that are inside this app or on the FOMO coin site (host allowlist below,
// the links themselves are built on the box by links.py and arrive in the payload unchanged).
const SCOPE = self.registration.scope;
const OPEN_HOSTS = ["fomo.family"];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

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
    if (OPEN_HOSTS.includes(x.hostname)) return x.href;     // used exactly as delivered (referral code intact)
  } catch (err) { /* fall through */ }
  return null;
}

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const target = safeTarget(e.notification.data && e.notification.data.u) || SCOPE;
  e.waitUntil(self.clients.openWindow(target));
});
