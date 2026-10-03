#!/usr/bin/env node
/**
 * Every Arrow Is a Decision, EDITION 4 — structure test (no browser, no network).
 *
 *   node articles/every-arrow/tests/edition4.mjs
 *
 * The promises edition 4 makes about itself: eight products, three companies each,
 * four lenses, every claim cited to a registered source, every Test ours and
 * uncited, no scoring; each product has its arrow, its reading and a working
 * Command Center link; old links to edition 3 are forwarded, and no edition-4 id
 * steals an edition-3 anchor; counts and dates agree; the essay ends on its five
 * lines. Staleness of generated parts is checked by scripts/every_arrow/build.mjs --check.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const html = read('articles/every-arrow-is-a-decision.html');
const e3 = read('articles/every-arrow/edition-3.html');
const fails = [];
let passed = 0;
const ok = (c, m) => { if (c) passed++; else fails.push(m); };
const load = (f, name) => { const c = {}; c.window = c; vm.createContext(c); vm.runInContext(read(f), c); return c[name]; };
const C = load('articles/every-arrow/compare.js', 'EA_CMP');
const PG = load('privacy-command-center/graph.js', 'PG');

/* ── 1 · the comparison ─────────────────────────────────────────── */
const want = ['passkeys', 'browser', 'mail', 'messages', 'wallet', 'backup', 'assistant', 'voice'];
ok(C.products.map((p) => p.id).join() === want.join(), 'the eight products, in order: ' + want.join(', '));
ok(C.lenses.map((l) => l.t).join(' · ') === 'Security · Privacy · QA · Data governance', 'the four lenses, in order');
const sections = [...html.matchAll(/<section class="scene[^"]*" id="([\w-]+)"/g)].map((m) => m[1]);
ok(sections.join() === ['lenses', 'compare', ...want, 'future', 'everyday', 'patterns', 'kit', 'method', 'coda'].join(), 'sections in order: ' + sections.join(', '));
for (const p of C.products) {
  const sec = new RegExp(`<section class="scene[^"]*" id="${p.id}"[\\s\\S]*?</section>`).exec(html);
  ok(!!sec, `#${p.id}: no section`); if (!sec) continue;
  const b = sec[0];
  ok(p.cos[0] === 'apple' && p.cos[1] === 'google', `${p.id}: Apple and Google come first`);
  ok(/<ol class="arrow"/.test(b) && (b.match(/<li class="hot">/g) || []).length === 1, `#${p.id}: the arrow with exactly one hop to watch`);
  ok(new RegExp(`<figure class="cmp" id="fig-${p.id}" data-fig="${p.id}">`).test(b), `#${p.id}: no comparison figure`);
  ok(/<div class="cmp-ctl" role="radiogroup"[^>]*hidden>/.test(b), `#${p.id}: the lens switch must be hidden until JavaScript runs (so print and no-JS show every lens)`);
  const rows = [...b.matchAll(/<tr data-l="(\w+)">/g)].map((m) => m[1]);
  ok(rows.join() === 'sec,pri,qa,gov', `#${p.id}: one row per lens`);
  const cols = [...b.matchAll(/<th scope="col">([^<]+)<small>/g)].map((m) => m[1]);
  ok(cols.join() === p.cos.map((c) => C.companies[c]).join(), `#${p.id}: company columns ${cols}`);
  ok((b.match(/<td data-h=/g) || []).length === 12, `#${p.id}: twelve cells`);
  ok((b.match(/data-k="test"/g) || []).length >= 3, `#${p.id}: a Test for every company`);
  for (const k of ['Where they agree', 'Where they differ', 'The arrow to watch']) ok(b.includes(`<dt>${k}</dt>`), `#${p.id}: reading has “${k}”`);
  /* Command Center link: v1 selector values must exist in graph.js; v10 routes in its nav */
  const link = /<p class="pcc-link"><a href="([^"]+)">/.exec(b);
  ok(!!link, `#${p.id}: no Command Center link`);
  if (link) {
    const u = link[1].replace(/&amp;/g, '&');
    if (u.startsWith('/privacy-command-center/#cc?')) {
      const q = Object.fromEntries(u.split('?')[1].split('&').map((kv) => kv.split('=')));
      ok(PG.personas.some((x) => x.id === q.p), `#${p.id}: persona ${q.p} is not in the Command Center`);
      ok(PG.surfaces.some((x) => x.id === q.s), `#${p.id}: surface ${q.s} is not in the Command Center`);
      ok(PG.journeys.some((x) => x.id === q.j), `#${p.id}: journey ${q.j} is not in the Command Center`);
      ok(PG.questions.some((x) => x.id === q.q), `#${p.id}: question ${q.q} is not in the Command Center`);
      ok(['privacy', 'security', 'both'].includes(q.l), `#${p.id}: lens ${q.l}`);
      /* the v1 surface must offer this journey and question, or the link falls back to the surface default */
      const rel = PG.relevance && PG.relevance[q.s];
      if (rel) ok(rel.j.includes(q.j) && rel.q.includes(q.q), `#${p.id}: surface ${q.s} does not offer journey ${q.j} / question ${q.q} (G.relevance)`);
    } else {
      const m = /^\/privacy-command-center\/v10\/#\/([a-z]+\/[a-z]+)$/.exec(u);
      ok(!!m && read('privacy-command-center/v10/views-life.js').includes(`'${m[1]}'`) || read('privacy-command-center/v10/app.js').includes(`'${m && m[1]}'`), `#${p.id}: ${u} is not a Command Center route`);
    }
  }
}

