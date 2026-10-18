#!/usr/bin/env node
// One template, two pages (ddg-ui #2).
//
// The dictionary used to keep two near-identical copies of the home page: templates/home.html (EN)
// and ru_templates/home.html (RU). 172 of their 247 lines differed — by prose, meta tags and a few
// attribute titles — so every structural edit had to be made twice and drifted apart in between.
//
// Now there is one source, public/templates/home.html, and i18n/ru.json maps the RU lines onto it:
// the key is the English line itself (trimmed), the value the Russian one, the way gettext keys off
// the source string. Nothing is translated at runtime — the pages stay static files with real
// <title>/<meta> for crawlers, only generated instead of hand-copied.
//
//   node build-pages.js        # writes public/index.html and public/ru/index.html (+ the key-term pages below)
//
// Adding a string: put the English text in the template, run the script, and add the Russian line
// to i18n/ru.json under the same (trimmed) English key. If a key is missing the English line is
// used as is, so a forgotten translation degrades to English rather than to nothing.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const TEMPLATE = path.join(ROOT, 'public', 'templates', 'home.html');
const PAGES = [
    { file: path.join(ROOT, 'public', 'index.html'), dict: null },
    { file: path.join(ROOT, 'public', 'ru', 'index.html'), dict: path.join(ROOT, 'i18n', 'ru.json') }
];

function translate(line, dict) {
    const key = line.trim();
    if (!key || !Object.prototype.hasOwnProperty.call(dict, key)) return line;
    const indent = line.slice(0, line.length - line.trimStart().length);
    return indent + dict[key];
}

function main() {
    const template = fs.readFileSync(TEMPLATE, 'utf8');
    for (const page of PAGES) {
        const dict = page.dict && fs.existsSync(page.dict) ? JSON.parse(fs.readFileSync(page.dict, 'utf8')) : {};
        const out = template.split('\n').map((line) => translate(line, dict)).join('\n');
        fs.mkdirSync(path.dirname(page.file), { recursive: true });
        fs.writeFileSync(page.file, out, 'utf8');
        console.log('wrote ' + path.relative(ROOT, page.file) + ' (' + Object.keys(dict).length + ' translated lines)');
    }
}

// Key-term pages (owner): crawlers that do not run JS (Yandex) see only the static shell, the same for every
// word. For the key terms (POPULAR in static/ui.js, the owner's sheet) a copy of each page is written with the
// DPD meaning already in <title>/<meta description> and the word's canonical/hreflang: public/w/<word>.html,
// public/ru/w/<word>.html. .htaccess (dict.dhamma.gift) and dg-fastify (dhamma.gift/dict/) serve it at /<word>.
// Meanings come from the offline mini-dictionary dhamma.gift already serves (standalone-dpd: i2h = form -> DPD
// headwords, ebts = headword -> "pos <b>meaning; meaning</b> ..."), the same rule as setWordMeaningHead in
// extra.js, which leaves a pre-rendered head as it is. Rebuilt with the pages, so the copies never go stale.
// No mini-dictionary on this box (DPD_DIR): the copies are left untouched with a loud warning, the build still succeeds.
const SITE = 'https://dict.dhamma.gift/';
const DPD_DIR = process.env.DPD_DIR || '/var/www/html/assets/js/standalone-dpd';

function loadDpd(file) {
    const ctx = {};
    require('vm').runInNewContext(fs.readFileSync(path.join(DPD_DIR, file), 'utf8').replace(/^var /gm, 'this.'), ctx);
    return Object.values(ctx)[0];
}

