//TODO починить чтобы ответ Buddhadust шрифт нужно тоже инвертировать а то он на светлой теме нормально. а в темной остается темным.
//
//
window.isRu = /\/ru(\/|$)/.test(window.location.pathname);

// Returns the app's install base path (e.g. '/' or '/dict/'), stripping any /ru or /th segment.
// Install base of the app ("/" on dict.dhamma.gift, "/dict/" under dhamma.gift), read from where
// this script was loaded — not from the page path, which may carry a clean-path word
// (/dukkha) or the language folder (/ru/, whose static/ is a symlink to the same files).
function getAppBase() {
    for (const s of document.getElementsByTagName('script')) {
        if (!s.src) continue;
        const path = new URL(s.src).pathname;
        const i = path.indexOf('/static/');
        if (i !== -1) return path.slice(0, i + 1).replace(/(ru|th)\/$/, '');
    }
    return '/';
}

// Service worker, registered with an EXPLICIT scope. It used to be an inline
// navigator.serviceWorker.register('static/sw.js') in the page: a relative URL gives the worker
// the scope of its own folder (/static/), so it controlled no navigation and the app never opened
// offline. The scope is the install base, so this line also works under dhamma.gift/dict/ (where
// the Service-Worker-Allowed header is not set — the registration simply fails and is ignored).
if ('serviceWorker' in navigator) {
    const swBase = getAppBase();
    navigator.serviceWorker.register(swBase + 'static/sw.js', { scope: swBase }).catch(() => {});
    // Clean up the registrations the old inline script left behind (scope .../static/, controlling
    // nothing): a browser that ever opened this site still carries one, and under /dict/ two.
    navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => { if (/\/static\/$/.test(reg.scope)) reg.unregister(); });
    }).catch(() => {});
}

// Clean-path search: dict.dhamma.gift/kacchapa or /ru/kacchapa (and the same one folder
// deeper, e.g. dhamma.gift/dict/kacchapa) search for kacchapa exactly like ?q=kacchapa,
// without rewriting the address bar. The install base (root vs. a subfolder) is read
// from this very script's own resolved src rather than hardcoded, so it tracks wherever
// the app is actually deployed. urlParams below folds this in, so every existing
// urlParams.get('q') call site just works, whichever way the word arrived.
let pathWord = (function () {
    if (new URLSearchParams(window.location.search).get('q')) return null; // ?q= already wins

    let installBase = '/';
    for (const s of document.getElementsByTagName('script')) {
        if (!s.src) continue;
        const path = new URL(s.src).pathname;
        const i = path.indexOf('/static/');
        if (i !== -1) { installBase = path.slice(0, i + 1); break; }
    }

    let rest = window.location.pathname.startsWith(installBase)
        ? window.location.pathname.slice(installBase.length)
        : window.location.pathname.replace(/^\//, '');
    rest = rest.replace(/^(ru|th)\/?/, '').replace(/^\/+|\/+$/g, '');

    return (rest && !rest.includes('/')) ? decodeURIComponent(rest) : null;
})();

// Every "new URLSearchParams(window.location.search)" below goes through this instead,
// so a clean-path word (pathWord, computed above) reads back as q= too.
// The dictionary's own address for a word: the word as a clean path (/dukkha, /dict/dukkha),
// ?lang=ru for Russian, other parameters kept. A word with "/" in it can't be a path segment,
// so that one stays ?q=.
function dictUrl(word) {
    const params = new URLSearchParams(window.location.search);
    params.delete('q');
    params.delete('lang');
    if (window.isRu) params.set('lang', 'ru');
    let path = getAppBase();
    if (word) {
        if (word.includes('/')) params.set('q', word);
        else path += encodeURIComponent(word);
    }
    const qs = params.toString();
    return path + (qs ? '?' + qs : '');
}

// The word the page shows right now: ?q= or the path after the app base (and ru/). Unlike
// pathWord (fixed at load), this follows searches pushed into the address bar.
function currentDictWord() {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) return q;
    const base = getAppBase();
    let rest = window.location.pathname.startsWith(base) ? window.location.pathname.slice(base.length) : '';
    rest = rest.replace(/^(ru|th)\/?/, '').replace(/^\/+|\/+$/g, '');
    return (rest && !rest.includes('/')) ? decodeURIComponent(rest) : null;
}

function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (pathWord && !params.get('q')) params.set('q', pathWord);
    return params;
}

// theme from GET ?theme=dark|light
(function () {
  const params = new URLSearchParams(window.location.search);
  const theme = params.get('theme');

  if (theme === 'dark' || theme === 'light') {
    document.body.classList.remove('dark-mode', 'light-mode');
    document.body.classList.add(theme + '-mode');
    localStorage.setItem('theme', theme);

    if (window.themeToggle) {
      themeToggle.checked = theme === 'dark';
    }
  }
})();

// language: ?lang=ru|en wins outright; otherwise, if the URL itself doesn't already say
// /ru/ or /th/, fall back to whatever was last picked (Settings, or an earlier ?lang=)
// so a plain revisit opens in the same language as last time. /ru/ and /th/ paths keep
// working as before (old links, bookmarks) — changeLanguage() (below, hoisted) still
// navigates there to fetch the actually-translated file, there's no way around that with
// two separate static templates — but once landed, the bar is masked back to the
// language-neutral path below, so both languages end up showing the same URL shape.
(function () {
  const params = new URLSearchParams(window.location.search);
  const explicitLang = params.get('lang');
  const noPathLang = !/\/(ru|th)(\/|$)/.test(window.location.pathname);
  const lang = explicitLang || (noPathLang ? localStorage.getItem('siteLanguage') : null);

  if (lang === 'ru' && !window.isRu) { changeLanguage('ru'); return; }
  if (lang === 'en' && window.isRu) { changeLanguage('en'); return; }

  // Settled on the right language for this load — remember an explicit choice, then clean
  // the address bar: drop a now-redundant ?lang=, and mask away /ru//th/ (language state
  // lives in localStorage/?lang=, not the path, going forward).
  if (explicitLang === 'ru' || explicitLang === 'en') localStorage.setItem('siteLanguage', explicitLang);
  // Russian shows as ?lang=ru in the bar (like dhamma.gift), so a shared link opens in Russian too;
  // English is the default and needs no parameter.
  params.delete('lang');
  if (window.isRu) params.set('lang', 'ru');
  // An old-style ?q= word moves into the path (/dukkha), the same address a search produces.
  let shownPath = window.location.pathname.replace(/\/(ru|th)(\/|$)/, '/').replace(/\/\//g, '/') || '/';
  const qWord = params.get('q');
  if (qWord && !qWord.includes('/') && shownPath === getAppBase()) {
    shownPath = getAppBase() + encodeURIComponent(qWord);
    params.delete('q');
    pathWord = qWord;
  }
  window.dgPathWord = pathWord;
  const qs = params.toString();
  const newUrl = shownPath + (qs ? '?' + qs : '') + window.location.hash;
  // The landing entry carries its word too, so Back from a later search can bring it back.
  const needsState = pathWord && !(history.state && history.state.q);
  if (needsState || newUrl !== window.location.pathname + window.location.search + window.location.hash) {
    history.replaceState(pathWord ? { q: pathWord } : null, '', newUrl);
  }
})();

// Проверяем, есть ли параметр source=pwa в URL
const urlParams = getUrlParams();
const isPWA = urlParams.get('source') === 'pwa';

// Если это PWA и нужно принудительно задать язык
if (isPWA) {
    // Удаляем параметр source=pwa (чтобы он не дублировался после редиректа)
    urlParams.delete('source');

    // Сохраняем оставшиеся параметры в строку (если они есть)
    const remainingQuery = urlParams.toString();
    const queryString = remainingQuery ? `?${remainingQuery}` : '';

    // Проверяем язык в localStorage или определяем его
    let siteLanguage = localStorage.getItem('siteLanguage');

    if (!siteLanguage) {
        const currentPath = window.location.pathname;
        
        if (currentPath.includes('/ru/')) {
            siteLanguage = 'ru';
        } else if (currentPath.includes('/th/')) {
            siteLanguage = 'th';
        } else {
            const browserLang = navigator.language || navigator.userLanguage;
            siteLanguage = browserLang.startsWith('ru') ? 'ru' : 
                          browserLang.startsWith('th') ? 'th' : 'en';
        }
        localStorage.setItem('siteLanguage', siteLanguage);
    }

    // Получаем текущий путь и хэш
    const currentPath = window.location.pathname;
    const currentHash = window.location.hash;

    // Делаем редирект с сохранением всех параметров (кроме source=pwa) и хэша
    const base = getAppBase();
    const basePath = base.replace(/\/$/, '');  // strip trailing slash for concatenation
    if (siteLanguage === 'ru' && !currentPath.match(/\/ru(\/|$)/)) {
        window.location.href = `${basePath}/ru/${queryString}${currentHash}`;
    } else if (siteLanguage === 'th' && !currentPath.match(/\/th(\/|$)/)) {
        window.location.href = `${basePath}/th/${queryString}${currentHash}`;
    } else if (siteLanguage === 'en' && currentPath.match(/\/(ru|th)(\/|$)/)) {
        window.location.href = `${base}${queryString}${currentHash}`;
    }
}
// ======== Конфигурация ========
const LANGUAGE_PREFIX = '/ru'; // Префикс для русского языка
const DEFAULT_LANG = 'en';     // Язык по умолчанию

// ======== Hotkeys ========
// The same scheme as dhamma.gift (owner: the dictionary's keys should repeat the site's). By
// event.code, so they work in any keyboard layout. Alt+1 (language), Alt+T (theme) and "/" (search
// box) are handled further down in this file.
//   Alt+S — "other dictionaries" menu (the dictionary's quick settings), Alt+Shift+S — settings panel
//   Alt+M — menu, Alt+H — help, Alt+P / Alt+Y — compass (the site's quick window)
//   Alt+Q — word to favorites, Alt+R — read the word aloud
//   Alt+F / Alt+Shift+F / Ctrl+Shift+F — find on the page, Alt+− / Alt+= / Alt+0 — font size
//   Alt+2 — Dhamma.Gift table of contents, Alt+3 — this word in Dhamma.Gift search
// dgOpenFind / dgOpenCompass / dgToggleMenu live in dg-site.js (loaded after this file).
function dgFind() { if (typeof window.dgOpenFind === 'function') window.dgOpenFind(); }
document.addEventListener('keydown', function (event) {
  const code = event.code;
  // Ctrl/Cmd+Shift+F — the site's other find binding (plain Ctrl+F belongs to the browser).
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && code === 'KeyF') {
    event.preventDefault(); dgFind(); return;
  }
  if (!event.altKey || event.ctrlKey || event.metaKey) return;
  const run = (fn) => { event.preventDefault(); fn(); };
  const ru = !!window.isRu;
  if (event.shiftKey) {
    // Everything lives in the burger menu now, so Alt+Shift+S is just a second way in (Alt+M).
    if (code === 'KeyS') run(() => window.dgToggleMenu && window.dgToggleMenu());
    else if (code === 'KeyF') run(dgFind);
    return;
  }
  switch (code) {
    case 'KeyS': run(() => { const t = document.querySelector('.dict-dropdown-toggle'); if (t) t.click(); }); break;
    case 'KeyH': run(() => window.dgOpenHelp && window.dgOpenHelp()); break;
    case 'KeyP': case 'KeyY': run(() => window.dgOpenCompass && window.dgOpenCompass()); break;
    case 'KeyM': run(() => window.dgToggleMenu && window.dgToggleMenu()); break;
    case 'Digit0': case 'Numpad0': run(() => { if (typeof setFontSize === 'function') { fontSize = BASE_FONT_SIZE; setFontSize(); saveFontSize(); } }); break;
    case 'KeyQ': run(() => window.favToggle && window.favToggle()); break;
    case 'KeyR': run(() => window.speakWord && window.speakWord()); break;
    case 'KeyF': run(dgFind); break;
    case 'Minus': case 'NumpadSubtract': run(() => typeof decreaseFontSize === 'function' && decreaseFontSize()); break;
    case 'Equal': case 'NumpadAdd': run(() => typeof increaseFontSize === 'function' && increaseFontSize()); break;
    case 'Digit2': run(() => { window.location.href = 'https://dhamma.gift/toc' + (ru ? '?lang=ru' : ''); }); break;
    case 'Digit3': run(() => {
      const q = (document.getElementById('search-box')?.value || '').trim();
      window.location.href = 'https://dhamma.gift/' + (q ? encodeURIComponent(q) : '') + (ru ? '?lang=ru' : '');
    }); break;
  }
});


document.addEventListener("keydown", handleLanguageShortcut);