/* ── 2 · sourcing ───────────────────────────────────────────────── */
const cited = new Set();
for (const m of html.matchAll(/<a class="src" data-src="([\w-]+)" href="([^"]+)"/g)) {
  cited.add(m[1]);
  ok(!!C.sources[m[1]], `citation ${m[1]} is not in compare.js sources`);
  ok(C.sources[m[1]] && C.sources[m[1]].u === m[2].replace(/&amp;/g, '&'), `citation ${m[1]} links somewhere other than its registered URL`);
}
for (const k of Object.keys(C.sources)) ok(cited.has(k) && html.includes(`<li id="src-${k}">`), `source ${k} is not cited and listed`);
/* every vendor claim cites that vendor's own documentation (or a named standards/regulator/press source) */
for (const p of C.products) for (const co of p.cos) for (const l of C.lenses) for (const it of p.cells[co][l.id]) {
  if (it[0] === 'test') { ok(!it[3], `${p.id}/${co}: a Test must not cite a source`); continue; }
  const groups = it[3].split(' ').map((k) => C.sources[k] && C.sources[k].g);
  ok(groups.includes(C.companies[co]) || groups.includes('Standards, regulators and press'), `${p.id}/${co}/${l.id} “${it[1]}” cites no ${C.companies[co]} source`);
}
const e4text = JSON.stringify(C.products) + html.replace(/<script[\s\S]*?<\/script>/g, '');
ok(!/(assistants?|Alexa|Siri|Gemini|Google Assistant)[^.<]{0,80}\b(share|shares|exchange|exchanges|send|sends)\s+(their\s+)?(voice\s+)?recordings\s+(with|to)\s+(each other|one another|competitors?)/i.test(e4text), 'must not claim competing assistants share recordings');
ok(!/\bghost\b/i.test(e4text), 'no accusatory labels');
ok(/This is not a ranking\./.test(html) && /There are no scores and no winners/.test(html), 'the essay says plainly it is not a ranking');
ok(/What could not be confirmed/.test(html), 'the method lists what could not be confirmed');

/* ── 3 · edition 3 still reachable ─────────────────────────────── */
ok(/location\.replace\('\/articles\/every-arrow\/edition-3\.html' \+ q \+ location\.hash\)/.test(html), 'old anchors, ?f= and ?path= links are forwarded to edition 3');
const ids4 = new Set([...html.matchAll(/\bid="([\w-]+)"/g)].map((m) => m[1]));
const ids3 = new Set([...e3.matchAll(/\bid="([\w-]+)"/g)].map((m) => m[1]));
const SHARED = new Set(['main', 'kit', 'coda', 'coda-h', 'sources', 'srch']); /* same meaning in both editions */
for (const id of ids4) if (ids3.has(id)) ok(SHARED.has(id), `#${id} exists in edition 3 with another meaning; an old link would land here instead of being forwarded`);
for (const a of ['s01', 'cc-auth', 'door', 'home', 'person', 'promise']) ok(!ids4.has(a), `#${a} must stay an edition-3 anchor (forwarded)`);
ok(/<a class="inline-link" href="\/articles\/every-arrow\/edition-3\.html">/.test(html), 'the method links to edition 3');

