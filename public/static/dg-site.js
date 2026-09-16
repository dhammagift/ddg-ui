// Tools borrowed from Dhamma.Gift itself, loaded on first use: find on the page (dg-page-find*.js)
// and the site's quick window — the "Compass" (quickModal.js). Owner: the dictionary should work like
// the site, the compass is the site's own window (site history and favorites, not the word history).
// Under dhamma.gift/dict they come from the same origin and share the site's storage; on the
// dict.dhamma.gift subdomain they load from dhamma.gift and simply start with empty storage.
// Also drives the burger menu (#p-menu): open/close and keeping its theme / font-size controls in
// step with the settings panel, which stays the single place those values are saved.
(function () {
  const SITE = location.hostname === 'dict.dhamma.gift' ? 'https://dhamma.gift' : '';
  // The files borrowed from the site below are served with a one-year immutable cache (dg-node's
  // CACHE_IMMUTABLE_YEAR) — a browser that already has a copy keeps it for a year. On the site
  // itself that is safe, because its HTML tags get a ?v=<hash> stamp on every change; these lazy
  // cross-origin loads cannot be reached by that rewriting. Without a stamp the dictionary kept
  // the old copy of the find panel after it was fixed (owner, 2026-09-16). Bump this whenever the
  // borrowed files change: the new URL is fetched at once, and the server's 24h tier for them
  // (UNVERSIONED_LAZY_PATHS in dg-node) re-checks it afterwards.
  const TOOLS_V = '?v=ui2';
  // Help opens the docs on the site serving this page (test.dhamma.gift/dict → test docs).
  window.dgOpenHelp = function () {
    window.open(SITE + (window.isRu ? '/ru' : '') + '/docs/dictionary/', '_blank');
  };
  const loading = {};

  function load(kind, url) {
    if (loading[url]) return loading[url];
    loading[url] = new Promise((resolve, reject) => {
      const el = document.createElement(kind === 'css' ? 'link' : 'script');
      if (kind === 'css') { el.rel = 'stylesheet'; el.href = url; } else { el.src = url; }
      el.onload = resolve;
      el.onerror = () => { delete loading[url]; reject(new Error('Failed to load ' + url)); };
      document.head.appendChild(el);
    });
    return loading[url];
  }

  window.dgOpenFind = function () {
    load('js', SITE + '/assets/js/dg-page-find.js' + TOOLS_V)
      .then(() => load('js', SITE + '/assets/js/dg-page-find-ui.js' + TOOLS_V))
      .then(() => { if (window.DgPageFindUI) window.DgPageFindUI.open(); })
      .catch((e) => console.warn(e.message));
  };

  window.dgOpenCompass = function () {
    // quickModal.js sets window.isRu from the site's own URL rules on load; the dictionary's language
    // switch reads the same global, so keep the dictionary's value.
    const isRu = window.isRu;
    Promise.all([load('css', SITE + '/assets/css/quick-modal.css' + TOOLS_V), load('js', SITE + '/assets/js/quickModal.js' + TOOLS_V)])
      .then(() => {
        window.isRu = isRu;
        if (typeof window.closePanels === 'function') window.closePanels();
        if (typeof window.toggleQuickModal === 'function') window.toggleQuickModal();
      })
      .catch((e) => console.warn(e.message));
  };

  // ---- burger menu ----------------------------------------------------------------------------
  // The menu now carries the whole settings panel (theme/font-size controls included), so the old
  // "menu mirrors #p-set" syncing is gone with the second copy of those controls.
  window.dgToggleMenu = function () {
    const menu = document.getElementById('p-menu');
    if (!menu) return;
    if (menu.dataset.open === 'true') { window.closePanels(); return; }
    // The search box autofocuses on load; leave it so its autocomplete list closes instead of
    // staying open over the page next to the menu.
    if (document.activeElement && document.activeElement.id === 'search-box') document.activeElement.blur();
    window.openPanel('menu');
  };
})();
