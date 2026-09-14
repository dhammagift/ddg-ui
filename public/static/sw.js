// Bumped on the redesign. Old cache-first strategy served stale /static files
// after a deploy (browser kept the previous version), so this is now
// network-first: always fetch fresh when online, fall back to cache offline.
const CACHE_NAME = 'ddg-pwa-v3';
const urlsToCache = [
  '/',
  '/ru/',
  '/static/dpd.js',
  '/static/autopali.js',
  '/static/home.js',
  '/static/extra.js',
  '/static/dpd.css',
  '/static/sutta_words.txt'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // don't fail the whole install if one asset is missing
      Promise.allSettled(urlsToCache.map((u) => cache.add(u)))
    )
  );
});

// Network-first: fresh content always wins; cache is only an offline fallback.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((resp) => {
        if (resp && resp.ok && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, copy)).catch(() => {});
        }
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});

// Drop every cache that is not the current one, then take control immediately.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