/* ── 4 · counts, dates, reading time ───────────────────────────── */
const stamps = {};
for (const m of html.matchAll(/<span data-ea="([\w.]+)">([^<]*)<\/span>/g)) (stamps[m[1]] = stamps[m[1]] || new Set()).add(m[2]);
for (const [k, v] of Object.entries(stamps)) ok(v.size === 1, `data-ea="${k}" shows different values: ${[...v]}`);
const one = (k) => [...(stamps[k] || [])][0];
ok(one('products') === '8', 'eight products');
ok(one('edition') === '4.0' && /<meta name="ps:edition" content="4.0">/.test(html), 'edition 4.0');
const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
ok(ld.version === '4.0' && ld.dateModified === '2026-10-03' && /article:modified_time" content="2026-10-03"/.test(html), 'modified date and version agree');
ok(ld.datePublished === '2026-09-26' && /datetime="2026-09-26"/.test(html), 'publication date agrees');
ok(ld.timeRequired === `PT${one('read')}M`, 'JSON-LD timeRequired is the full reading time');
ok(+one('read.essay') < +one('read'), 'the essay alone is shorter than the essay with every table');
const meta = JSON.parse(read('article_metadata.json')).find((x) => x.slug === 'every-arrow-is-a-decision.html');
ok(String(meta.read_time) === one('read'), 'article_metadata.json read_time agrees');
ok(/Apple, Google/.test(meta.subtitle), 'article_metadata.json describes edition 4');
const pdf = JSON.parse(read('articles/every-arrow/pdf.json'));
ok(String(pdf.pages) === one('pdf.pages') && pdf.pages > 0, 'the displayed PDF page count agrees with pdf.json');
ok(fs.existsSync(path.join(ROOT, 'articles/every-arrow/every-arrow-is-a-decision.pdf')), 'the printable PDF is missing');
ok(fs.existsSync(path.join(ROOT, 'articles/every-arrow/four-lenses.md')), 'the Markdown review is missing');

/* ── 5 · the review, the patterns, the ending ──────────────────── */
const kit = html.slice(html.indexOf('id="kit-questions"'), html.indexOf('class="btn"', html.indexOf('id="kit-questions"')));
ok([...kit.matchAll(/<section data-l="(\w+)"/g)].map((m) => m[1]).join() === 'sec,pri,qa,gov', 'the review has one block per lens');
for (const m of kit.matchAll(/<section data-l="(\w+)"[\s\S]*?<\/section>/g)) ok((m[0].match(/<li>/g) || []).length === 7, `the ${m[1]} block has seven questions`);
ok((html.match(/<ol class="lessons">[\s\S]*?<\/ol>/)[0].match(/<li>/g) || []).length === 9, 'nine patterns');
const coda = html.slice(html.indexOf('id="coda"'), html.indexOf('</section>', html.indexOf('id="coda"')));
const lines = [...coda.matchAll(/<li[^>]*>([^<]+)<\/li>/g)].map((m) => m[1].trim());
ok(lines.join(' | ') === 'Some arrows copy data. | Some arrows create an identity. | Some arrows make an inference. | And some arrows open the door. | Every arrow is still a decision.', 'the five closing lines, in order: ' + lines.join(' | '));
ok(/A person does not live inside one application\./.test(coda) && /Privacy engineering must follow them across all of those boundaries\./.test(coda), 'the closing thesis');

/* ── 5b · the hero illustration: every size exists, and it is described ── */
{
  const fig = /<figure class="hero-art">([\s\S]*?)<\/figure>/.exec(html);
  ok(!!fig, 'the hero illustration is missing');
  if (fig) {
    for (const m of fig[1].matchAll(/(\/images\/[\w/.-]+\.(?:avif|webp|png|jpg))/g)) ok(fs.existsSync(path.join(ROOT, m[1])), `hero image ${m[1]} does not exist`);
    const alt = (/alt="([^"]*)"/.exec(fig[1]) || [, ''])[1];
    ok(alt.length > 200 && /Security/.test(alt) && /Data governance/.test(alt), 'the hero illustration needs alt text that carries its words (the four lenses and the threats)');
    ok(/width="\d+" height="\d+"/.test(fig[1]), 'the hero illustration needs width and height (no layout shift)');
    /* the owner's hero is the first thing on screen: once it sat below the title, deck and paths and was invisible without scrolling */
    ok(html.indexOf('<figure class="hero-art">') < html.indexOf('<div class="hero-inner">') && html.indexOf('<figure class="hero-art">') > html.indexOf('<div class="masthead">'), 'the hero illustration must sit directly under the masthead, above the title');
  }
}

