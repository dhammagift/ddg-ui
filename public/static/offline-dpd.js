// Offline mini-dictionary: the same bundled DPD dhamma.gift already serves
// (/assets/js/standalone-dpd/*), kept in Cache Storage so a lookup works with no network.
// Online nothing changes — extra.js still gets the full article from dpdict.net; this is only
// the fallback and the download/delete plumbing behind it.
//
// Why cross-origin instead of a copy next to this file: dg-node serves those files with CORS '*'
// and a 24h cache tier, and the offline Android app reads the very same URLs
// (dg-app-full/www/native-bridge.js) — one canonical copy, updated in one place.
(function () {
    'use strict';

    // Where the data lives. Under dhamma.gift/dict/ the same origin already serves it, so no
    // cross-origin request is made there; on dict.dhamma.gift it is fetched from dhamma.gift
    // (CORS '*'). DG_DICT_ORIGIN overrides both, which is how a test host points at itself.
    function assetOrigin() {
        if (window.DG_DICT_ORIGIN) return window.DG_DICT_ORIGIN;
        // Same trick as extra.js getAppBase(): read the install base off our own <script src>.
        // Base '/' = dict.dhamma.gift (data lives on dhamma.gift); anything else means the app is
        // mounted inside dhamma.gift (/dict/), where the data is already same-origin.
        for (var i = 0; i < document.scripts.length; i++) {
            var src = document.scripts[i].src;
            if (!src) continue;
            var u = new URL(src, location.href);
            var at = u.pathname.indexOf('/static/');
            if (at === -1) continue;
            var base = u.pathname.slice(0, at + 1).replace(/(ru|th)\/$/, '');
            return base === '/' ? 'https://dhamma.gift' : u.origin;
        }
        return 'https://dhamma.gift';
    }

    var ORIGIN = assetOrigin();
    var DIR = ORIGIN + '/assets/js/standalone-dpd/';
    var CACHE = 'ddg-dict';
    var isRu = /\/ru(\/|$)/.test(window.location.pathname);

    // The two dpd_ebts.js files define the SAME global, so only one language can be live on a page.
    // The Russian page downloads both (owner) — Russian readers use the English glosses too, and the
    // English page then has nothing left to fetch — but injects only its own.
    var SHARED = [DIR + 'dpd_i2h.js', DIR + 'dpd_deconstructor.js'];
    var EBTS_EN = DIR + 'dpd_ebts.js';
    var EBTS_RU = DIR + 'ru/dpd_ebts.js';
    var FILES = isRu ? SHARED.concat([EBTS_RU, EBTS_EN]) : SHARED.concat([EBTS_EN]);
    var EBTS_HERE = isRu ? EBTS_RU : EBTS_EN;

    // Compressed transfer sizes, measured on the live server — what the reader actually waits for.
    // Dictionary data plus the app itself (both language shells and their assets, ~1.2 MB): the
    // download caches everything, so the number has to cover everything.
    var SIZE_MB = isRu ? '5,8' : '3.7';

    var loaded = null; // load() promise, so a second lookup does not inject the scripts twice

    function open() { return window.caches ? caches.open(CACHE) : Promise.reject(new Error('no Cache Storage')); }

    // 'ready' | 'none'. Storage is the single source of truth — no localStorage flag to fall out of
    // sync when the browser evicts the bucket; the button simply says "download" again.
    function state() {
        if (!window.caches) return Promise.resolve('none');
        // caches.has() first: caches.open() would re-create the bucket right after a delete.
        return caches.has(CACHE).then(function (exists) {
            return exists ? open() : null;
        }).then(function (cache) {
            if (!cache) return [];
            return Promise.all(FILES.map(function (u) { return cache.match(u); }));
        }).then(function (hits) {
            return hits.length && hits.every(Boolean) ? 'ready' : 'none';
        }).catch(function () { return 'none'; });
    }

    function download(onProgress) {
        loaded = null;  // whatever was decided about the previous (empty) cache no longer holds
        return open().then(function (cache) {
            var done = 0;
            return FILES.reduce(function (chain, url) {
                return chain.then(function () {
                    return cache.match(url).then(function (hit) {
                        if (hit) { done++; if (onProgress) onProgress(done / FILES.length); return; }
                        return fetch(url, { cache: 'no-cache' }).then(function (res) {
                            if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
                            return cache.put(url, res);
                        }).then(function () {
                            done++;
                            if (onProgress) onProgress(done / FILES.length);
                        });
                    });
                });
            }, Promise.resolve());
        });
    }

    // "Download" means the whole app, not just the data: ask the service worker to cache both
    // language shells and their assets now (owner: «нужно кешировать все и сразу»), so switching the
    // language offline works without having visited that page before.
    function precacheApp() {
        var sw = navigator.serviceWorker;
        if (!sw || !sw.controller) return Promise.resolve(false);
        sw.controller.postMessage({ dgPrecacheAll: true });
        return new Promise(function (resolve) {
            var done = function (e) {
                if (e.data && e.data.dgPrecacheDone) { sw.removeEventListener('message', done); resolve(true); }
            };
            sw.addEventListener('message', done);
            setTimeout(function () { sw.removeEventListener('message', done); resolve(false); }, 30000);
        });
    }

    function remove() {
        loaded = null;
        return window.caches ? caches.delete(CACHE) : Promise.resolve(false);
    }

    // Refresh a cached file when the site's copy changed (ETag — a 304 costs nothing). Ported from
    // native-bridge.js dictionaryFromSite(); once per page load, never blocks a lookup.
    function revalidate() {
        if (!window.caches || navigator.onLine === false) return;
        open().then(function (cache) {
            FILES.forEach(function (url) {
                cache.match(url).then(function (hit) {
                    if (!hit) return;
                    fetch(url, { cache: 'no-cache' }).then(function (res) {
                        if (!res.ok) return;
                        var tag = res.headers.get('etag');
                        if (tag && hit.headers.get('etag') === tag) return;
                        cache.put(url, res);
                    }).catch(function () {});
                });
            });
        }).catch(function () {});
    }

    function inject(text) {
        var el = document.createElement('script');
        el.textContent = text;
        document.head.appendChild(el);
    }

    // Reads the cached files and evaluates them: they are plain `var dpd_i2h = {...}` literals.
    function load() {
        if (window.dpd_i2h && window.dpd_ebts) return Promise.resolve(true);
        // A failed attempt is not remembered: the first search before the download used to pin
        // "not loaded" for the rest of the page's life, so the freshly downloaded data was ignored.
        if (loaded) return loaded.then(function (ok) { if (!ok) loaded = null; return ok; });
        loaded = open().then(function (cache) {
            return Promise.all([SHARED[0], SHARED[1], EBTS_HERE].map(function (u) {
                return cache.match(u).then(function (hit) { return hit ? hit.text() : null; });
            }));
        }).then(function (texts) {
            if (texts.some(function (t) { return !t; })) return false;
            texts.forEach(inject);
            return true;
        }).catch(function () { return false; });
        return loaded;
    }

    // ——— the lookup itself: not a new algorithm, the one paliLookup.js and ai-search.js already use.
    function fold(word) {
        // The page writes niggahita with a dot above, the bundled DPD only with a dot below.
        return String(word).toLowerCase().replace(/[’”'"]/g, '').replace(/ṁ/g, 'ṃ');
    }

    function headwords(key) {
        var ebts = window.dpd_ebts, i2h = window.dpd_i2h;
        // dpd_i2h maps INFLECTED forms to headwords, so a word that is already the dictionary form
        // ("kacchapa") can be missing from it while sitting in dpd_ebts as its own entry.
        var heads = (i2h[key] || []).concat(ebts[key] ? [key] : (ebts[key + ' 1'] ? [key + ' 1'] : []));
        // The direct probe often repeats what i2h already listed ("paṭicca 1" twice on screen).
        heads = heads.filter(function (h, i) { return heads.indexOf(h) === i; });
        // i2h lists candidates alphabetically, not by relevance: for "nibbāna" it puts "nibba" (eaves)
        // first. A Pali form extends its lemma, so the longest headword the form starts with IS it.
        return heads.slice().sort(function (a, b) {
            var la = a.replace(/ \d+$/, ''), lb = b.replace(/ \d+$/, '');
            return (key.indexOf(lb) === 0 ? lb.length : -1) - (key.indexOf(la) === 0 ? la.length : -1);
        });
    }

    function unfold(html) { return html.replace(/ṃ/g, 'ṁ'); }

    // Returns entry HTML for #dpd-results, or '' when the word is not in the data.
    function lookup(word) {
        if (!word || /^[\d\-]+$/.test(word)) return '';
        if (!window.dpd_i2h || !window.dpd_ebts) return '';
        var key = fold(word);
        var ebts = window.dpd_ebts;
        var out = '';
        var heads = headwords(key);
        if (heads.length) {
            out += '<ul class="offline-dpd-list">';
            heads.forEach(function (head) {
                if (!ebts[head]) return;
                out += '<li><span class="pli-lang" lang="pi"><b>' + head + '</b>. ' + ebts[head] + '</span></li>';
            });
            out += '</ul>';
            if (out.indexOf('<li>') === -1) out = '';
        }
        var deco = window.dpd_deconstructor && window.dpd_deconstructor[key];
        if (deco) out += '<ul class="offline-dpd-list"><li><span class="pli-lang" lang="pi">' + deco + '</span></li></ul>';
        // No headword line of our own: the page already shows the word above the slots.
        return out ? unfold(out) : '';
    }

    window.dgOffline = {
        state: state,
        download: download,
        precacheApp: precacheApp,
        remove: remove,
        load: load,
        lookup: lookup,
        files: FILES,
        sizeMb: SIZE_MB,
        isRu: isRu
    };

    // ——— UI: the menu row (download → % → delete), the line in the "Dictionary on any site" card,
    // and the invitation shown in the installed app.
    var T = isRu ? {
        download: 'скачать', remove: 'удалить', downloading: 'качаю',
        titleDownload: 'Скачать офлайн мини-словарь', titleRemove: 'Удалить офлайн мини-словарь',
        sub: 'краткие значения без интернета · ~' + SIZE_MB + ' МБ',
        subReady: 'скачан, работает без интернета',
        failed: 'Не удалось скачать. Проверьте соединение и попробуйте ещё раз.',
        bubbleStart: 'Скачиваю офлайн-словарь…',
        bubbleDone: 'Офлайн-словарь скачан',
        bubbleHave: 'Офлайн-словарь уже скачан',
        bubbleFail: 'Не удалось скачать словарь'
    } : {
        download: 'download', remove: 'delete', downloading: 'loading',
        titleDownload: 'Download the offline mini-dictionary', titleRemove: 'Delete the offline mini-dictionary',
        sub: 'short meanings with no network · ~' + SIZE_MB + ' MB',
        subReady: 'downloaded, works with no network',
        failed: 'Download failed. Check the connection and try again.',
        bubbleStart: 'Downloading the offline dictionary…',
        bubbleDone: 'Offline dictionary downloaded',
        bubbleHave: 'The offline dictionary is already downloaded',
        bubbleFail: 'Could not download the dictionary'
    };

    function el(id) { return document.getElementById(id); }

    // The site's own bubble (#bubbleNotification, openDicts.js showBubbleNotification) — but this
    // one stays up while the download runs instead of hiding after two seconds.
    function bubble(text, hideAfterMs) {
        var node = el('bubbleNotification');
        if (!node) return;
        node.textContent = text;
        node.classList.add('show');
        clearTimeout(bubble.timer);
        if (hideAfterMs) bubble.timer = setTimeout(function () { node.classList.remove('show'); }, hideAfterMs);
    }

    function paint(current) {
        var btn = el('offline-dl-btn'), sub = el('offline-dl-sub');
        if (!btn) return;
        var ready = current === 'ready';
        btn.disabled = false;
        btn.innerHTML = ready
            ? '<i class="fa-regular fa-trash-can"></i>' + T.remove
            : '<i class="fa-solid fa-download"></i>' + T.download;
        btn.title = ready ? T.titleRemove : T.titleDownload;
        if (sub) sub.textContent = ready ? T.subReady : T.sub;
        var invite = el('dg-offline-invite');
        if (invite && ready) invite.hidden = true;
    }

    function runDownload() {
        var btn = el('offline-dl-btn'), sub = el('offline-dl-sub');
        if (btn) { btn.disabled = true; btn.innerHTML = T.downloading + ' 0%'; }
        bubble(T.bubbleStart + ' 0%');
        return download(function (share) {
            var pct = Math.round(share * 100) + '%';
            if (btn) btn.innerHTML = T.downloading + ' ' + pct;
            bubble(T.bubbleStart + ' ' + pct);
        }).then(function () {
            bubble(T.bubbleDone, 2500);
            loaded = null;            // pick up the freshly cached files on the next lookup
            precacheApp();            // not awaited: under dhamma.gift/dict/ the controller is the
                                      // main site's worker, which knows nothing about this message
            return state().then(paint);
        }).catch(function () {
            bubble(T.bubbleFail, 3500);
            return state().then(function (current) {
                paint(current);                       // paint() rewrites the sub line, so say it after
                if (sub && current !== 'ready') sub.textContent = T.failed;
            });
        });
    }

    function wire() {
        var btn = el('offline-dl-btn');
        if (btn) {
            btn.addEventListener('click', function () {
                state().then(function (current) {
                    if (current === 'ready') return remove().then(function () { return state().then(paint); });
                    return runDownload();
                });
            });
        }
        var link = el('offline-dl-link');
        if (link) {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                state().then(function (current) {
                    // From the card there is no button to watch, so the bubble is the only feedback.
                    if (current === 'ready') { bubble(T.bubbleHave, 2500); paint(current); return; }
                    runDownload();
                });
            });
        }
        var invite = el('dg-offline-invite');
        if (invite) {
            var yes = el('dg-offline-invite-yes'), no = el('dg-offline-invite-no');
            if (yes) yes.addEventListener('click', function () { invite.hidden = true; runDownload(); });
            if (no) no.addEventListener('click', function () {
                invite.hidden = true;
                try { localStorage.setItem('dgOfflineDismissed', '1'); } catch (e) {}
            });
        }
        state().then(function (current) {
            paint(current);
            // Only in the installed app (TWA/PWA): ?source=pwa is stripped by extra.js on a language
            // redirect, so the display-mode check is the one that survives.
            var installed = /[?&]source=pwa\b/.test(location.search) ||
                (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
            var dismissed = false;
            try { dismissed = !!localStorage.getItem('dgOfflineDismissed'); } catch (e) {}
            if (invite && installed && current !== 'ready' && !dismissed) invite.hidden = false;
        });
    }

    // One class for "we are offline", so the interface can stay honest about what still works
    // (CSS greys out the pronounce button; star/copy/link need no network).
    function paintOnline() {
        if (document.body) document.body.classList.toggle('is-offline', navigator.onLine === false);
    }
    window.addEventListener('online', paintOnline);
    window.addEventListener('offline', paintOnline);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { wire(); paintOnline(); });
    } else { wire(); paintOnline(); }

    // Keep what is already downloaded current, but never on a cold cache: nothing is fetched until
    // the reader asks for it.
    state().then(function (s) { if (s === 'ready') { revalidate(); load(); } });
})();
