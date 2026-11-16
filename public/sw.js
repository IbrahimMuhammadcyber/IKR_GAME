/* Offline cache. precache.json is generated at build time (scripts/gen-precache.mjs). */
const CACHE = 'nbr3d-__BUILD__';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch('./precache.json', { cache: 'no-store' });
      const list = await res.json();
      await cache.addAll(list.files);
    } catch (e) {
      await cache.addAll(['./', './index.html']).catch(() => {});
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('nbr3d-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      if (req.mode === 'navigate') {
        const fallback = await cache.match('./index.html') || await cache.match('./');
        if (fallback) return fallback;
      }
      throw e;
    }
  })());
});