// Применяем сохраненный язык при загрузке
/* function applySavedLanguage() {
    const savedLang = localStorage.getItem("preferredLanguage");
    const currentPath = window.location.pathname;
    
    // Если язык не совпадает с сохраненным
    if (savedLang === 'ru' && !currentPath.startsWith(LANGUAGE_PREFIX)) {
        redirectWithLanguage(LANGUAGE_PREFIX + currentPath);
    } else if (savedLang !== 'ru' && currentPath.startsWith(LANGUAGE_PREFIX)) {
        redirectWithLanguage(currentPath.slice(LANGUAGE_PREFIX.length));
    }
}*/

// Обработка горячих клавиш
function handleLanguageShortcut(event) {
    if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.code === "Digit1") {
        event.preventDefault();
        toggleLanguage();
    }
}

// Переключение языка. window.isRu (not the path — /ru/ gets masked out of the address
// bar after load, see the language IIFE near the top of this file) is the source of truth
// for which language actually rendered.
function toggleLanguage() {
    changeLanguage(window.isRu ? 'en' : 'ru');
}


// Add this with other hotkey listeners
document.addEventListener('keydown', function(event) {
  if (event.altKey && event.code === 'KeyT') {
    event.preventDefault();
    toggleThemeProgrammatically();
  }
});

// Add this function to programmatically toggle the theme
function toggleThemeProgrammatically() {
  themeToggle.checked = !themeToggle.checked;
  const event = new Event('change');
  themeToggle.dispatchEvent(event);
}

//установка фокуса в инпуте по нажатию / 
document.addEventListener('keydown', function(event) {
    // Проверяем именно символ / (код 191 или Slash)
    if (event.key === '/' || event.code === 'Slash') {
        // Ищем все возможные инпуты
        const inputs = document.querySelectorAll(
            '#search-box[type="search"], #paliauto[type="text"], .dtsb-value.dtsb-input'
        );
		        
        // Если нет ни одного подходящего инпута - выходим
        if (inputs.length === 0) return;
        
        // Берем первый подходящий инпут (или можно реализовать более сложную логику выбора)
        const input = inputs[0];
        
        // Предотвращаем действие по умолчанию только если нашли инпут
        event.preventDefault();

        // Snap the search bar visible *before* focusing: if we let it slide in
        // while jQuery UI autocomplete opens on the native "focus" event, the
        // dropdown reads the input's (still off-screen) position and misplaces itself.
        const tbar = document.querySelector('.tbar');
        if (tbar && document.body.classList.contains('tbar-hide')) {
            tbar.style.transition = 'none';
            document.body.classList.remove('tbar-hide');
            tbar.offsetHeight; // force reflow before restoring the transition
            tbar.style.transition = '';
        }

        // Фокусируемся и перемещаем курсор в конец
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }
});

// Отключаем перехват / когда фокус уже в инпуте
const handleInputKeydown = (event) => {
    if (event.key === '/' || event.code === 'Slash') {
        event.stopPropagation();
    }
};

// Вешаем обработчики на все существующие и будущие инпуты
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('keydown', handleInputKeydown);
});

// Наблюдатель для динамически добавляемых инпутов
new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeName === 'INPUT') {
                node.addEventListener('keydown', handleInputKeydown);
            } else if (node.querySelectorAll) {
                node.querySelectorAll('input').forEach(input => {
                    input.addEventListener('keydown', handleInputKeydown);
                });
            }
        });
    });
}).observe(document.body, { childList: true, subtree: true });

//конец фокуса в инпуте по нажатию / 


let startMessage;

function initStartMessage(lang) {
    
    // === НОВОЕ: Обработка silent режима ===
    const urlParams = getUrlParams();
    if (urlParams.has('silent')) {
        // Используем lang (аргумент) или language (глобальную переменную)
        // Оборачиваем в HTML, чтобы сохранились отступы и стили
        if (lang === 'ru' || (typeof language !== 'undefined' && language === 'ru')) {
            startMessage = `
            <div class="message-container">
                <p class="message" style="text-align: center; margin-top: 20px;">
                    Ждём ответ от DPD...
                </p>
            </div>`;
        } else {
            startMessage = `
            <div class="message-container">
                <p class="message" style="text-align: center; margin-top: 20px;">
                    Waiting for a response from DPD...
                </p>
            </div>`;
        }
        return; // Важно: выходим, чтобы не перезаписать переменную длинным текстом ниже
    }
    if (language === 'en') {
        startMessage = `
<div class="message-container">
  <div class="messages-content">
    <p class="message">Search in Pāḷi using <b>Autocomplete</b> or <b>Velthuis</b>, or use English.</p>
    <p class="message">For <b>Pali Lookup on any sites</b>: <a title='Chrome, Opera, Brave, Edge or Yandex Browser. Also available in Firefox Add-ons' target="_blank" href='https://chromewebstore.google.com/detail/dhammagift-search-and-wor/dnnogjdcmhbiobpnkhdbfnfjnjlikabd?authuser=1&hl=en'>Browser Extention</a>, <a href='#' title='Chrome menu → "Add to Home screen"' id='installLink'>Web</a> or <a target="" href="https://github.com/dhammagift/dg-twa/releases/download/prod-latest/dict-dhamma-gift.apk" title="Latest APK file for Dict.Dhamma.Gift TWA">app</a>. Then: select the word → in OS "share" menu choose Dict.DG.</p>
	    <p class="message"><b>Grammar Dictionary table</b> is sortable.</p>

  </div>

  <input type="checkbox" id="toggle-messages" class="toggle-checkbox">
  
  <div class="collapsible">
    <p class="message">
    
    </p>
    <p class="message">
  <b>Available Hotkeys:</b> press <strong>/</strong> to activate the search bar<br>
  <strong>Alt+1</strong> — Toggle English/Russian<br>
  <strong>Alt+2</strong> — Dhamma.Gift table of contents · <strong>Alt+3</strong> — this word in Dhamma.Gift search<br>
  <strong>Alt+S</strong> — other dictionaries · <strong>Alt+Shift+S</strong> — settings · <strong>Alt+H</strong> — help<br>
  <strong>Alt+M</strong> — menu · <strong>Alt+P</strong> — compass · <strong>Alt+Q</strong> — to favorites · <strong>Alt+R</strong> — read aloud<br>
  <strong>Alt+F</strong> — find on the page · <strong>Alt+−/=/0</strong> — font size · <strong>Alt+T</strong> — Toggle Theme
</p>
    <p class="message"><b>Footer links</b>: Dict - to search the word in other dicts, DG - with Dhamma.Gift, DPD - in Dpdict.net</p>
    <p class="message">Adjust <b>Settings</b> as needed including changing language. <b>Refresh</b> page if issues occur.</p>
    <p class="message"><b>Double-click</b> any word to search. e.g.: kāmarāgapariyuṭṭhitena peace kar gacchatīti Root✓</p>
 <p class="message">
<strong>Autosuggestions</strong>: from the Four Nikāyas (DN, MN, SN, AN), parts of the KN (Dhp, Iti, Ud, Snp), and all sections of the Vinaya, Mahāsaṅgīti edition; exc variants readings .<br>
<strong>Match count</strong> (e.g., mettā 27) shows how many times the word appears in these texts.
</p>


  </div>
  
  <div class="toggle-button-container">
    <label for="toggle-messages" class="toggle-button">
      <span class="more-text">More</span>
      <span class="hide-text">Hide</span>
    </label>
  </div>
</div>
`;
    } else if (language === 'ru') {
        startMessage = `
        <div class="message-container">
  <div class="messages-content">
<p class="message">Ищите на пали с <b>Автоподсказками</b> или <b>Velthuis</b>, или русском .</p>
<p class="message">Для <b>словаря на любом сайте</b> есть: <a target='_blank' title='Chrome, Opera, Brave, Edge или Yandex Browser. Также есть в Fierfox Add-ons' href='https://chromewebstore.google.com/detail/dhammagift-search-and-wor/dnnogjdcmhbiobpnkhdbfnfjnjlikabd?authuser=1&hl=ru'>Расширение</a>, и <a title='также через Меню Chrome → "Добавить на главную" → Установить' href='#' id='installLink'>Web</a> или <a target="" href="https://github.com/dhammagift/dg-twa/releases/download/prod-latest/dict-dhamma-gift.apk" title="Последнее оновление APK для Dict.Dhamma.Gift TWA">приложение</a>. 
Затем: выделите слово → в ОС меню "поделиться" выберите Dict.DG.</p>
<p class="message"><b>Таблицу в Словаре Грамматики</b> можно сортировать.</p>

  </div>
  <input type="checkbox" id="toggle-messages" class="toggle-checkbox">
  
  <div class="collapsible">
<p class="message"><b>Горячие Клавиши</b>: нажмите <strong>/</strong> чтобы активировать строку поиска<br>
<strong>Alt+1</strong> переключить Рус/Англ<br>
<strong>Alt+2</strong> оглавление Dhamma.Gift · <strong>Alt+3</strong> это слово в поиске Dhamma.Gift<br>
<strong>Alt+S</strong> другие словари · <strong>Alt+Shift+S</strong> настройки · <strong>Alt+H</strong> справка<br>
<strong>Alt+M</strong> меню · <strong>Alt+P</strong> компас · <strong>Alt+Q</strong> в избранное · <strong>Alt+R</strong> озвучить<br>
<strong>Alt+F</strong> найти на странице · <strong>Alt+−/=/0</strong> размер шрифта · <strong>Alt+T</strong> переключить тему
</p>
<p class="message"><b>Ссылки в футере</b> Dict - поиск слова в разных словарях, DG - через Dhamma.Gift, DPD - на Dpdict.net</p>
<p class="message">Попробуйте разные <b>Настройки</b>, включая смену языка. При возникновении проблем <b>Обновите</b> страницу.</p>
<p class="message"><b>Двойной клик</b> по любому слову для поиска. К примеру: kāmarāgapariyuṭṭhitena мир kar gacchatīti Root✓</p>
  
<p class="message">
<strong>Автоподсказки</strong>: слова из Четырёх Никай (DN, MN, SN, AN), части KN (Dhp, Iti, Ud, Snp) и всех разделов Винаи, редакции Mahasangiti, варианты не выводятся.<br>
<strong>Кол-во совпадений</strong> (например, mettā 27) показывает, сколько раз слово встречается в этих текстах.
</p>
  </div>
  
  <div class="toggle-button-container">
    <label for="toggle-messages" class="toggle-button">
      <span class="more-text">Ещё</span>
      <span class="hide-text">Скрыть</span>
    </label>
  </div>
</div>

`;
    }
}

  // Модифицированная функция changeLanguage   url.protocol = 'https:'; 
function changeLanguage(lang) {
  if (typeof showSpinner === 'function') {
      showSpinner();
  }

  const currentPath = window.location.pathname;
  if (currentPath.includes('search_html')) {
      const container = document.getElementById('dpdResults');
      
      if (container) {
          container.insertAdjacentHTML('beforeend', `
            <div class="spinner-container transparent-spinner">
                <img src="static/circle-notch.svg" class="loading-spinner">
            </div>
        `);
      }
  }

  const url = new URL(window.location.href);
  const base = getAppBase();
  // The word stays in the path (/ru/dukkha), so the other language opens the same entry.
  const word = currentDictWord();
  url.searchParams.delete('q');
  url.pathname = (lang === 'ru' ? base + 'ru/' : base) + (word && !word.includes('/') ? encodeURIComponent(word) : '');
  if (word && word.includes('/')) url.searchParams.set('q', word);
  // The target language decides ?lang= (a leftover lang=ru would bounce English straight back).
  if (lang === 'ru') url.searchParams.set('lang', 'ru'); else url.searchParams.delete('lang');
  const siteLanguage = lang === 'ru' ? 'ru' : 'en';

  localStorage.setItem('siteLanguage', siteLanguage);

  const payload = { 
      action: 'dg_language_changed', 
      lang: siteLanguage 
  };

  window.postMessage(payload, '*');

  if (window.parent && window.parent !== window) {
      window.parent.postMessage(payload, '*');
  }

  if (window.opener && window.opener !== window) {
      window.opener.postMessage(payload, '*');
  }

  window.location.href = url.toString();
}

//ссылки в футере
const searchBoxForFooter = document.getElementById('search-box');

// Функция для обновления конкретной ссылки
function updateLink(el, baseUrl) {
  // берём значение из инпута
  let query = searchBoxForFooter?.value?.trim() || '';

  // если инпут пуст — берём из URL
  if (!query) {
    const params = new URLSearchParams(window.location.search);
    query = params.get('q') || '';
  }

  const url = new URL(baseUrl);
  url.searchParams.set('q', query);

  // обновляем href ТОЛЬКО ПЕРЕД ПЕРЕХОДОМ
  el.href = url.toString();
}

