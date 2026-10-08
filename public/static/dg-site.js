// Tools borrowed from Dhamma.Gift itself, loaded on first use: find on the page (dg-page-find*.js)
// and the site's quick window — the "Compass" (quickModal.js). Owner: the dictionary should work like
// the site, the compass is the site's own window (site history and favorites, not the word history).
// Under dhamma.gift/dict they come from the same origin and share the site's storage; on the
// dict.dhamma.gift subdomain they load from dhamma.gift and simply start with empty storage.
// Also drives the burger menu (#p-menu): open/close and keeping its theme / font-size controls in
// step with the settings panel, which stays the single place those values are saved.
(function () {
  // The Dictionary app serves this page from its own origin (https://localhost, Capacitor): the tools are not on that
  // host either (dict.dhamma.gift answers 404 for them), so there they come from the site, like on the subdomain.
  const inApp = location.hostname === 'localhost' && !!window.Capacitor && !!window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
  const SITE = (location.hostname === 'dict.dhamma.gift' || inApp) ? 'https://dhamma.gift' : '';
  // quickModal.js builds its links and icons from this base (its own rule knows only the subdomain).
  if (SITE && !window.DG_SITE_BASE) window.DG_SITE_BASE = SITE;
  // The files borrowed from the site below are served with a one-year immutable cache (dg-node's
  // CACHE_IMMUTABLE_YEAR) — a browser that already has a copy keeps it for a year. On the site
  // itself that is safe, because its HTML tags get a ?v=<hash> stamp on every change; these lazy
  // cross-origin loads cannot be reached by that rewriting. Without a stamp the dictionary kept
  // the old copy of the find panel after it was fixed (owner, 2026-09-16). Bump this whenever the
  // borrowed files change: the new URL is fetched at once, and the server's 24h tier for them
  // (UNVERSIONED_LAZY_PATHS in dg-node) re-checks it afterwards.
  // ui3: quickModal.js takes a host-provided settings opener (window.dgQuickSettings) and
  // addresses the site's own icons/links through a base — the dictionary had no quick settings
  // in the compass and its icons 404'd on the subdomain (ddg-ui #4, #5).
  const TOOLS_V = '?v=ui5';
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

  // The compass (history, favorites, subscriptions of Dhamma.Gift) is the site's own window and needs the site's storage: on dhamma.gift/dict it
  // is there, on dict.dhamma.gift and in the apps it would be an empty copy. There the menu row and the Alt+P / Alt+Y keys are gone.
  if (SITE) {
    const hide = document.createElement('style');
    hide.textContent = '.mrow[onclick*="dgOpenCompass"]{display:none!important}';
    document.head.appendChild(hide);
  } else
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

  // Esc closes the compass, as it does everywhere on Dhamma.Gift (there it is settings.js's keydown handler, which this page does not load).
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && window.quickModalIsOpen && typeof window.toggleQuickModal === 'function') window.toggleQuickModal();
  });

  // The compass window asks the host page for a settings opener when there is no home.js (see
  // quickModal.js): the dictionary's own menu already holds theme, font size and language, so the
  // gear opens that instead of duplicating a second settings panel (ddg-ui #5).
  window.dgQuickSettings = {
    icon: '<svg class="dg-qs-gear" aria-hidden="true" focusable="false" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M0 416C0 398.3 14.33 384 32 384H86.66C99 355.7 127.2 336 160 336C192.8 336 220.1 355.7 233.3 384H480C497.7 384 512 398.3 512 416C512 433.7 497.7 448 480 448H233.3C220.1 476.3 192.8 496 160 496C127.2 496 99 476.3 86.66 448H32C14.33 448 0 433.7 0 416V416zM192 416C192 398.3 177.7 384 160 384C142.3 384 128 398.3 128 416C128 433.7 142.3 448 160 448C177.7 448 192 433.7 192 416zM352 176C384.8 176 412.1 195.7 425.3 224H480C497.7 224 512 238.3 512 256C512 273.7 497.7 288 480 288H425.3C412.1 316.3 384.8 336 352 336C319.2 336 291 316.3 278.7 288H32C14.33 288 0 273.7 0 256C0 238.3 14.33 224 32 224H278.7C291 195.7 319.2 176 352 176zM384 256C384 238.3 369.7 224 352 224C334.3 224 320 238.3 320 256C320 273.7 334.3 288 352 288C369.7 288 384 273.7 384 256zM480 64C497.7 64 512 78.33 512 96C512 113.7 497.7 128 480 128H265.3C252.1 156.3 224.8 176 192 176C159.2 176 131 156.3 118.7 128H32C14.33 128 0 113.7 0 96C0 78.33 14.33 64 32 64H118.7C131 35.75 159.2 16 192 16C224.8 16 252.1 35.75 265.3 64H480zM160 96C160 113.7 174.3 128 192 128C209.7 128 224 113.7 224 96C224 78.33 209.7 64 192 64C174.3 64 160 78.33 160 96z"></path></svg>',
    open: function () {
      // Close the compass first: its modal sits above the dictionary's panels, so opening the menu
      // underneath it looked like the gear did nothing.
      if (typeof window.closePanels === 'function') window.closePanels();
      if (typeof window.toggleQuickModal === 'function') window.toggleQuickModal();
      if (typeof window.dgToggleMenu === 'function') window.dgToggleMenu();
    }
  };

  // ---- burger menu ----------------------------------------------------------------------------
  // Share, the same way the site's own drawer does it (dg-node's .dg-drawer-share): the native OS
  // sheet where the browser has navigator.share, otherwise copy the link and say so.
  window.dgShare = function () {
    const url = location.href;
    if (navigator.share) {
      navigator.share({ title: document.title, url }).catch(() => { /* user cancelled */ });
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        if (typeof showBubbleNotification === 'function') {
          showBubbleNotification(window.isRu ? 'Ссылка скопирована' : 'Link copied');
        }
      }).catch(() => {});
    }
  };

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
