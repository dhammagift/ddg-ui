// Tools borrowed from Dhamma.Gift itself, loaded on first use: find on the page (dg-page-find*.js)
// and the site's quick window — the "Compass" (quickModal.js). Owner: the dictionary should work like
// the site, the compass is the site's own window (site history and favorites, not the word history).
// Under dhamma.gift/dict they come from the same origin and share the site's storage; on the
// dict.dhamma.gift subdomain they load from dhamma.gift and simply start with empty storage.
// Also drives the burger menu (#p-menu): open/close and keeping its theme / font-size controls in
// step with the settings panel, which stays the single place those values are saved.
(function () {
  const SITE = location.hostname === 'dict.dhamma.gift' ? 'https://dhamma.gift' : '';
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
    load('js', SITE + '/assets/js/dg-page-find.js')
      .then(() => load('js', SITE + '/assets/js/dg-page-find-ui.js'))
      .then(() => { if (window.DgPageFindUI) window.DgPageFindUI.open(); })
      .catch((e) => console.warn(e.message));
  };

  window.dgOpenCompass = function () {
    // quickModal.js sets window.isRu from the site's own URL rules on load; the dictionary's language
    // switch reads the same global, so keep the dictionary's value.
    const isRu = window.isRu;
    Promise.all([load('css', SITE + '/assets/css/quick-modal.css'), load('js', SITE + '/assets/js/quickModal.js')])
      .then(() => {
        window.isRu = isRu;
        if (typeof window.closePanels === 'function') window.closePanels();
        if (typeof window.toggleQuickModal === 'function') window.toggleQuickModal();
      })
      .catch((e) => console.warn(e.message));
  };

  // ---- burger menu ----------------------------------------------------------------------------
  function syncMenu() {
    const theme = document.getElementById('theme-toggle');
    const menuTheme = document.getElementById('menu-theme-toggle');
    if (theme && menuTheme) menuTheme.checked = theme.checked;
    const size = document.getElementById('font-size-display');
    const menuSize = document.getElementById('menu-font-size');
    if (size && menuSize) menuSize.textContent = size.textContent;
  }

  window.dgToggleMenu = function () {
    const menu = document.getElementById('p-menu');
    if (!menu) return;
    if (menu.dataset.open === 'true') { window.closePanels(); return; }
    syncMenu();
    // The search box autofocuses on load; leave it so its autocomplete list closes instead of
    // staying open over the page next to the menu.
    if (document.activeElement && document.activeElement.id === 'search-box') document.activeElement.blur();
    window.openPanel('menu');
  };

  document.addEventListener('DOMContentLoaded', () => {
    const menuTheme = document.getElementById('menu-theme-toggle');
    if (menuTheme) {
      menuTheme.addEventListener('change', () => {
        const theme = document.getElementById('theme-toggle');
        if (!theme) return;
        theme.checked = menuTheme.checked;
        theme.dispatchEvent(new Event('change'));
      });
    }
    // The settings panel's stepper owns the font size; mirror its label (it changes on Alt+−/=/0 too).
    const size = document.getElementById('font-size-display');
    if (size) new MutationObserver(syncMenu).observe(size, { childList: true, characterData: true, subtree: true });
    syncMenu();
  });
})();