// The six other dictionaries are only filled after a successful DPD hit, so without this they
// would keep showing the PREVIOUS word offline. Was the else-branch below, now shared with it.
function clearExternalSlots() {
    ['tripitaka', 'gandhari', 'pts', 'buddhadust', 'wisdomlib'].forEach((code) => {
        const slot = document.getElementById('ext-slot-' + code);
        const c = slot ? slot.querySelector('.ext-dict-content') : null;
        if (c) c.innerHTML = '';
    });
    const sanskritSlot = document.getElementById('ext-slot-sanskrit');
    const sc = sanskritSlot ? sanskritSlot.querySelector('.ext-dict-content') : null;
    const res = sc ? sc.querySelector('#sanskrit-results') : null;
    if (res) res.innerHTML = '';
}

// Offline answer: a short meaning from the bundled DPD (offline-dpd.js), clearly labelled so nobody
// mistakes it for the full DPD article. Returns false when there is nothing to show — the caller
// then keeps its own message.
// The DPD slot already says "DPD — Digital Pāḷi Dictionary"; a badge inside the answer said it a
// third time (owner). The offline state is marked once, next to that title.
function markDpdOffline(on) {
    // navigator.onLine can stay true while nothing actually reaches the network (captive portals,
    // a dead uplink), so the interface follows what the last request DID, not what the flag says:
    // the pronounce button is greyed out (dg.css body.is-offline) as soon as we answer offline.
    document.body.classList.toggle('is-offline', !!on);
    const title = document.querySelector('#ext-slot-dpd .ext-dict-title');
    if (!title) return;
    let mark = title.querySelector('.ext-dict-offline');
    if (!on) { if (mark) mark.remove(); return; }
    if (!mark) {
        mark = document.createElement('span');
        mark.className = 'ext-dict-offline';
        title.appendChild(mark);
    }
    mark.textContent = window.isRu ? 'офлайн мини' : 'offline mini';
}

async function renderOffline(query, resultsContainer, summaryContainer) {
    if (!resultsContainer || !window.dgOffline) return false;
    const ru = window.isRu;
    const note = (text) => `<div class="offline-dpd-note">${text}</div>`;
    let entry = '';
    try {
        if (await window.dgOffline.load()) entry = window.dgOffline.lookup(query);
    } catch (e) { /* cache unavailable — fall through to the "not downloaded" line */ }

    if (!entry) {
        const state = await window.dgOffline.state().catch(() => 'none');
        if (state !== 'ready') return false;  // nothing downloaded: the caller explains that
        resultsContainer.innerHTML = note(ru ? 'Нет в офлайн-словаре' : 'Not in the offline dictionary');
    } else {
        resultsContainer.innerHTML = entry;
    }
    markDpdOffline(true);
    resultsContainer.dataset.stale = 'false';
    if (summaryContainer) summaryContainer.innerHTML = '';
    return true;
}

async function handleClientSearch(rawQuery) {
    const query = cleanQueryParam(rawQuery);
    if (!query) return;

    const searchBox = document.getElementById('search-box');
    if (searchBox && searchBox.value !== query) {
        searchBox.value = query;
    }

    if (typeof addToHistory === 'function') {
        addToHistory(query);
    } else {
        window.history.pushState({ q: query }, '', dictUrl(query));
    }
    
    if (typeof populateHistoryBody === 'function') {
        populateHistoryBody();
    }

    const resultsContainer = document.getElementById('dpd-results');
    const summaryContainer = document.getElementById('summary-results');

    if (summaryContainer) {
        summaryContainer.innerHTML = '';
    }

    if (resultsContainer) {
        const loadingText = window.isRu ? 'Ждём ответ от DPD...' : 'Waiting for a response from DPD...';
        resultsContainer.innerHTML = `
            <div class="message-container" style="text-align: center; margin-top: 40px;">
                <div class="spinner-container transparent-spinner" style="margin-bottom: 15px;">
                    <img src="static/circle-notch.svg" class="loading-spinner" alt="Loading">
                </div>
                <p class="message">${loadingText}</p>
            </div>
        `;
        resultsContainer.dataset.stale = 'true';
    }

    // Вызов единого централизованного менеджера словарей
    loadExternalDictionaries(query);

    // No connection: skip a doomed request to dpdict.net (and seven doomed iframes) and answer from
    // the offline mini-dictionary straight away.
    if (navigator.onLine === false) {
        const shown = await renderOffline(query, resultsContainer, summaryContainer);
        if (!shown && resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="offline-dpd-note">${window.isRu
                    ? 'Нет сети, офлайн-словарь не скачан — скачать при подключении к сети'
                    : 'No network, the offline dictionary is not downloaded — download it once online'}</div>
            `;
            resultsContainer.dataset.stale = 'false';
        }
        clearExternalSlots();
        return;
    }

    try {
        const currentLang = window.isRu ? 'ru' : 'en';
        const data = await fetchFromBackend(query, currentLang);

        markDpdOffline(false);
        if (resultsContainer) {
            const rawHtml = data.dpd_html || '<div class="message">Ничего не найдено</div>';
            resultsContainer.innerHTML = typeof wrapApostrophesInHTML === 'function'
                ? wrapApostrophesInHTML(rawHtml)
                : rawHtml;
            resultsContainer.dataset.stale = 'false';
        }

        if (summaryContainer && data.summary_html) {
            summaryContainer.innerHTML = data.summary_html;
        }

        const togglesToUpdate = [
            'summary-toggle',
            'grammar-toggle',
            'example-toggle',
            'sandhi-toggle'
            ];
        
        togglesToUpdate.forEach(toggleId => {
            const toggleElement = document.getElementById(toggleId);
            if (toggleElement) {
                const event = new Event('change', { bubbles: true });
                toggleElement.dispatchEvent(event);
            }
        });

        // Надежный маркер успешного ответа — наличие блока с кратким значением или кнопок
        const firstHeading = resultsContainer ? resultsContainer.querySelector('h3.dpd') : null;
        const hasRealEntry = resultsContainer ? resultsContainer.querySelector('.dpd.summary, .button-box') !== null : false;
        
        const tripitakaSlot = document.getElementById('ext-slot-tripitaka');
        const gandhariSlot = document.getElementById('ext-slot-gandhari');
        const ptsSlot = document.getElementById('ext-slot-pts');

        if (firstHeading && hasRealEntry) {
            // Очищаем запрос для сторонних словарей от цифр, слова Root и символов корня
            let normalizedQuery = firstHeading.textContent.replace(/\s+\d+(\.\d+)*$/, '').trim();
            normalizedQuery = normalizedQuery.replace(/root:?/gi, '').replace(/[√✓]/g, '').trim();
            
            appendTripitaka(normalizedQuery);
            appendGandhari(normalizedQuery);
            appendPts(normalizedQuery);
            appendBuddhadust(normalizedQuery);
            appendWisdomLib(normalizedQuery);
            
            // Синхронный вызов поиска санскрита
            runSanskritSearch();

            // If opened via a #ext-slot-<code> share link, expand/scroll to that dict.
            if (location.hash) setTimeout(focusDictFromHash, 60);
        } else {
            clearExternalSlots();
        }

    } catch (error) {
        // A failed DPD request is most often no connection: answer from the offline mini-dictionary
        // if it is downloaded, and only otherwise show the error (bilingual now — it was Russian
        // even on the English page).
        const shown = await renderOffline(query, resultsContainer, summaryContainer);
        if (!shown && resultsContainer) {
            // The offline dictionary would have answered this — say so, the reader has no other
            // way to learn it exists.
            resultsContainer.innerHTML = `
                <div style="color: #c08552; padding: 20px; text-align: center;">
                    ${window.isRu
                        ? `Ошибка загрузки словаря: ${error.message}.<br>Проверьте соединение. Офлайн-словарь можно скачать при подключении к сети.`
                        : `Could not load the dictionary: ${error.message}.<br>Check the connection. The offline dictionary can be downloaded once you are online.`}
                </div>
            `;
        }
        clearExternalSlots();
    }
}

// Инициализация ссылок при загрузке
//  updateLink('fdg-link', window.location.href.includes('/ru') ? 'https://dhamma.gift/ru/?p=-kn' : 'https://dhamma.gift?p=-kn');
// updateLink('dpd-link', window.location.href.includes('/ru') ? 'https://ru.dpdict.net' : 'https://dpdict.net');

//и обновление при клике
document.addEventListener('click', (e) => {
  const dg = e.target.closest('.dg-link');
  const dpd = e.target.closest('.dpd-link');

  if (dg) {
    updateLink(
      dg,
      window.location.pathname.startsWith('/ru')
        ? 'https://f.dhamma.gift/ru/?p=-kn'
        : 'https://dhamma.gift?p=-kn'
    );
    return;
  }

  if (dpd) {
    updateLink(
      dpd,
      window.isRu
        ? 'https://ru.dpdict.net'
        : 'https://dpdict.net'
    );
  }
});

//ссылки в футере конец

// Функции переключения с сохранением состояния
function toggleDesktopHistoryBtn() {
    const historyPane = document.getElementById('history-pane');
    if (historyPane) {
        const isHidden = historyPane.classList.toggle('desktop-hidden');
        localStorage.setItem('desktopHistoryHidden', isHidden);
    }
}

function toggleDesktopSettingsBtn() {
    const settingsPane = document.querySelector('.settings-pane');
    if (settingsPane) {
        const isHidden = settingsPane.classList.toggle('desktop-hidden');
        localStorage.setItem('desktopSettingsHidden', isHidden);
    }
}

// Восстановление состояния при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    const historyHidden = localStorage.getItem('desktopHistoryHidden');
    const settingsHidden = localStorage.getItem('desktopSettingsHidden');
    
    // Если в памяти записано 'true', скрываем панель
    if (historyHidden === 'true') {
        const historyPane = document.getElementById('history-pane');
        if (historyPane) historyPane.classList.add('desktop-hidden');
    }
    
    if (settingsHidden === 'true') {
        const settingsPane = document.querySelector('.settings-pane');
        if (settingsPane) settingsPane.classList.add('desktop-hidden');
    }
});


function toggleSettings() {
  const settingsContent = document.getElementById('settings-content');
  
  // Проверяем, является ли устройство мобильным (ширина экрана меньше 769px)
  if (window.innerWidth < 769) {
    // Переключаем видимость панели
    if (settingsContent.style.display === 'none' || !settingsContent.style.display) {
      settingsContent.style.display = 'block';
    } else {
      settingsContent.style.display = 'none';
    }
  }
}


function toggleHistory() {
  const historyContent = document.getElementById('history-content');
  
  // Проверяем, является ли устройство мобильным (ширина экрана меньше 769px)
  if (window.innerWidth < 769) {
    // Переключаем видимость панели
    if (historyContent.style.display === 'none' || !historyContent.style.display) {
      historyContent.style.display = 'block';
    } else {
      historyContent.style.display = 'none';
    }
  }
}

// Переменная для хранения ширины окна
let lastWidth = window.innerWidth;

window.addEventListener('resize', function() {
  const currentWidth = window.innerWidth;
  const settingsContent = document.getElementById('settings-content');
  const historyContent = document.getElementById('history-content');

  // Если ширина НЕ изменилась (например, изменилась только высота из-за скролла), ничего не делаем
  if (currentWidth === lastWidth) return;
  
  // Обновляем значение ширины для следующей проверки
  lastWidth = currentWidth;

  // Логика переключения отображения только при реальном изменении ширины (поворот экрана или ресайз окна)
  if (currentWidth >= 769) {
    if (settingsContent) settingsContent.style.display = 'block';
    if (historyContent) historyContent.style.display = 'block';
  } else {
    if (settingsContent) settingsContent.style.display = 'none';
    if (historyContent) historyContent.style.display = 'none';
  }
});

function setOneButtonToggleDefault() {
    const toggleId = "one-button-toggle";
    const savedState = localStorage.getItem(toggleId);
    
    if (savedState === null) {
        const toggleElement = document.getElementById(toggleId);
        if (toggleElement) {
            toggleElement.checked = true;
            // Опционально: сохраняем в localStorage, чтобы при следующей загрузке
            // поведение было согласованным
            localStorage.setItem(toggleId, 'true');
        }
    }
}



document.addEventListener('DOMContentLoaded', function() {
   
setOneButtonToggleDefault();

    const button = document.getElementById('search-button');
    if (!button) return;

    const originalHTML = button.innerHTML; // Сохраняем исходное содержимое
    const icon = document.createElement('img');
    icon.src = 'static/magnifying-glass.svg';
    icon.alt = 'Search';
    icon.style.cssText = `
        width: 16px !important;
        height: 16px !important;
        vertical-align: middle;
    `;

// Инициализация - устанавливаем начальное значение из URL
  const urlParams = getUrlParams();
  searchBoxForFooter.value = urlParams.get('q') || '';


/*
// Обнуляем существующую функцию changeLanguage
if (typeof changeLanguage === 'function') {
  changeLanguage = function() {}; // Заменяем на пустую функцию
}
*/ 

const tabsToggle = document.getElementById("tabs-toggle");
const tabContainer = document.getElementById("tab-container");

// Проверяем, существуют ли элементы
if (!tabsToggle || !tabContainer) {
    return;
}


// Функция для обновления видимости табов
function updateTabVisibility() {
    const tabsHidden = localStorage.getItem("tabsHidden");

    // Если состояние "true" — скрываем. 
    // Если "false" или null (еще не задано) — показываем по умолчанию.
    if (tabsHidden === "true") {
        tabContainer.style.display = 'none';     // Скрываем табы
        tabsToggle.checked = false;              // Переключатель ВЫКЛЮЧЕН
    } else {
        tabContainer.style.display = 'flex';     // Показываем табы
        tabsToggle.checked = true;               // Переключатель ВКЛЮЧЁН (show)
    }
}

// Применяем начальное состояние
updateTabVisibility();

// Обработчик изменения переключателя
tabsToggle.addEventListener("change", function () {
    const isShown = this.checked;

    if (isShown) {
        tabContainer.style.display = 'flex';          // show
        localStorage.setItem("tabsHidden", "false");
    } else {
        tabContainer.style.display = 'none';          // hide
        localStorage.setItem("tabsHidden", "true");
    }
});

//PWA installation
let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e; // Сохраняем событие для будущей установки
  });

const installLink = document.getElementById('installLink');

if (installLink) {
  document.getElementById('installLink').addEventListener('click', async (e) => {
    e.preventDefault();
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response: ${outcome}`);
      deferredPrompt = null;
    } 
  });
}

});


 function showSpinner() {
    const currentPath = window.location.pathname;
    const isRootPath = currentPath === '/' || currentPath === '/ru/' || currentPath === '/ru';
    
    if (isRootPath) {
        // Создаем полупрозрачный спиннер
        dpdResults.insertAdjacentHTML('beforeend', `
            <div class="spinner-container transparent-spinner">
                <img src="static/circle-notch.svg" class="loading-spinner">
            </div>
        `);
        //<div class="loading-text">${language === 'en' ? "Loading..." : "Загрузка..."}</div>
    }
}



