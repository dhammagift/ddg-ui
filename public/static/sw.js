// Network-first: fresh content always wins, the cache is the offline fallback. (Cache-first once
// served stale /static files after a deploy, hence this order.)
//
// Scope: everything below is derived from self.registration.scope, not hardcoded '/', because the
// same files also run under dhamma.gift/dict/. The page registers with an explicit scope (extra.js);
// without it the worker's scope was /static/ and it controlled no navigation at all — offline the
// app did not open at all.
const CACHE_NAME = 'ddg-pwa-v4';
// The offline mini-dictionary lives in its own bucket (offline-dpd.js). activate() must not sweep
// it away, or updating this worker would silently delete a ~15 MB download.
const KEEP_CACHES = ['ddg-dict'];

const BASE = new URL('./', self.registration.scope).pathname.replace(/static\/$/, '');
const SHELL_EN = BASE;
const SHELL_RU = BASE + 'ru/';

// Everything the shell needs to boot with no network. Versioned query strings are left off on
// purpose: fetches are matched with ignoreSearch below.
const urlsToCache = [
  SHELL_EN,
  SHELL_RU,
  BASE + 'static/home.js',
  BASE + 'static/dpd.js',
  BASE + 'static/autopali.js',
  BASE + 'static/offline-dpd.js',
  BASE + 'static/extra.js',
  BASE + 'static/sorter.js',
  BASE + 'static/openDicts.js',
  BASE + 'static/ui.js',
  BASE + 'static/dg-site.js',
  BASE + 'static/jquery-3.7.0.min.js',
  BASE + 'static/jquery-ui.min.js',
  BASE + 'static/dpd.css',
  BASE + 'static/dg.css',
  BASE + 'static/jquery-ui.min.css',
  BASE + 'static/fa/fa.min.css',
  BASE + 'static/sutta_words.txt'
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

function shellFor(pathname) {
  return pathname.indexOf(SHELL_RU) === 0 ? SHELL_RU : SHELL_EN;
}

function cacheCopy(request, resp) {
  if (!resp || !resp.ok || resp.type !== 'basic') return;
  const copy = resp.clone();
  caches.open(CACHE_NAME).then((c) => c.put(request, copy)).catch(() => {});
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // A navigation with no network (/, /kacchapa, /ru/kacchapa, /?source=pwa) has no server to answer
  // it: give it the cached shell for that language — extra.js turns the path back into a query itself.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((resp) => { cacheCopy(request, resp); return resp; })
        .catch(() => caches.match(request, { ignoreSearch: true })
          .then((hit) => hit || caches.match(shellFor(new URL(request.url).pathname))))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((resp) => { cacheCopy(request, resp); return resp; })
      // ignoreSearch: the page asks for static/extra.js?v=ui15 while the precache holds the bare path.
      .catch(() => caches.match(request, { ignoreSearch: true }))
  );
});

// Drop every cache that is neither the current one nor a bucket we deliberately keep.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME && KEEP_CACHES.indexOf(k) === -1).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});
