// Minimal service worker so browsers treat Fine Booking as an installable app.
// It caches nothing, so visitors always get the latest version of the site.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