// tab replacement woth links 
  // 1. Define Helper function to determine Base URL
  function getBaseUrl() {
    return window.isRu ? 'https://ru.dpdict.net' : 'https://dpdict.net';
  }

  // 2. Define the function that updates the links
  function updateExternalLinks() {
    const searchBox = document.getElementById('search-box');
    const bdLink = document.getElementById('bold-def-link');
    const trLink = document.getElementById('translations-link');
    
    // Get the value directly from the input box, not just the URL
    const q = searchBox.value.trim();
    const base = getBaseUrl();

    if (q) {
      const encoded = encodeURIComponent(q);

      // Update Bold Definitions Link
      bdLink.href = `${base}/?tab=bd&q1=${encoded}&q2=&option=regex`;

      // Update Translations Link
      trLink.href = `${base}/?tab=tt&q=${encoded}&book=all`;
    } else {
      // Fallback links if search is empty
      bdLink.href = `${base}/?tab=bd`;
      trLink.href = `${base}/?tab=tt`;
    }
  }

  // 3. Attach Event Listeners
  const searchInput = document.getElementById('search-box');
  
  // Update links whenever the user types
  searchInput.addEventListener('input', updateExternalLinks);
  
  // Update links if the user pastes text
  searchInput.addEventListener('change', updateExternalLinks);

  // 4. Run once on page load to handle any pre-filled values (e.g. from {{ search }})
  document.addEventListener('DOMContentLoaded', updateExternalLinks);


  
document.addEventListener('click', function(event) {
    const pane = event.target.closest('#dpd-pane');
    if (!pane) return;

    let suttaCode = '';
    let sParam = '';
    // Список книг: включено iti, поддержка сложных индексов типа thag1.9
    const regex = /^(mn|dn|sn|an|dhp|snp|ud|iti|thag|thig)\s?(\d+([.\d-]+)?)$/i;

    const suttaElement = event.target.closest('.sutta');
    
    if (suttaElement) {
        // Логика для специальных блоков .sutta
        const match = suttaElement.innerText.match(/(mn|dn|sn|an|dhp|snp|ud|iti|vv|pv|thag|thig)\s?\d+([.\d-]+)?/i);
        if (match) suttaCode = match[0];
    } else {
        // Логика для обычного текста: точное слово под курсором
        let wordUnderCursor = "";
        
        if (document.caretRangeFromPoint) {
            const range = document.caretRangeFromPoint(event.clientX, event.clientY);
            if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
                const text = range.startContainer.textContent;
                const offset = range.startOffset;
                
                const start = text.lastIndexOf(' ', offset) + 1;
                let end = text.indexOf(' ', offset);
                if (end === -1) end = text.length;
                
                // Очистка от знаков препинания вокруг индекса
                wordUnderCursor = text.substring(start, end)
                    .replace(/[()\[\];,]/g, "")
                    .replace(/\.$/, "")
                    .trim();
            }
        }
        
        const match = wordUnderCursor.match(regex);
        if (match) suttaCode = match[0];
    }

    if (!suttaCode) return;

    suttaCode = suttaCode.toLowerCase().replace(/\s+/g, '');

    // ЛОГИКА S-ПАРАМЕТРА: только если клик внутри примера
    const exampleDiv = event.target.closest('[name="example-div"]');
    if (exampleDiv) {
        const boldElement = exampleDiv.querySelector('b');
        if (boldElement) {
            sParam = boldElement.textContent.trim()
                .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
                .replace(/ṃ/g, "ṁ") //
                .replace(/'/g, "");
        }
    }

    // Формирование URL с учетом языка
    const baseUrl = window.isRu ? 'https://dhamma.gift/ru/' : 'https://dhamma.gift/';
    
    // Если sParam пустой (не из примера), он не добавится в URL
    let finalUrl = `${baseUrl}?q=${suttaCode}`;
    if (sParam) {
        finalUrl += `&s=${encodeURIComponent(sParam)}`;
    }

    window.location.href = finalUrl;
});



// Используем анонимную функцию для изоляции области видимости
(function() {
    // Проверяем наличие необходимых элементов, чтобы не вызвать ошибку
    const hp = document.getElementById('history-pane') || (typeof historyPane !== 'undefined' ? historyPane : null);
    const sb = document.getElementById('search-box') || (typeof searchBox !== 'undefined' ? searchBox : null);

    if (hp && sb) {
        hp.addEventListener("click", function(event) {
            let target = event.target;
            // Проверяем, что кликнули именно по элементу списка (слову в истории)
            if (target.tagName.toLowerCase() === 'li') {
                const text = target.textContent.trim();
                if (text !== "") {
                    sb.value = text;
                    // handleFormSubmit должна быть глобально доступна из предыдущих файлов
                    if (typeof handleFormSubmit === 'function') {
                        handleFormSubmit(); 
                    }
                }
            }
        });
    }
})();

// Функция для обновления заголовка вкладки
function updateDocumentTitle(query) {
  const baseTitle = "Dict.Dhamma.Gift";
  
  if (query && query.trim() !== "") {
    document.title = query.trim() + " — Dict.DG";
  } else {
    document.title = baseTitle;
  }
}

// Отдельный слушатель для инициализации заголовка страницы
document.addEventListener('DOMContentLoaded', function() {
  // 1. Проверяем URL на наличие параметра q при загрузке
  const urlParams = getUrlParams();
  const initialQuery = urlParams.get('q');
  
  if (initialQuery) {
    updateDocumentTitle(initialQuery);
  }

  // 2. Вешаем обработчик на инпут для изменения на лету
  const searchBoxInput = document.getElementById('search-box');
  if (searchBoxInput) {
    searchBoxInput.addEventListener('input', function(event) {
      updateDocumentTitle(event.target.value);
    });
  }
});

// extra.js — Чистый скрипт для вашей HTML разметки (Блок Санскрита)

let draggedDict = null; 
let lastSanskritQuery = '';

document.addEventListener("DOMContentLoaded", () => {
    // --- Логика перетаскивания строго за ползунок ---
    
    // Включаем перетаскивание при нажатии на ползунок
    document.addEventListener('mousedown', (e) => {
        const handle = e.target.closest('.dict-drag-handle');
        if (handle) {
            const wrapper = handle.closest('.sanskrit-dict-wrapper');
            if (wrapper) wrapper.setAttribute('draggable', 'true');
        }
    });

    document.addEventListener('touchstart', (e) => {
        const handle = e.target.closest('.dict-drag-handle');
        if (handle) {
            const wrapper = handle.closest('.sanskrit-dict-wrapper');
            if (wrapper) wrapper.setAttribute('draggable', 'true');
        }
    }, { passive: true });

    // Отключаем перетаскивание при отпускании, чтобы снова работал текст
    const removeDraggable = () => {
        document.querySelectorAll('.sanskrit-dict-wrapper').forEach(w => w.removeAttribute('draggable'));
    };
    document.addEventListener('mouseup', removeDraggable);
    document.addEventListener('touchend', removeDraggable);

    document.addEventListener('dragstart', (e) => {
        const wrapper = e.target.closest('.sanskrit-dict-wrapper');
        if (wrapper && wrapper.getAttribute('draggable') === 'true') {
            draggedDict = wrapper;
            e.dataTransfer.effectAllowed = 'move';
            const header = wrapper.querySelector('.sanskrit-dict-header');
            const label = header ? (header.querySelector('.dict-icon + *')?.textContent?.trim() || header.textContent?.trim()?.slice(0, 30)) : '...';
            const ghost = buildDragGhost('☰ ' + label);
            e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
            setTimeout(() => { ghost.remove(); wrapper.style.opacity = '0.4'; }, 0);
            return;
        }
        // Не блокируем ext-slot drag
        const extSlot = e.target.closest('[id^="ext-slot-"]');
        if (!extSlot || extSlot.getAttribute('draggable') !== 'true') {
            e.preventDefault();
        }
    });

    document.addEventListener('dragover', (e) => {
        if (!draggedDict) return;
        e.preventDefault(); 
        const overWrapper = e.target.closest('.sanskrit-dict-wrapper');
        
        if (overWrapper && overWrapper !== draggedDict) {
            const parent = overWrapper.parentNode;
            const rect = overWrapper.getBoundingClientRect();
            const insertAfter = (e.clientY - rect.top) > (rect.height / 2);
            
            if (insertAfter) {
                parent.insertBefore(draggedDict, overWrapper.nextSibling);
            } else {
                parent.insertBefore(draggedDict, overWrapper);
            }
        }
    });

    document.addEventListener('dragend', (e) => {
        if (draggedDict) {
            draggedDict.style.opacity = '1';
            draggedDict.removeAttribute('draggable');
            const parent = draggedDict.parentNode;
            draggedDict = null;
            if (parent) saveDictOrder(parent);
        }
        removeDraggable();
    });
});

document.addEventListener('click', (e) => {
    const moveBtn = e.target.closest('.dict-move-up, .dict-move-down');
    if (moveBtn) {
        e.stopPropagation(); 
        const wrapper = e.target.closest('.sanskrit-dict-wrapper');
        const parent = wrapper.parentNode;
        const isUp = moveBtn.classList.contains('dict-move-up');

        if (isUp && wrapper.previousElementSibling && wrapper.previousElementSibling.classList.contains('sanskrit-dict-wrapper')) {
            parent.insertBefore(wrapper, wrapper.previousElementSibling);
        } else if (!isUp && wrapper.nextElementSibling && wrapper.nextElementSibling.classList.contains('sanskrit-dict-wrapper')) {
            parent.insertBefore(wrapper.nextElementSibling, wrapper);
        }
        
        saveDictOrder(parent);
        return;
    }

    const dictHeader = e.target.closest('.sanskrit-dict-header');
    if (dictHeader) {
        const code = dictHeader.dataset.dictcode;
        const content = document.getElementById(`sanskrit-content-${code}`);
        const icon = dictHeader.querySelector('.dict-icon');
        
        if (content && icon) {
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            icon.textContent = isHidden ? '▼' : '▶';
            
            let states = JSON.parse(localStorage.getItem('sanskritDictStates') || '{}');
            states[code] = !isHidden; 
            localStorage.setItem('sanskritDictStates', JSON.stringify(states));
        }
        return;
    }
});