function meaningHead(word, i2h, ebts, ru, byLemma) {
    const lemma = (h) => h.replace(/\s+[\d.]+$/, '').trim();
    // i2h lists only the forms the texts use; a bare stem (lobha, appamāda) is found by its headwords
    const heads = (i2h[word] || byLemma.get(word) || []).map((h) => {
        const m = /^(.*?)<b>(.*?)<\/b>/.exec(ebts[h] || '');
        if (!m) return null;
        const means = m[2].replace(/<[^>]+>/g, '').split(';').map((x) => x.trim()).filter(Boolean);
        return means.length ? { head: lemma(h), pos: m[1].replace(/<[^>]+>/g, '').replace(/\(.*?\)/g, '').trim(), means } : null;
    }).filter(Boolean);
    if (!heads.length) return null;
    heads.sort((a, b) => (b.head === word) - (a.head === word));
    const firsts = [...new Set(heads.map((h) => h.means[0]))];
    const list = firsts.length > 1 ? firsts : heads[0].means;
    let title = word + ' — ' + list[0], n = 1;
    while (n < list.length && (title + '; ' + list[n]).length <= 60) title += '; ' + list[n++];
    if (firsts.length > 1 && n < list.length) title += ' +' + (list.length - n);
    const tail = ru ? ' 5+ словарей в одном поиске.' : ' 5+ dictionaries in one search.';
    const used = new Set();
    let desc = word + ' — ';
    for (const h of heads) {
        const m = heads.length > 1 ? h.means[0] : h.means.join('; ');
        if (used.has(m)) continue;
        const add = (used.size ? '; ' : '') + (h.pos ? h.pos + ' ' : '') + m;
        if ((desc + add + '.' + tail).length > 155 && used.size) break;
        desc += add; used.add(m);
    }
    return { title: title + ' — Dict.DG', desc: desc + '.' + tail };
}

function prerenderWords() {
    if (!fs.existsSync(path.join(DPD_DIR, 'dpd_i2h.js'))) {
        // not removed: a box without the data would delete 654 tracked pages on its next commit (f3-ultra)
        return console.warn('WARNING key-term pages NOT rebuilt (no mini-dictionary at ' + DPD_DIR + ', set DPD_DIR): w/ keeps the previous shell - rebuild where the data is before committing');
    }
    const words = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'static', 'ui.js'), 'utf8').match(/const POPULAR = (\[.*?\]);/)[1])
        .filter((w) => !w.includes(' '));
    const i2h = loadDpd('dpd_i2h.js');
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    for (const [i, page] of PAGES.entries()) {
        const ru = i === 1;
        const ebts = loadDpd(ru ? 'ru/dpd_ebts.js' : 'dpd_ebts.js');
        const byLemma = new Map();
        for (const h of Object.keys(ebts)) { const l = h.replace(/\s+[\d.]+$/, ''); byLemma.set(l, [...(byLemma.get(l) || []), h]); }
        const shell = fs.readFileSync(page.file, 'utf8');
        const dir = path.join(path.dirname(page.file), 'w');
        fs.rmSync(dir, { recursive: true, force: true });
        fs.mkdirSync(dir);
        let n = 0;
        for (const word of words) {
            const h = meaningHead(word, i2h, ebts, ru, byLemma);
            if (!h) continue;
            const url = (lang) => SITE + (lang === 'ru' ? 'ru/' : '') + encodeURIComponent(word);
            const links = `<link rel="canonical" href="${url(ru ? 'ru' : 'en')}">\n  <link rel="alternate" hreflang="en" href="${url('en')}">\n  `
                + `<link rel="alternate" hreflang="ru" href="${url('ru')}">\n  <link rel="alternate" hreflang="x-default" href="${url('en')}">\n  `
                + `<meta name="dg-prerendered" content="${esc(word)}">\n  `;
            const out = shell
                .replace(/<title>[^<]*<\/title>/, `<title>${esc(h.title)}</title>`)
                .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(h.desc)}`)
                .replace(/(<meta property="og:url" content=")[^"]*/, `$1${url(ru ? 'ru' : 'en')}`)
                .replace('<link rel="manifest"', links + '<link rel="manifest"');
            fs.writeFileSync(path.join(dir, word + '.html'), out, 'utf8');
            n++;
        }
        console.log('wrote ' + n + ' key-term pages in ' + path.relative(ROOT, dir));
    }
}

main();
prerenderWords();
