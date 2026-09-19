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
//
// BOTH languages, every file twice: the Russian page asks for its own copies (/ru/static/…, a
// symlink to the same files) — without them switching the language offline opened an unstyled,
// scriptless page.
const ASSETS = [
  'static/home.js', 'static/dpd.js', 'static/autopali.js', 'static/offline-dpd.js',
  'static/extra.js', 'static/sorter.js', 'static/openDicts.js', 'static/ui.js', 'static/dg-site.js',
  'static/jquery-3.7.0.min.js', 'static/jquery-ui.min.js',
  'static/dpd.css', 'static/dg.css', 'static/jquery-ui.min.css', 'static/icons-fa.css',
  'static/sutta_words.txt', 'static/circle-notch.svg', 'static/open-link.svg',
  'static/buddhadust-glossology.htm', 'static/manifest.json',
  // Masked SVG icons (dg.css .gi/.i-*) — without them the star/copy/link buttons render as blank
  // squares offline, which is what made the word actions look missing.
  'static/icons/book.svg', 'static/icons/compass.svg', 'static/icons/copy.svg', 'static/icons/ext.svg',
  'static/icons/find.svg', 'static/icons/gear.svg', 'static/icons/help.svg', 'static/icons/history.svg',
  'static/icons/link.svg', 'static/icons/list.svg', 'static/icons/menu.svg', 'static/icons/reset.svg',
  'static/icons/star.svg', 'static/icons/theme.svg', 'static/icons/translit.svg',
  // The 15 Font Awesome shapes we actually use, generated as masks by dg-node's build-icons.js
  // (no webfont: the full bundle was ~400 KB for 15 icons).
  'static/icons/fa/arrow-up-right-from-square.svg', 'static/icons/fa/at.svg',
  'static/icons/fa/cloud-arrow-down.svg', 'static/icons/fa/download.svg', 'static/icons/fa/github.svg',
  'static/icons/fa/keyboard.svg', 'static/icons/fa/magnifying-glass.svg', 'static/icons/fa/share-nodes.svg',
  'static/icons/fa/table-columns.svg', 'static/icons/fa/telegram.svg', 'static/icons/fa/trash-can.svg',
  'static/icons/fa/volume-high.svg', 'static/icons/fa/whatsapp.svg', 'static/icons/fa/xmark.svg',
  'static/icons/fa/youtube.svg'
];

const urlsToCache = [SHELL_EN, SHELL_RU]
  .concat(ASSETS.map((a) => SHELL_EN + a))
  .concat(ASSETS.map((a) => SHELL_RU + a));

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

// The offline download (offline-dpd.js) asks for the whole app to be cached in one go, so the
// reader does not have to have visited each page for it to work offline.
self.addEventListener('message', (event) => {
  if (!event.data || event.data.dgPrecacheAll !== true) return;
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(urlsToCache.map((u) => cache.add(u))))
      .then(() => {
        if (event.source && event.source.postMessage) event.source.postMessage({ dgPrecacheDone: true });
      })
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