function saveDictOrder(parentElement) {
    const wrappers = parentElement.querySelectorAll('.sanskrit-dict-wrapper');
    const newOrder = Array.from(wrappers).map(w => w.dataset.dictcode);
    let saved = JSON.parse(localStorage.getItem('sanskritDictOrder') || '[]');
    const updatedOrder = [...new Set([...newOrder, ...saved])];
    localStorage.setItem('sanskritDictOrder', JSON.stringify(updatedOrder));
}

function runSanskritSearch() {
    const extStates = JSON.parse(localStorage.getItem('extDictStates') || '{}');
    if (extStates['sanskrit'] === true) return;

    const searchInput = document.getElementById('search-box');
    const query = searchInput ? searchInput.value.trim() : '';

    if (!query) {
        lastSanskritQuery = '';
        const container = document.getElementById('sanskrit-results');
        if (container) container.innerHTML = '';
        return;
    }

    const fallbackWord = getDpdSanskritFallback();
    const searchWord = (fallbackWord && fallbackWord.toLowerCase() !== query.toLowerCase()) ? fallbackWord : query;
    const isFallback = (searchWord !== query);

    if (searchWord !== lastSanskritQuery) {
        lastSanskritQuery = searchWord;
        fetchSanskrit(searchWord, isFallback, query);
    }
}

function highlightQuery(html, query) {
    if (!query) return html;
    
    const div = document.createElement('div');
    div.innerHTML = html;
    
    const SEP = '[\\-\\.\\–\\—\\―\\~\\s]*';
    const chars = query.split('').map(c =>
        /[-–—―~]/.test(c) ? '[\\-–—―~]+' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const regex = new RegExp(`(${chars.join(SEP)})`, 'gi');
    
    function traverse(node) {
        if (node.nodeType === 3) {
            const val = node.nodeValue;
            if (regex.test(val)) {
                const span = document.createElement('span');
                span.innerHTML = val.replace(regex, '<b style="color: #d35400;">$1</b>');
                node.parentNode.replaceChild(span, node);
            }
        } else if (node.nodeType === 1) {
            if (node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE') {
                Array.from(node.childNodes).forEach(traverse);
            }
        }
    }
    
    Array.from(div.childNodes).forEach(traverse);
    return div.innerHTML;
}


function getDpdSanskritFallback() {
    const dpdResults = document.getElementById('dpd-results');
    if (!dpdResults) return null;

    let sanskritWord = null;
    let sanskritRoot = null;

    const rows = dpdResults.querySelectorAll('tr');
    
    for (let row of rows) {
        const th = row.querySelector('th');
        const td = row.querySelector('td');
        if (!th || !td) continue;

        const headerText = th.textContent.toLowerCase().replace(/[:\.]/g, '').trim();
        
        // Читаем текст (даже из скрытых вкладок)
        let tdText = td.textContent || '';
        tdText = tdText.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').trim();

        const words = tdText.split(/[\s,;+\/\-]+/);
        let firstValidWord = null;

        for (let word of words) {
            // Оставляем только латиницу и индийскую диакритику
            const cleanWord = word.replace(/[^a-zA-ZāīūñṅṭḍṇṃṁḷśṣḥṛṝḷḹĀĪŪÑṄṬḌṆṂṀḶŚṢḤṚṜḶḸ]/g, '');
            if (cleanWord.length > 0) {
                firstValidWord = cleanWord;
                break;
            }
        }

        if (!firstValidWord) continue;

        if (headerText === 'sanskrit' || headerText === 'санскрит') {
            sanskritWord = firstValidWord;
        } else if (headerText === 'sanskrit root' || headerText === 'корень санскр') {
            sanskritRoot = firstValidWord;
        }
    }

    if (sanskritWord) return sanskritWord;
    if (sanskritRoot) return sanskritRoot;

    return null;
}

async function fetchSanskrit(query, isFallback = false, originalQuery = '') {
    const slot = document.getElementById('ext-slot-sanskrit');

    if (!slot) return;

    const extStates = JSON.parse(localStorage.getItem('extDictStates') || '{}');
    if (extStates['sanskrit'] === true) return;

    slot.style.display = 'block';
    slot.style.marginBottom = '15px';

    let container = document.getElementById('sanskrit-results');
    if (!container) {
        container = document.createElement('div');
        container.id = 'sanskrit-results';
        let contentDiv = slot.querySelector('.ext-dict-content');
        if (!contentDiv) {
            contentDiv = document.createElement('div');
            contentDiv.className = 'ext-dict-content';
            slot.appendChild(contentDiv);
        }
        contentDiv.appendChild(container);
    }

    const isRu = window.isRu;
    let fallbackText = '';
    if (isFallback) {
        fallbackText = ` <span style="font-size: 0.85em; color: #999;">(${isRu ? 'поиск по' : 'searching:'} <b>${query}</b>)</span>`;
    }
    
    container.innerHTML = `<div style="color: #666; padding: 5px;">${getUiText('loading')}${fallbackText}</div>`;

    try {
        const cacheKey = query.trim().toLowerCase();
        let data;

        if (sanskritApiCache.has(cacheKey)) {
            data = sanskritApiCache.get(cacheKey);
        } else {
            const url = `https://www.sanskrit-lexicon.uni-koeln.de/scans/awork/apidev/api1/salt_multidict.php?key=${encodeURIComponent(query)}&input=roman&output=roman`;
            const response = await fetch(url);

            if (!response.ok) {
                const msgError = isRu
                    ? 'Произошла ошибка при обращении к словарю.'
                    : 'An error occurred while accessing the dictionary.';
                const retryLabel = isRu ? 'Обновить' : 'Retry';
                container.innerHTML = `
                <div style="color: #c08552; padding: 10px; background: rgba(192, 133, 82, 0.1); border-radius: 5px; display: flex; align-items: center; gap: 8px;">
                    <span>⚠️ ${msgError} <span style="color: #999; font-size: 0.9em;">(HTTP ${response.status})</span></span>
                    <button type="button" class="sanskrit-retry-btn" title="${retryLabel}" style="border: 0; background: none; color: inherit; cursor: pointer; padding: 2px; line-height: 1; flex: none;"><i class="gi i-reset"></i></button>
                </div>`;
                container.querySelector('.sanskrit-retry-btn').addEventListener('click', () => fetchSanskrit(query, isFallback, originalQuery));
                return;
            }

            const text = await response.text();
            data = text ? JSON.parse(text) : { dicts: {} };
            if (sanskritApiCache.size >= SANSKRIT_CACHE_MAX) sanskritApiCache.delete(sanskritApiCache.keys().next().value);
            sanskritApiCache.set(cacheKey, data);
        }

        let htmlContent = '';
        let hasResults = false;

        const dictStates = JSON.parse(localStorage.getItem('sanskritDictStates') || '{}');

        if (data.dicts && Object.keys(data.dicts).length > 0) {
            const availableCodes = Object.keys(data.dicts);
            let savedOrder = JSON.parse(localStorage.getItem('sanskritDictOrder') || '[]');

            const nameCounts = {};
            availableCodes.forEach(code => {
                if (!data.dicts[code] || data.dicts[code].length === 0) return;
                const name = (data.dictmeta && data.dictmeta[code] && data.dictmeta[code].name) ? data.dictmeta[code].name : code.toUpperCase();
                nameCounts[name] = (nameCounts[name] || 0) + 1;
            });

            const prefixes = ['mw', 'shs', 'ap', 'md'];
            let defaultOrder = [];
            prefixes.forEach(prefix => {
                const matches = availableCodes.filter(code => code.startsWith(prefix)).sort();
                defaultOrder.push(...matches);
            });

            const remainingCodes = availableCodes.filter(code => !defaultOrder.includes(code)).sort();
            const baseOrder = [...defaultOrder, ...remainingCodes];

            let finalOrder = savedOrder.filter(code => availableCodes.includes(code));
            baseOrder.forEach(code => {
                if (!finalOrder.includes(code) && availableCodes.includes(code)) finalOrder.push(code);
            });

            finalOrder.forEach(dictCode => {
                const entries = data.dicts[dictCode];
                if (!entries || entries.length === 0) return;

                hasResults = true;
                let dictName = (data.dictmeta && data.dictmeta[dictCode] && data.dictmeta[dictCode].name)
                    ? data.dictmeta[dictCode].name
                    : dictCode.toUpperCase();

                if (nameCounts[dictName] > 1) {
                    const year = (data.dictmeta && data.dictmeta[dictCode] && data.dictmeta[dictCode].year) ? data.dictmeta[dictCode].year + ', ' : '';
                    dictName += ` <span style="font-weight: normal; font-size: 0.9em; color: #888;">(${year}${dictCode})</span>`;
                }

                const isCollapsed = dictStates[dictCode] === true;
                const icon = isCollapsed ? '▶' : '▼';
                const displayStyle = isCollapsed ? 'none' : 'block';

                htmlContent += `
                    <div class="sanskrit-dict-wrapper" data-dictcode="${dictCode}">
                        <div class="sanskrit-dict-header" data-dictcode="${dictCode}">
                            <div>
                                <span class="dict-icon">${icon}</span> ${dictName}:
                            </div>
                            <div class="sanskrit-dict-header-right" onclick="event.stopPropagation();">
                                <button class="dict-move-up" onclick="event.stopPropagation(); moveSanskritDict(this, true);" title="Up">↑</button>
                                <button class="dict-move-down" onclick="event.stopPropagation(); moveSanskritDict(this, false);" title="Down">↓</button>
                                <span class="dict-drag-handle" title="Drag to reorder">☰</span>
                            </div>
                        </div>
                        <div class="sanskrit-dict-content" id="sanskrit-content-${dictCode}" style="display: ${displayStyle};">`;

                entries.forEach(entry => {
                    if (entry.csl && entry.csl.html) {
                        const highlightedHtml = highlightQuery(entry.csl.html, query);
                        htmlContent += `<div class="sanskrit-dict-entry">${highlightedHtml}</div>`;
                    }
                });

                htmlContent += `</div></div>`;
            });
        }

        if (!hasResults) {
            const msgEmpty = isRu
                ? `Санскритские параллели для «${originalQuery || query}» не найдены.`
                : `No Sanskrit parallels found for "${originalQuery || query}".`;
            container.innerHTML = `<div style="opacity: 0.7;">${msgEmpty}</div>`;
        } else {
            if (isFallback) {
                 htmlContent = `<div style="margin-bottom: 8px; font-size: 0.9em; color: #666;">${isRu ? 'Найдено по слову' : 'Found for'}: <b>${query}</b></div>` + htmlContent;
            }
            container.innerHTML = htmlContent;
        }

    } catch (error) {
        console.error("Sanskrit error:", error);
        const msgNetworkError = isRu
            ? 'Не удалось загрузить данные санскрита из-за ошибки сети.'
            : 'Failed to load Sanskrit data due to a network error.';
        container.innerHTML = `
        <div style="color: #c08552; padding: 10px; background: rgba(192, 133, 82, 0.1); border-radius: 5px;">
            ⚠️ ${msgNetworkError} <span style="color: #999; font-size: 0.9em;">(${error.message})</span>
        </div>`;
    }
}

// Отдельный обработчик для кнопки +/- внутри заголовка санскрита.
// Используется capture-фаза, чтобы клик по +/- не сворачивал весь блок санскрита.
document.addEventListener('click', function(e) {
    const toggleAllBtn = e.target.closest('#sanskrit-toggle-all');
    if (!toggleAllBtn) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    let states = JSON.parse(localStorage.getItem('sanskritDictStates') || '{}');
    const headers = document.querySelectorAll('.sanskrit-dict-header');

    let anyOpen = false;

    headers.forEach(h => {
        const code = h.dataset.dictcode;
        const content = document.getElementById(`sanskrit-content-${code}`);
        if (content && content.style.display !== 'none') {
            anyOpen = true;
        }
    });

    headers.forEach(h => {
        const code = h.dataset.dictcode;
        const content = document.getElementById(`sanskrit-content-${code}`);
        const icon = h.querySelector('.dict-icon');

        if (content && icon) {
            if (anyOpen) {
                content.style.display = 'none';
                icon.textContent = '▶';
                states[code] = true;
            } else {
                content.style.display = 'block';
                icon.textContent = '▼';
                states[code] = false;
            }
        }
    });

    localStorage.setItem('sanskritDictStates', JSON.stringify(states));
}, true);


const sanskritApiCache = new Map();
const SANSKRIT_CACHE_MAX = 200;

// ===== КЛИЕНТСКАЯ ЛОГИКА ПОИСКА (ЗАМЕНА MAIN.PY) =====

const ENDPOINTS = {
    en: { baseUrl: 'https://dpdict.net', searchPath: '/search_json' },
    ru: { baseUrl: 'https://ru.dpdict.net', searchPath: '/search_json' }
};

function cleanQueryParam(original) {
    let cleaned = original.replace(/https?:\/\/\S+/g, '');
    
    // Удаляем слово "Root:" или "Root", чтобы оно не улетало в словари
    cleaned = cleaned.replace(/root:?/gi, '');
    
    // Отсекаем всё до символа корня включительно
    const rootIndex = cleaned.indexOf('√');
    if (rootIndex !== -1) {
        cleaned = cleaned.substring(rootIndex + 1);
    }
    
    // Включаем знак корня и возможные галочки в список удаляемых символов
    cleaned = cleaned.replace(/["'()[\]·√✓]/g, '');
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.trim().toLowerCase();
    
    // Исправление неправильной раскладки для сутт (русские буквы + цифры)
    if (/[а-яё]/.test(cleaned) && /\d/.test(cleaned)) {
        const ruToEn = {
            'а': 'f', 'в': 'd', 'е': 't', 'к': 'r', 'м': 'v',
            'н': 'y', 'о': 'j', 'п': 'g', 'р': 'h', 'с': 'c',
            'т': 'n', 'у': 'e', 'х': '[', 'ъ': ']', 'ы': 's',
            'ь': 'm', 'э': "'", 'ё': '`', 'я': 'z', 'ж': ';',
            'з': 'p', 'и': 'b', 'й': 'q', 'л': 'k', 'д': 'l',
            'г': 'u', 'ф': 'a', 'ц': 'w', 'ч': 'x', 'ш': 'i',
            'щ': 'o', 'б': ',', 'ю': '.', ' ': ' '
        };
        let converted = '';
        for (let i = 0; i < cleaned.length; i++) {
            converted += ruToEn[cleaned[i]] || cleaned[i];
        }
        
        // Ограничиваем конвертацию только паттернами сутт
        if (/^(dn|mn|sn|an|dhp|snp|ud|iti|thag|thig|vv|pv)/.test(converted)) {
            cleaned = converted;
        }
    }
    
    // Нормализация пробелов и точек — только для реальных индексов текстов
    // (mn 1 1 -> mn1.1). Обычные слова с номером омонима DPD (напр. "samaya 1.1")
    // не должны склеиваться, иначе они перестают находиться в словаре.
    const idxAbbr = "mn|dn|sn|an|dhp|snp|ud|iti|thag|thig|vv|pv";
    cleaned = cleaned.replace(new RegExp(`\\b(${idxAbbr})\\s+(\\d+)\\s+(\\d+)\\b`, "g"), "$1$2.$3")
                     .replace(new RegExp(`\\b(${idxAbbr})(\\d+)\\s+(\\d+)\\b`, "g"), "$1$2.$3")
                     .replace(new RegExp(`\\b(${idxAbbr})\\s+(\\d+)\\.(\\d+)\\b`, "g"), "$1$2.$3")
                     .replace(new RegExp(`\\b(${idxAbbr})\\s+(\\d+)\\b`, "g"), "$1$2");

    return cleaned;
}

async function fetchFromBackend(query, currentLang, tryFallback = true) {
    let lang = currentLang;

    if (tryFallback && /[а-яА-ЯёЁ]/.test(query)) {
        lang = 'ru';
        tryFallback = false;
    }

    const config = ENDPOINTS[lang];
    const url = new URL(config.baseUrl + config.searchPath);
    url.searchParams.set('q', query);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();

    if (tryFallback && !data.dpd_html) {
        const fallbackLang = lang === 'en' ? 'ru' : 'en';
        const fallbackData = await fetchFromBackend(query, fallbackLang, false);
        if (fallbackData && fallbackData.dpd_html) {
            return fallbackData;
        }
    }
    return data;
}


document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('search-form');
    const searchBox = document.getElementById('search-box');

    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (searchBox && searchBox.value) {
                handleClientSearch(searchBox.value);
            }
        });
    }

    const urlParams = getUrlParams();
    const initialQuery = urlParams.get('q');
    if (initialQuery) {
        if (searchBox) searchBox.value = initialQuery;
        handleClientSearch(initialQuery);
    }
});

