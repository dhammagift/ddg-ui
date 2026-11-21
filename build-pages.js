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
// dg-node is the dictionary's home now (its build-dpd-dictionary.yml); the old PHP site's copy is no longer updated
const DPD_DIR = process.env.DPD_DIR || '/var/www/dg-node-prod/public/overrides/js/standalone-dpd';

function loadDpd(file) {
    const ctx = {};
    require('vm').runInNewContext(fs.readFileSync(path.join(DPD_DIR, file), 'utf8').replace(/^var /gm, 'this.'), ctx);
    return Object.values(ctx)[0];
}

function meaningHead(word, i2h, ebts, ru, byLemma) {
    const lemma = (h) => h.replace(/\s+[\d.]+$/, '').trim();
    // i2h lists only the forms the texts use; a bare stem (lobha, appamāda) is found by its headwords
    // the DG glossary's own entries ("<term> (DG)") stay out of the titles and descriptions: those are DPD's meanings
    const heads = (i2h[word] || byLemma.get(word) || []).filter((h) => !/ \(DG\)$/.test(h)).map((h) => {
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

// What a crawler or an AI reader gets with no JS (owner 2026-11-21: «надо сделать, чтобы без скрипта были видны»): the
// definitions from the Suttas were drawn by the client only, so Google and AI bots saw a DPD meaning and no sutta at all
// (0 sutta links in w/upekkhā.html). The block goes into #dpd-results, whose innerHTML the client replaces on load, so
// people see the usual entry; the page opens on the entry screen. Data: the glossary the reader's lookup uses
// (standalone-dpd/dg-glossary.json: the project's rendering, the Suttas' or Vinaya's definition and where it stands).
const DG = 'https://dhamma.gift/';
function staticEntry(word, term, dpd, ru) {
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const L = ru
        ? { h: 'определение из самих сутт', dg: 'Перевод Dhamma.Gift', def: 'Определение в суттах', where: 'Где сутты дают определение', dpd: 'DPD', gl: 'Глоссарий', rat: 'Обоснование перевода', open: 'Найти в текстах на Dhamma.Gift', pre: 'ru/' }
        : { h: 'how the Suttas define it', dg: 'Dhamma.Gift rendering', def: 'Definition in the Suttas', where: 'Where the Suttas define it', dpd: 'DPD', gl: 'Glossary', rat: 'Why this rendering', open: 'Find in the texts on Dhamma.Gift', pre: '' };
    const c = term && term.canon;
    // The term's main definition may stand in the Vinaya (owner 2026-11-21: «Vinaya meaning» there, «Sutta meaning» otherwise)
    if (c && c.link && /^\/?pli-tv-/.test(c.link)) Object.assign(L, ru ? { h: 'определение из Винаи', def: 'Определение в Винае', where: 'Где Виная даёт определение' } : { h: 'how the Vinaya defines it', def: 'Definition in the Vinaya', where: 'Where the Vinaya defines it' });
    let html = '<section class="dg-static" id="dg-static-entry">';
    if (c && c.definition) {
        html += `<h2>${esc(word)} — ${L.h}</h2>`
            + `<p><b>${L.dg}:</b> ${esc(ru ? term.ru : term.en)}</p>`
            + `<p><b>${L.def}</b> (<a href="${DG}${esc(c.link.replace(/^\//, ''))}">${esc(c.link.replace(/^\/|:.*$/g, ''))}</a>):</p>`
            + `<blockquote lang="pi">${esc(c.definition)}</blockquote>`
            + `<p>${L.where}: ` + (c.where || []).map((r) => `<a href="${DG}${esc(r)}">${esc(r.replace(/:.*$/, ''))}</a>`).join(', ') + '</p>';
    } else {
        html += `<h2>${esc(word)}</h2>`;
    }
    // The Suttas' images for the term (glossary term.metaphors: kind, text, refs); the client draws them live in #dg-gloss
    const mets = (term && term.metaphors) || [];
    if (mets.length) html += `<p><b>${ru ? 'Метафоры' : 'Metaphors'}:</b> ` + mets.map((m) => `<i lang="pi">${esc(m.text)}</i>`
        + (m.refs && m.refs.length ? ' (' + m.refs.map((r) => `<a href="${DG}${esc(r)}">${esc(r.replace(/:.*$/, ''))}</a>`).join(', ') + ')' : '')).join('; ') + '</p>';
    if (dpd) html += `<p><b>${L.dpd}:</b> ${esc(dpd)}</p>`;
    const links = [`<a href="${DG}${encodeURIComponent(word)}">${L.open}</a>`];
    if (term) links.push(`<a href="${DG}${L.pre}docs/glossary/#${esc(term.id)}">${L.gl}</a>`);
    if (term && term.rationale) links.push(`<a href="${DG}${L.pre}docs/rationale/#${esc(term.id)}">${L.rat}</a>`);
    html += `<p>${links.join(' · ')}</p></section>`;
    const ld = c && c.definition ? `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org', '@type': 'DefinedTerm', name: word, inLanguage: 'pi',
        description: (ru ? term.ru : term.en) + '. ' + c.definition,
        url: SITE + L.pre + encodeURIComponent(word),
        inDefinedTermSet: { '@type': 'DefinedTermSet', name: 'Dhamma.Gift glossary', url: DG + L.pre + 'docs/glossary/' },
        subjectOf: { '@type': 'WebPage', url: DG + c.link.replace(/^\//, '') } }).replace(/</g, '\\u003c')}</script>` : '';
    return { html, ld };
}

// Title and description for a glossary term. The hook is what a plain dictionary doesn't have (owner 2026-11-21: «меня бы
// значение не зацепило вообще… это просто словарь, а у нас не просто словарь»): the Suttas' own definition, word for word,
// and in how many suttas it stands; the project's rendering comes last.
const refName = (r) => r.replace(/:.*$/, '').replace(/^pli-tv-/, '').replace(/^([a-z]+)(\d)/, (m, b, d) => b.toUpperCase() + ' ' + d);
function termHead(word, term, ru) {
    const r = (ru ? term.ru : term.en).split(/,\s*/);
    let mean = r[0], i = 1;
    while (i < r.length && (mean + ', ' + r[i]).length <= 30) mean += ', ' + r[i++];
    const c = term.canon, vin = /^\/?pli-tv-/.test(c.link);
    const refs = [...new Set((c.where && c.where.length ? c.where : [c.link.replace(/^\//, '')]).map(refName))];
    const n = refs.length, list = refs.slice(0, 2).join(', ') + (n > 2 ? ` +${n - 2}` : '');
    const title = word + (vin
        ? (ru ? ' — определение в Винае: ' : ' — defined in the Vinaya: ')
        : (ru ? (n === 1 ? ' — определение в сутте ' : ` — определение в ${n} суттах: `) : (n === 1 ? ' — defined in ' : ` — defined in ${n} suttas: `))) + list + ' — Dict.DG';
    const head = ru ? `Как ${vin ? 'Виная' : 'сутты'} сами определяют ${word} (${refs[0]}): «` : `How the ${vin ? 'Vinaya defines' : 'Suttas define'} ${word}, word for word (${refs[0]}): “`;
    const tail = (ru ? '» Перевод DG: ' : '” DG rendering: ') + mean + '.';
    const room = 158 - head.length - tail.length;
    const raw = c.definition.replace(/^[“"‘'«]+/, '');
    const def = raw.length > room ? raw.slice(0, room - 1).replace(/\s+\S*$/, '') + '…' : raw;
    return { title, desc: head + def + tail };
}

function prerenderWords() {
    if (!fs.existsSync(path.join(DPD_DIR, 'dpd_i2h.js'))) {
        // not removed: a box without the data would delete 654 tracked pages on its next commit (f3-ultra)
        return console.warn('WARNING key-term pages NOT rebuilt (no mini-dictionary at ' + DPD_DIR + ', set DPD_DIR): w/ keeps the previous shell - rebuild where the data is before committing');
    }
    const words = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'static', 'ui.js'), 'utf8').match(/const POPULAR = (\[.*?\]);/)[1])
        .filter((w) => !w.includes(' '));
    const gl = fs.existsSync(path.join(DPD_DIR, 'dg-glossary.json')) ? JSON.parse(fs.readFileSync(path.join(DPD_DIR, 'dg-glossary.json'), 'utf8')).terms : [];
    const byTerm = new Map(gl.filter((t) => t.pali && !t.pali.includes(' ')).map((t) => [t.pali, t]));
    for (const [w, t] of byTerm) if (t.canon && t.canon.definition && !words.includes(w)) words.push(w);
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
            const term = byTerm.get(word);
            const dh = meaningHead(word, i2h, ebts, ru, byLemma);
            const defined = term && term.canon && term.canon.definition;
            if (!dh && !defined) continue;
            const h = defined ? termHead(word, term, ru) : dh;
            const dpdLine = dh ? dh.desc.replace(/^[^—]*—\s*/, '').replace(/\s*5\+.*$/, '') : '';
            const st = staticEntry(word, term, dpdLine, ru);
            const url = (lang) => SITE + (lang === 'ru' ? 'ru/' : '') + encodeURIComponent(word);
            const links = `<link rel="canonical" href="${url(ru ? 'ru' : 'en')}">\n  <link rel="alternate" hreflang="en" href="${url('en')}">\n  `
                + `<link rel="alternate" hreflang="ru" href="${url('ru')}">\n  <link rel="alternate" hreflang="x-default" href="${url('en')}">\n  `
                + `<meta name="dg-prerendered" content="${esc(word)}">\n  `;
            const out = shell
                .replace(/<title>[^<]*<\/title>/, `<title>${esc(h.title)}</title>`)
                .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(h.desc)}`)
                .replace(/(<meta property="og:url" content=")[^"]*/, `$1${url(ru ? 'ru' : 'en')}`)
                .replace('<link rel="manifest"', links + st.ld + '<link rel="manifest"')
                .replace('<body data-screen="start"', '<body data-screen="entry"')
                .replace('<h1 id="whead-word"></h1>', `<h1 id="whead-word">${esc(word)}</h1>`)
                .replace('<div class="dpd-results" id="dpd-results"></div>', `<div class="dpd-results" id="dpd-results">${st.html}</div>`);
            fs.writeFileSync(path.join(dir, word + '.html'), out, 'utf8');
            n++;
        }
        console.log('wrote ' + n + ' key-term pages in ' + path.relative(ROOT, dir));
    }
}

main();
prerenderWords();