/* ── 5c · the arrow into the future: recoverability and preservation ── */
{
  const f = /<section class="scene[^"]*" id="future"[\s\S]*?<\/section>\n\n<section/.exec(html);
  ok(!!f, 'the arrow-into-the-future section is missing');
  const b = f ? f[0] : '';
  ok(/What must still be possible/.test(b), 'the future section asks what must still be possible years from now');
  for (const m of ['Encryption', 'Tokenization', 'Hashing', 'Keyed pseudonyms']) ok(new RegExp(`<h4 id="m-\\w+">${m}</h4>`).test(b), `the future section explains ${m}`);
  for (const line of ['Deleting the key can be equivalent to deleting the data', 'the vault decides whether identity can come back', 'One-way does not necessarily mean unlinkable', 'Key lifecycle can quietly become data lifecycle', 'Preserved bytes are not necessarily preserved evidence'])
    ok(b.includes(line), `the future section keeps the line “${line}”`);
  ok(/cannot be recovered from the hash/.test(b) && !/(decrypt|reverse|unlock)[^.]{0,40}\bhash/i.test(b.replace(/cannot normally be reversed/, '')), 'a hash is one-way: nothing may suggest it can be decrypted or reversed');
  ok(!/rainbow/i.test(html), 'no rainbow tables');
  ok(/not legal advice/.test(b), 'legal hold is described as an engineering requirement, not legal advice');
  ok(/Legal hold[\s\S]*Preserve[\s\S]*Release hold[\s\S]*Resume retention and deletion/.test(b), 'the preservation lifecycle, in order');
  const coda = html.slice(html.indexOf('id="coda"'), html.indexOf('</section>', html.indexOf('id="coda"')));
  ok(/Some arrows move information through space\. Some move it through systems\. And some decisions determine whether information can still be recovered years later\./.test(coda), 'the closing thesis is extended in time');
}

/* ── 5d · everyday arrows: events, joins, mixed devices, changes ── */
{
  const f = /<section class="scene[^"]*" id="everyday"[\s\S]*?<\/section>\n\n<section/.exec(html);
  ok(!!f, 'the everyday-arrows section is missing');
  const b = f ? f[0] : '';
  ok(/Event[\s\S]*Identifier[\s\S]*System[\s\S]*Derived data[\s\S]*Inference/.test(b), 'the chain reads event → identifier → system → derived data → inference');
  for (const line of ['The combination is the inference', 'Why is this connected?', 'what happens when one feature is allowed to see all of them at once', 'Mixing platforms moves the join; it does not remove it', 'Privacy problems arrive as changes'])
    ok(b.includes(line), `the everyday section keeps “${line}”`);
  for (const a of ['Keep the connection', 'Scope it', 'Shorten retention', 'Separate the contexts']) ok(b.includes(a), `the everyday section names the decision “${a}”`);
  ok([...b.matchAll(/<li data-l="(\w+)">/g)].map((m) => m[1]).join() === 'sec,pri,qa,gov', 'the everyday section is read through all four lenses');
  ok(!/<a class="src"/.test(b) && /carries no citations/.test(b), 'the everyday section makes no vendor claims, and says so');
  ok(!/\b(Apple|Google|Microsoft|iPhone|Android|Windows|Mac)\b/.test(b.replace(/<[^>]+>/g, ' ')), 'the everyday section names no company or platform: it describes patterns');
  /* its Command Center links land on things that exist */
  const E = (() => { const c = { PG: {} }; c.window = c; vm.createContext(c); c.PG.asOf = PG.asOf; vm.runInContext(read('privacy-command-center/events.js'), c); return c.PG.events; })();
  for (const m of b.matchAll(/href="\/privacy-command-center\/#cc\?([^"]+)"/g)) {
    const q = Object.fromEntries(m[1].replace(/&amp;/g, '&').split('&').map((kv) => kv.split('=')));
    const okLink = (q.et || 'day') === 'day' ? E.day.events.some((x) => x.id === q.e) : q.et === 'cases' ? !!E.caseById(q.e) : false;
    ok(okLink, `everyday: ${m[1]} is not an Events-layer view`);
  }
  const coda = html.slice(html.indexOf('id="coda"'), html.indexOf('</section>', html.indexOf('id="coda"')));
  ok(/on devices from different companies\./.test(coda), 'the closing thesis follows the person across devices');
}

/* ── 6 · a slim page ───────────────────────────────────────────── */
const js = read('articles/every-arrow/lenses.js');
ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(js), 'the lens switches store nothing');
ok(!/every-arrow\/(essay\.css|core\.js|figures|trails|house|northstar|data\.js|model\.js)/.test(html), 'edition 4 loads none of edition 3’s assets');
ok(fs.statSync(path.join(ROOT, 'articles/every-arrow/lenses.css')).size < 30000, 'lenses.css stays small');

if (fails.length) { console.error(fails.map((f) => '✗ ' + f).join('\n')); console.error(`\n${fails.length} failed, ${passed} passed`); process.exit(1); }
console.log(`✓ every-arrow edition 4 structure: ${passed} checks passed`);