// ===== ПЕРЕХВАТ И ИСПРАВЛЕНИЕ ДВОЙНОГО КЛИКА ИЗ HOME.JS =====
document.addEventListener('DOMContentLoaded', () => {
    const dpdPane = document.getElementById("dpd-pane");
    const historyPane = document.getElementById("history-pane");

    // 1. Отписываемся от старых функций, если они существуют в глобальной области
    if (typeof processSelection === 'function') {
        if (dpdPane) dpdPane.removeEventListener("dblclick", processSelection);
        if (historyPane) historyPane.removeEventListener("dblclick", processSelection);
    }
    
    if (typeof handleTouchEnd === 'function') {
        if (dpdPane) dpdPane.removeEventListener("touchend", handleTouchEnd);
        if (historyPane) historyPane.removeEventListener("touchend", handleTouchEnd);
    }

    // Вспомогательная функция: получает слово под пальцем по координатам экрана
    function getWordAtPoint(x, y) {
        let word = "";
        if (document.caretRangeFromPoint) { // Webkit/Blink (Chrome, Android)
            const range = document.caretRangeFromPoint(x, y);
            if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
                const text = range.startContainer.textContent;
                const offset = range.startOffset;
                const start = text.lastIndexOf(' ', offset > 0 ? offset - 1 : 0);
                let end = text.indexOf(' ', offset);
                if (end === -1) end = text.length;
                word = text.substring(start + 1, end).trim();
            }
        } else if (document.caretPositionFromPoint) { // Firefox
            const pos = document.caretPositionFromPoint(x, y);
            if (pos && pos.offsetNode.nodeType === Node.TEXT_NODE) {
                const text = pos.offsetNode.textContent;
                const offset = pos.offset;
                const start = text.lastIndexOf(' ', offset > 0 ? offset - 1 : 0);
                let end = text.indexOf(' ', offset);
                if (end === -1) end = text.length;
                word = text.substring(start + 1, end).trim();
            }
        }
        return word;
    }

    // 2. Новая функция для обработки выделения (с поддержкой координат)
    function executeSelectionSearch(fallbackWord = "") {
        let selection = window.getSelection().toString().trim();
        
        // Если ОС не успела выделить текст, берем слово по координатам
        if (!selection && fallbackWord) {
            selection = fallbackWord;
        }
        
        // Очищаем от знаков препинания по краям, оставляя буквы, диакритику и корень
        selection = selection.replace(/^[^\p{L}\p{M}√]+|[^\p{L}\p{M}√]+$/gu, "");
        
        if (selection !== "") {
            const searchBox = document.getElementById('search-box');
            if (searchBox) searchBox.value = selection;
            
            if (typeof handleClientSearch === 'function') {
                handleClientSearch(selection);
            }
        }
    }

    // 3. Новый обработчик для двойного тапа на мобильных
    let tapTime = 0;
    function newHandleTouchEnd(event) {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - tapTime;

        if (tapLength < 300 && tapLength > 0) {
            event.preventDefault(); // Блокируем стандартный зум
            let wordFromTouch = "";
            if (event.changedTouches && event.changedTouches.length > 0) {
                const touch = event.changedTouches[0];
                wordFromTouch = getWordAtPoint(touch.clientX, touch.clientY);
            }
            executeSelectionSearch(wordFromTouch);
        }
        tapTime = currentTime;
    }

    // 4. Навешиваем новые правильные слушатели
    if (dpdPane) {
        dpdPane.addEventListener("dblclick", () => executeSelectionSearch());
        dpdPane.addEventListener("touchend", newHandleTouchEnd);
    }
    if (historyPane) {
        historyPane.addEventListener("dblclick", () => executeSelectionSearch());
        historyPane.addEventListener("touchend", newHandleTouchEnd);
    }

    // 5. Регистрируем глобальный handleFormSubmit для формы и автокомплита
    window.handleFormSubmit = function(event) {
        if (event) event.preventDefault();
        const searchBox = document.getElementById('search-box');
        if (searchBox) {
            searchBox.blur(); // Снимаем фокус
        }
        if (searchBox && searchBox.value) {
            handleClientSearch(searchBox.value);
        }
    };

    const formObj = document.getElementById("search-form");
    const btnObj = document.getElementById("search-button");
    if (formObj) formObj.addEventListener("submit", window.handleFormSubmit);
    if (btnObj) btnObj.addEventListener("click", window.handleFormSubmit);
});

// ======== КОНФИГУРАЦИЯ ВНЕШНИХ СЛОВАРЕЙ ========
// Порядок элементов в массиве определяет порядок отображения на странице.
const EXTERNAL_DICTS_ORDER = ['dpd', 'tripitaka', 'gandhari', 'pts', 'buddhadust', 'wisdomlib', 'sanskrit'];

// Создаёт слот для DPD, перенося #dpd-results и #summary-results внутрь
function createDpdSlot() {
    const dpdResults = document.getElementById('dpd-results');
    const summaryResults = document.getElementById('summary-results');

    const slot = document.createElement('div');
    slot.id = 'ext-slot-dpd';

    const headerObj = renderExtDictHeader('dpd', 'DPD', getBaseUrl());
    slot.innerHTML = headerObj.headerHtml;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'ext-dict-content';
    contentDiv.style.display = headerObj.displayStyle;

    if (summaryResults) contentDiv.appendChild(summaryResults);
    if (dpdResults) contentDiv.appendChild(dpdResults);

    slot.appendChild(contentDiv);
    return slot;
}

// Единый менеджер внешних словарей
function _initExtSlots(extContainer) {
    const extStates = JSON.parse(localStorage.getItem('extDictStates') || '{}');
    let statesChanged = false;
    for (const code of ['tripitaka', 'gandhari', 'pts', 'wisdomlib']) {
        if (!(code in extStates)) { extStates[code] = true; statesChanged = true; }
    }
    // Buddhadust should be collapsed by default
    if (!( 'buddhadust' in extStates )) { extStates['buddhadust'] = false; statesChanged = true; }
    if (statesChanged) localStorage.setItem('extDictStates', JSON.stringify(extStates));

    const savedSlotOrder = JSON.parse(localStorage.getItem('extDictsOrder') || '[]');
    let finalSlotOrder = savedSlotOrder.filter(d => EXTERNAL_DICTS_ORDER.includes(d));
    EXTERNAL_DICTS_ORDER.forEach(d => { if (!finalSlotOrder.includes(d)) finalSlotOrder.push(d); });

    finalSlotOrder.forEach(dictName => {
        if (dictName === 'dpd') {
            extContainer.appendChild(createDpdSlot());
        } else if (dictName === 'tripitaka') {
            extContainer.appendChild(_createIframeDictSlot('tripitaka', 'Sutta-Vinaya Definitions and Similies', 'https://tripitaka-mcp.com/read/embed/define', 'margin-bottom: 15px; margin-top: 15px;'));
        } else if (dictName === 'gandhari') {
            extContainer.appendChild(_createIframeDictSlot('gandhari', 'Gandhari Dictionary', 'https://gandhari.org/dictionary?section=dop', 'margin-bottom: 15px; margin-top: 15px;'));
        } else if (dictName === 'pts') {
            extContainer.appendChild(_createIframeDictSlot('pts', 'PTS Dictionary', 'https://dsal.uchicago.edu/cgi-bin/app/pali_query.py', 'margin-bottom: 15px;'));
        } else if (dictName === 'buddhadust') {
// TODO: Обновлять локальную копию статичного файла раз в месяц с https://buddhadust.net/backmatter/glossology/glossologytoc.htm
    // ДОБАВЛЕН БЛОК ДЛЯ BUDDHADUST
    const slot = document.createElement('div');
    slot.id = 'ext-slot-buddhadust';
    slot.style.cssText = 'margin-bottom: 15px;';

    // Используем локальную копию для избежания CORS проблем
    const headerObj = renderExtDictHeader('buddhadust', 'Buddhadust Glossology', 'https://buddhadust.net/backmatter/glossology/glossologytoc.htm');

    slot.innerHTML = headerObj.headerHtml;
    const contentDiv = document.createElement('div');
    contentDiv.className = 'ext-dict-content';
    // Force collapsed by default
    contentDiv.style.cssText = `max-height: 450px; overflow: auto; display: none;`;
    slot.appendChild(contentDiv);
    extContainer.appendChild(slot);

    // Set icon to collapsed state (▶)
    const icon = slot.querySelector('.ext-dict-toggle-icon');
    if (icon) {
        icon.textContent = '▶';
    }
}
 else if (dictName === 'wisdomlib') {
            extContainer.appendChild(_createIframeDictSlot('wisdomlib', 'Wisdom Library', 'https://www.wisdomlib.org/definition/', 'margin-bottom: 15px;'));
        } else if (dictName === 'sanskrit') {
            extContainer.appendChild(_createSanskritSlot());
        }
    });

}

