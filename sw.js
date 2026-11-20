// Fine Booking service worker: faster repeat visits.
// - The page: tries the network first so updates show straight away, and falls back to the saved copy when offline.
// - Photos: saved on the phone after the first view, so they appear instantly next time.
// - Everything else (database, emails, uploads, analytics) is left alone.

const PAGE_CACHE = "fb-page-v1";
const IMAGE_CACHE = "fb-images-v1";
const MAX_IMAGES = 120;
const IMAGE_HOSTS = ["images.unsplash.com", "pub-2495dd80d6a941a9b4977311542572d2.r2.dev"];
const corsRefused = {};

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== PAGE_CACHE && k !== IMAGE_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

async function trimImages(){
  const cache = await caches.open(IMAGE_CACHE);
  const keys = await cache.keys();
  if(keys.length > MAX_IMAGES){
    await Promise.all(keys.slice(0, keys.length - MAX_IMAGES).map(k => cache.delete(k)));
  }
}

async function photoResponse(req, url){
  const cache = await caches.open(IMAGE_CACHE);
  const saved = await cache.match(req.url);
  if(saved) return saved;
  if(corsRefused[url.hostname]) return fetch(req);
  try{
    // A normal (CORS) copy can be stored cheaply. If the host doesn't allow it, remember that and use the plain request.
    const res = await fetch(req.url, { mode: "cors" });
    if(res.ok){
      cache.put(req.url, res.clone());
      trimImages();
    }
    return res;
  }catch(err){
    corsRefused[url.hostname] = true;
    return fetch(req);
  }
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);

  // The page itself
  if(req.mode === "navigate" && url.origin === self.location.origin){
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(PAGE_CACHE).then(c => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/").then(r => r || Response.error()))
    );
    return;
  }

  // Photos
  if(req.destination === "image" && IMAGE_HOSTS.indexOf(url.hostname) !== -1){
    event.respondWith(photoResponse(req, url));
  }
});
