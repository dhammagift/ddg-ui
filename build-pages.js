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
//   node build-pages.js        # writes public/index.html and public/ru/index.html
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

main();