function _createIframeDictSlot(dictCode, title, baseUrl, style) {
    const slot = document.createElement('div');
    slot.id = `ext-slot-${dictCode}`;
    slot.style.cssText = style;
    const headerObj = renderExtDictHeader(dictCode, title, baseUrl);
    slot.innerHTML = headerObj.headerHtml;
    const contentDiv = document.createElement('div');
    contentDiv.className = 'ext-dict-content';
    contentDiv.style.cssText = `max-height: 450px; overflow: auto; display: ${headerObj.displayStyle};`;
    slot.appendChild(contentDiv);
    return slot;
}

function _createSanskritSlot() {
    const slot = document.createElement('div');
    slot.id = 'ext-slot-sanskrit';
    const toggleAllBtn = `<button id="sanskrit-toggle-all" style="background:none; border:none; color:#999; font-size: 1.1em; font-weight:bold; cursor:pointer;" title="${window.isRu ? 'Свернуть/развернуть все словари' : 'Toggle all dictionaries'}">+/-</button>`;
    const headerObj = renderExtDictHeader('sanskrit', window.isRu ? 'Санскрит' : 'Sanskrit', 'https://www.sanskrit-lexicon.uni-koeln.de/', toggleAllBtn);
    slot.innerHTML = headerObj.headerHtml;
    const contentDiv = document.createElement('div');
    contentDiv.className = 'ext-dict-content';
    contentDiv.style.display = headerObj.displayStyle;
    const sanskritResults = document.createElement('div');
    sanskritResults.id = 'sanskrit-results';
    contentDiv.appendChild(sanskritResults);
    slot.appendChild(contentDiv);
    return slot;
}

function loadExternalDictionaries(query) {
    const dpdPane = document.getElementById('dpd-pane');
    if (!dpdPane) return;

    let extContainer = document.getElementById('external-dicts-container');
    if (!extContainer) {
        extContainer = document.createElement('div');
        extContainer.id = 'external-dicts-container';
        dpdPane.appendChild(extContainer);
        initExtSlotDragDrop(extContainer);
        _initExtSlots(extContainer);
    }

    // Keep DPD open link pointing at current query
    const dpdOpenLink = document.querySelector('#ext-slot-dpd .ext-dict-open-link');
    if (dpdOpenLink) {
        dpdOpenLink.href = query
            ? `${getBaseUrl()}/?q=${encodeURIComponent(query)}`
            : getBaseUrl();
        dpdOpenLink.style.visibility = query ? '' : 'hidden';
    }

    if (!query) {
        lastSanskritQuery = '';
        const sr = document.getElementById('sanskrit-results');
        if (sr) sr.innerHTML = '';
        return;
    }
}

function initExtSlotDragDrop(container) {
    let draggedSlot = null;

    container.addEventListener('mousedown', (e) => {
        const handle = e.target.closest('.ext-dict-drag-handle');
        if (handle) {
            const slot = handle.closest('[id^="ext-slot-"]');
            if (slot) slot.setAttribute('draggable', 'true');
        }
    });

    container.addEventListener('touchstart', (e) => {
        const handle = e.target.closest('.ext-dict-drag-handle');
        if (handle) {
            const slot = handle.closest('[id^="ext-slot-"]');
            if (slot) slot.setAttribute('draggable', 'true');
        }
    }, { passive: true });

    const removeSlotDraggable = () => {
        container.querySelectorAll('[id^="ext-slot-"]').forEach(s => s.removeAttribute('draggable'));
    };
    container.addEventListener('mouseup', removeSlotDraggable);
    container.addEventListener('touchend', removeSlotDraggable);

    container.addEventListener('dragstart', (e) => {
        const slot = e.target.closest('[id^="ext-slot-"]');
        if (slot && slot.getAttribute('draggable') === 'true') {
            draggedSlot = slot;
            e.dataTransfer.effectAllowed = 'move';
            const header = slot.querySelector('.ext-dict-header');
            const label = header ? (header.querySelector('span[style*="font-weight"]')?.textContent?.trim() || '...') : '...';
            const ghost = buildDragGhost('☰ ' + label);
            e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2);
            setTimeout(() => { ghost.remove(); slot.style.opacity = '0.4'; }, 0);
        }
        // Не блокируем — внутренний drag санскрита (.dict-drag-handle) пусть идёт дальше
    });

    container.addEventListener('dragover', (e) => {
        if (!draggedSlot) return;
        e.preventDefault();
        const overSlot = e.target.closest('[id^="ext-slot-"]');
        if (overSlot && overSlot !== draggedSlot) {
            const rect = overSlot.getBoundingClientRect();
            // Используем небольшой порог (60px ≈ высота заголовка), а не половину высоты блока
            const insertAfter = (e.clientY - rect.top) > Math.min(60, rect.height / 3);
            container.insertBefore(draggedSlot, insertAfter ? overSlot.nextSibling : overSlot);
        }
    });

    container.addEventListener('dragend', () => {
        if (draggedSlot) {
            draggedSlot.style.opacity = '1';
            draggedSlot.removeAttribute('draggable');
            const newOrder = Array.from(container.querySelectorAll('[id^="ext-slot-"]'))
                .map(s => s.id.replace('ext-slot-', ''));
            localStorage.setItem('extDictsOrder', JSON.stringify(newOrder));
            draggedSlot = null;
        }
        removeSlotDraggable();
    });
}
function appendIframeDict(dictCode, title, targetUrl, allowPopups = false, invertInDark = true) {
    const slot = document.getElementById(`ext-slot-${dictCode}`);
    if (!slot) return;

    const openLink = slot.querySelector('.ext-dict-open-link');
    if (openLink) openLink.href = targetUrl;

    const content = slot.querySelector('.ext-dict-content');
    if (!content) return;

    const iframeAttr = content.style.display === 'none' ? `data-src="${targetUrl}"` : `src="${targetUrl}"`;

    let sandboxAttr = "allow-scripts allow-same-origin";
    if (allowPopups) {
        sandboxAttr += " allow-popups allow-popups-to-escape-sandbox";
    }

    // The target site has no dark mode of its own: fake one by inverting the iframe
    // (skip it for embeds like tripitaka that already render their own dark theme).
    const invertClass = invertInDark ? ' class="dict-iframe-invert"' : '';

    content.innerHTML = `<iframe ${iframeAttr}${invertClass} style="width: 100%; height: 450px; border: 2px solid #1a8bdb; border-radius: 8px; background-color: #fff;" sandbox="${sandboxAttr}" title="${title}"></iframe>`;
}

function appendTripitaka(query) {
    const readPath = window.isRu ? '/r/' : '/read/';
    const linkBase = `https://dhamma.gift${readPath}?q={sutta_id}%23{segment_num}`;
    
    // Получаем текущую тему из настроек
    const currentTheme = localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
    
    // Передаем динамическую тему в URL
    appendIframeDict('tripitaka', 'Sutta-Vinaya Definitions and Similies', `https://tripitaka-mcp.com/read/embed/define?term=${encodeURIComponent(query)}&sources=an,dn,mn,sn,iti,ud,snp,dhp,vinaya&theme=${currentTheme}&link_base=${linkBase}`, true, false);
}

async function appendBuddhadust(query) {
    const dictId = 'buddhadust';
    const container = document.getElementById(`ext-slot-${dictId}`);
    if (!container) return;

    // Ищем область для контента внутри стандартной обертки слота
    const contentDiv = container.querySelector('.ext-dict-content') || container;
    contentDiv.innerHTML = '<div class="text-muted" style="padding: 15px;">Ищем в Buddhadust...</div>';

    try {
        // Используем локальную статическую копию TOC чтобы избежать CORS
        const targetUrl = 'static/buddhadust-glossology.htm';
        const res = await fetch(targetUrl);
        const html = await res.text();
        
        const doc = new DOMParser().parseFromString(html, 'text/html');
        
        // Нормализуем запрос пользователя
        const normalizedQuery = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        
        let exactLink = null;
        let matches = [];

        const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

        // Собираем ссылки из HTML
        doc.querySelectorAll("a").forEach(link => {
            const href = link.getAttribute("href");
            if (!href) return;

            // Для Buddhadust извлекаем текст термина из родительского элемента (текст перед [)
            const parentText = link.parentElement ? (link.parentElement.textContent || "") : "";
            const bracketIndex = parentText.indexOf("[");
            const label = (bracketIndex !== -1 ? parentText.substring(0, bracketIndex) : parentText).trim();

            // Записи вида "English gloss (PaliTerm1 PaliTerm2, PaliTerm3)": сравниваем запрос
            // с каждым отдельным термином, а не со всей строкой — иначе длинный английский
            // глосс перед скобкой не даёт найти короткий пали-термин внутри неё.
            const parenMatch = label.match(/^(.*?)\(([^)]*)\)\s*$/);
            const candidates = (parenMatch ? [parenMatch[1], ...parenMatch[2].split(/[,;]/)] : [label])
                .map(norm).filter(Boolean);

            if (candidates.includes(normalizedQuery)) {
                exactLink = href;
            } else if (candidates.some(c => c.includes(normalizedQuery))) {
                matches.push({ text: label, href: href });
            }
        });

        // Сценарий 1: Точное совпадение
        if (exactLink) {
            const fullUrl = `https://buddhadust.net/backmatter/glossology/${exactLink}`;
            _renderBuddhadustIframe(contentDiv, fullUrl, container);
        } 
        // Сценарий 2: Несколько вариантов
        else if (matches.length > 0) {
            // Рисуем список. По клику на текст - открываем в iframe, по клику на ↗️ - в новом окне
            let listHtml = matches.map(m => {
                const fullUrl = `https://buddhadust.net/backmatter/glossology/${m.href}`;
                return `<li style="margin-bottom: 10px; display: flex; align-items: center;">
                            <a href="javascript:void(0)" 
                               onclick="_renderBuddhadustIframe(this.closest('.ext-dict-content') || document.getElementById('ext-slot-buddhadust'), '${fullUrl}', this.closest('.dict-slot-container'))" 
                               style="text-decoration: none; border-bottom: 1px dashed #0066cc; color: #0066cc;">
                               ${m.text}
                            </a>
                            <a href="${fullUrl}" target="_blank" title="Открыть в новом окне" style="margin-left: 10px; text-decoration: none; font-size: 0.9em; opacity: 0.7;">
                                ↗️
                            </a>
                        </li>`;
            }).join('');
            
            contentDiv.innerHTML = `
                <div style="padding: 15px;">
                    <h5 style="margin-top: 0; margin-bottom: 15px;">Variants:</h5>
                    <ul style="list-style-type: none; padding-left: 0; margin: 0;">${listHtml}</ul>
                </div>`;
        } 
        // Сценарий 3: Ничего не найдено
        else {
            // Если пусто, можно скрыть слот целиком (раскомментировать строку ниже)
            // container.style.display = 'none'; 
            contentDiv.innerHTML = '<div class="text-muted" style="padding: 15px;">В Buddhadust совпадений не найдено.</div>';
        }

    } catch (e) {
        console.error("Ошибка при загрузке Buddhadust:", e);
        contentDiv.innerHTML = '<div class="text-danger" style="padding: 15px;">Ошибка загрузки словаря.</div>';
    }
}

// Вспомогательная функция для отрисовки iframe и обновления ссылки в шапке
window._renderBuddhadustIframe = function(contentNode, url, containerNode) {
    // Вставляем сам iframe
    contentNode.innerHTML = `<iframe src="${url}" class="dict-iframe-invert" style="width:100%; height:500px; border:none; display:block;"></iframe>`;
    
    // Динамически обновляем кнопку "открыть в новом окне" в шапке слота, 
    // чтобы она вела на ту же страницу, что сейчас открыта в iframe
    if (containerNode) {
        const extLinkBtn = containerNode.querySelector('.ext-link-btn'); // Замените класс на тот, что используется у вас в шапках
        if (extLinkBtn) {
            extLinkBtn.href = url;
        }
    }
};



function appendGandhari(query) {
    // Здесь флаг не передается, используется значение по умолчанию (false)
    appendIframeDict('gandhari', 'Gandhari Dictionary', `https://gandhari.org/dictionary?section=dop&search=${encodeURIComponent(query)}`);
}

function appendPts(query) {
    appendIframeDict('pts', 'PTS Dictionary', `https://dsal.uchicago.edu/cgi-bin/app/pali_query.py?matchtype=default&qs=${encodeURIComponent(query)}`);
}

function appendWisdomLib(query) {
    appendIframeDict('wisdomlib', 'Wisdom Library', `https://www.wisdomlib.org/definition/${encodeURIComponent(query)}`);
}

// Обработчик сворачивания целых блоков внешних словарей с сохранением состояния
document.addEventListener('click', (e) => {
    if (e.target.closest('.ext-dict-drag-handle')) return;

    const header = e.target.closest('.ext-dict-header');
    if (header) {
        const dictCode = header.dataset.dictcode;
        const content = header.parentNode.querySelector('.ext-dict-content');
        const icon = header.querySelector('.ext-dict-toggle-icon');

        if (content && icon) {
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            icon.textContent = isHidden ? '▼' : '▶';

            if (dictCode) {
                let states = JSON.parse(localStorage.getItem('extDictStates') || '{}');
                states[dictCode] = !isHidden;
                localStorage.setItem('extDictStates', JSON.stringify(states));
            }

            // Lazy load on expand
            if (isHidden) {
                content.querySelectorAll('iframe[data-src]').forEach(iframe => {
                    iframe.src = iframe.dataset.src;
                    iframe.removeAttribute('data-src');
                });
                if (dictCode === 'sanskrit') {
                    lastSanskritQuery = ''; // Resetting this forces runSanskritSearch to re-fetch if needed
                    if (typeof runSanskritSearch === 'function') runSanskritSearch();
                }
            }
        }
    }
});


// ======== ЛОКАЛИЗАЦИЯ И ТЕКСТЫ ========
const UI_TEXTS = {
    ru: {
        openInNewTab: 'Открыть ↗',
        sanskrit: 'Санскрит',
        loading: 'Загрузка словарей... <span style="filter: grayscale(100%); opacity: 0.8;">⏳</span>'
    },
    en: {
        openInNewTab: 'Open ↗',
        sanskrit: 'Sanskrit',
        loading: 'Loading dictionaries... <span style="filter: grayscale(100%); opacity: 0.8;">⏳</span>'
    }
};

function getUiText(key) {
    const lang = window.isRu ? 'ru' : 'en';
    return UI_TEXTS[lang][key] || UI_TEXTS.en[key] || key;
}

// Human-friendly hash <-> internal dict code (others: hash === code)
const DICT_HASH = { sanskrit: 'skr', wisdomlib: 'wisdom', tripitaka: 'definitions' };
const hashFromCode = (c) => DICT_HASH[c] || c;
const codeFromHash = (h) => {
    h = h.replace(/^ext-slot-/, ''); // still accept old #ext-slot-<code> links
    for (const c in DICT_HASH) if (DICT_HASH[c] === h) return c;
    return h;
};

// Copy a link that reopens this word with a specific dictionary expanded/focused.
function shareDict(code) {
    const q = (document.getElementById('search-box')?.value.trim()) ||
              new URLSearchParams(location.search).get('q') || '';
    const url = location.origin + location.pathname +
                (q ? '?q=' + encodeURIComponent(q) : '') + '#' + hashFromCode(code);
    navigator.clipboard?.writeText(url).catch(() => {});
    if (typeof showBubbleNotification === 'function')
        showBubbleNotification(window.isRu ? 'Ссылка скопирована' : 'Link copied');
}
window.shareDict = shareDict;

// On a #<dict> hash (e.g. #gandhari, #pts, #skr), expand that dictionary and scroll to it.
function focusDictFromHash() {
    const h = location.hash.slice(1);
    if (!h) return;
    const slot = document.getElementById('ext-slot-' + codeFromHash(h));
    if (!slot) return;
    const header = slot.querySelector('.ext-dict-header');
    const content = slot.querySelector('.ext-dict-content');
    if (header && content && content.style.display === 'none') header.click();
    document.querySelectorAll('.dict-focused').forEach((s) => s.classList.remove('dict-focused'));
    slot.classList.add('dict-focused');
    slot.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.focusDictFromHash = focusDictFromHash;
addEventListener('hashchange', focusDictFromHash);

// Универсальный генератор шапки для внешних словарей
function renderExtDictHeader(dictCode, title, targetUrl, extraRightHtml = '') {
    const linkHtml = `<a href="${targetUrl || '#'}" class="ext-dict-open-link" target="_blank"${targetUrl ? '' : ' style="visibility:hidden;"'} onclick="event.stopPropagation();" title="${getUiText('openInNewTab')}"><img src="static/open-link.svg" class="ext-dict-open-icon"></a>`;

    const states = JSON.parse(localStorage.getItem('extDictStates') || '{}');
    const isCollapsed = states[dictCode] === true;
    const icon = isCollapsed ? '▶' : '▼';
    const displayStyle = isCollapsed ? 'none' : 'block';

    const moveButtons = `
        <button class="ext-dict-move-up" onclick="event.stopPropagation(); moveExtSlot(this, true);" title="Move up">↑</button>
        <button class="ext-dict-move-down" onclick="event.stopPropagation(); moveExtSlot(this, false);" title="Move down">↓</button>`;

    const shareBtn = `<button class="ext-dict-share" onclick="event.stopPropagation(); shareDict('${dictCode}');" title="${window.isRu ? 'Ссылка на этот словарь' : 'Link to this dictionary'}"><i class="gi i-link"></i></button>`;

    return {
        headerHtml: `
            <div class="ext-dict-header" data-dictcode="${dictCode}">
                <div>
                    <span class="ext-dict-toggle-icon">${icon}</span>
                    <span class="ext-dict-title">${title}</span>
                </div>
                <div class="ext-dict-header-right" onclick="event.stopPropagation();">
                    ${extraRightHtml}
                    ${shareBtn}
                    ${linkHtml}
                    ${moveButtons}
                    <span class="ext-dict-drag-handle" title="Drag to reorder">☰</span>
                </div>
            </div>`,
        displayStyle: displayStyle
    };
}

function buildDragGhost(text) {
    const ghost = document.createElement('div');
    ghost.textContent = text.slice(0, 40);
    ghost.className = 'drag-ghost';
    document.body.appendChild(ghost);
    void ghost.offsetWidth; // force layout to get dimensions
    return ghost;
}

function swapSibling(el, isUp, siblingFilter) {
    const parent = el.parentNode;
    if (isUp) {
        const prev = el.previousElementSibling;
        if (prev && (!siblingFilter || siblingFilter(prev))) parent.insertBefore(el, prev);
    } else {
        const next = el.nextElementSibling;
        if (next && (!siblingFilter || siblingFilter(next))) parent.insertBefore(next, el);
    }
}

function moveExtSlot(btn, isUp) {
    const slot = btn.closest('[id^="ext-slot-"]');
    if (!slot) return;
    swapSibling(slot, isUp, null);
    const newOrder = Array.from(slot.parentNode.querySelectorAll('[id^="ext-slot-"]'))
        .map(s => s.id.replace('ext-slot-', ''));
    localStorage.setItem('extDictsOrder', JSON.stringify(newOrder));
}

function moveSanskritDict(btn, isUp) {
    const wrapper = btn.closest('.sanskrit-dict-wrapper');
    if (!wrapper) return;
    swapSibling(wrapper, isUp, el => el.classList.contains('sanskrit-dict-wrapper'));
    saveDictOrder(wrapper.parentNode);
}

// ======== HISTORY MANAGEMENT (moved from home.js) ========
function addToHistory(word) {
    let historyList = JSON.parse(localStorage.getItem("history-list")) || [];
    const index = historyList.indexOf(word);
    if (index !== -1) historyList.splice(index, 1);
    historyList.unshift(word);
    if (historyList.length > 50) historyList.pop();
    localStorage.setItem("history-list", JSON.stringify(historyList));

    // The word goes into the path (/kacchapa), not ?q=; nothing to push when it's already there.
    const newUrl = dictUrl(word);
    if (newUrl !== window.location.pathname + window.location.search) {
        window.history.pushState({ q: word }, '', newUrl);
    }
    toggleClearHistoryButton();
}

function populateHistoryBody() {
    const historyListPane = document.getElementById("history-list-pane");
    if (!historyListPane) return;
    let historyList = JSON.parse(localStorage.getItem("history-list")) || [];
    const ul = document.createElement("ul");
    ul.id = "history-list";
    historyList.forEach(item => {
        const li = document.createElement("li");
        li.textContent = item;
        ul.appendChild(li);
    });
    historyListPane.innerHTML = "";
    historyListPane.appendChild(ul);
}

function toggleClearHistoryButton() {
    const btn = document.getElementById("clear-history-button");
    if (!btn) return;
    const historyList = JSON.parse(localStorage.getItem("history-list")) || [];
    btn.style.display = historyList.length === 0 ? "none" : "inline-block";
}

// ======== THEME (moved from home.js) ========
function applySavedTheme() {
    const savedTheme = localStorage.getItem("theme");
    const themeToggle = document.getElementById("theme-toggle");
    if (savedTheme) {
        document.body.classList.remove("dark-mode", "light-mode");
        document.body.classList.add(savedTheme + "-mode");
        if (themeToggle) themeToggle.checked = savedTheme === "dark";
    }
}

// ======== INFLECTION TABLE HIGHLIGHT ========
document.addEventListener('click', function(e) {
    if (!e.target.closest('[data-target]')) return;
    setTimeout(highlightInflectionMatch, 0);
});

function normalizeNiggahita(str) {
    return str.replace(/ṁ/g, 'ṃ');
}

function highlightInflectionMatch() {
    const raw = (document.getElementById('search-box')?.value?.trim() ||
                 new URLSearchParams(window.location.search).get('q') || '');
    const query = normalizeNiggahita(raw.toLowerCase());
    if (!query) return;

    document.querySelectorAll('#dpd-results table.inflection').forEach(table => {
        if (table.closest('.content.hidden')) return;

        table.querySelectorAll('td').forEach(td => {
            if (td.dataset.origHtml !== undefined) {
                td.innerHTML = td.dataset.origHtml;
            } else {
                td.dataset.origHtml = td.innerHTML;
            }

            const parts = td.dataset.origHtml.split(/<br\s*\/?>/i);
            const newParts = parts.map(part => {
                const tmp = document.createElement('div');
                tmp.innerHTML = part;
                const text = normalizeNiggahita(tmp.textContent.trim().toLowerCase());
                return text === query
                    ? `<span class="inflection-word-match">${part}</span>`
                    : part;
            });

            td.innerHTML = newParts.join('<br>');
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    applySavedTheme();
    // Start screen lives in the template (#s-start); no startMessage injection.
    populateHistoryBody();
    toggleClearHistoryButton();

    const clearBtn = document.getElementById("clear-history-button");
    if (clearBtn) {
        clearBtn.addEventListener("click", function() {
            localStorage.removeItem("history-list");
            const list = document.getElementById("history-list");
            if (list) list.innerHTML = "";
            toggleClearHistoryButton();
        });
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const logoElements = document.querySelectorAll('.alogo');
    const searchBox = document.getElementById('search-box');
    let pressTimer;

    if (logoElements.length === 0) return;

    // "Pāḷi → En/Ru" next to the logo: left or right click switches the language
    // (the rest of the logo keeps click = home, long press / right click = language).
    document.querySelectorAll('.wm-lang').forEach(cap => {
        const switchLang = function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (typeof toggleLanguage === 'function') toggleLanguage();
        };
        cap.addEventListener('click', switchLang);
        cap.addEventListener('contextmenu', switchLang);
        ['mousedown', 'touchstart'].forEach(t => cap.addEventListener(t, e => e.stopPropagation(), { passive: true }));
    });

    logoElements.forEach(el => {
        // Обычный клик (ЛКМ / Короткий тап)
        el.addEventListener('click', function(e) {
            if (el.dataset.longpressed === 'true') {
                el.dataset.longpressed = 'false';
                e.preventDefault();
                return;
            }

            e.preventDefault();
            
            // Очищаем инпут
            if (searchBox) {
                searchBox.value = '';
            }

            // Переход на главную с учетом текущего языка (window.isRu, не путь — он
            // маскируется от /ru/ после загрузки, см. language IIFE в начале файла)
            const base = typeof getAppBase === 'function' ? getAppBase() : '/';
            const targetUrl = window.isRu ? base.replace(/\/$/, '') + '/ru/' : base;

            window.location.href = targetUrl;
        });

        // Правый клик мыши
        el.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            if (typeof toggleLanguage === 'function') {
                toggleLanguage();
            }
        });

        // Долгое нажатие
        const startPress = function(e) {
            if (e.type === 'mousedown' && e.button !== 0) return;
            
            el.dataset.longpressed = 'false';
            
            pressTimer = window.setTimeout(function() {
                el.dataset.longpressed = 'true';
                if (typeof toggleLanguage === 'function') {
                    toggleLanguage();
                }
            }, 600);
        };
 
        const cancelPress = function() {
            clearTimeout(pressTimer);
        };

        el.addEventListener('mousedown', startPress);
        el.addEventListener('touchstart', startPress, { passive: true });
        
        el.addEventListener('mouseup', cancelPress);
        el.addEventListener('mouseleave', cancelPress);
        el.addEventListener('touchend', cancelPress);
        el.addEventListener('touchmove', cancelPress, { passive: true });
    });
});
