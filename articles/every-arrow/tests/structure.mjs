#!/usr/bin/env node
/**
 * Every Arrow Is a Decision — structure test (no browser, no network).
 *
 *   node articles/every-arrow/tests/structure.mjs
 *
 * Checks the promises the essay makes about itself: every interactive figure
 * has instructions, a live version, a static fallback, a reset, a link to its
 * state, a written reading and (outside the corner-case trails) the five-question
 * lesson; old deep links still land; dates agree; the Command Center map agrees
 * in both directions; Northstar names in the essay exist in the shared dataset.
 * Staleness of generated parts is checked by scripts/every_arrow/build.mjs --check.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const html = read('articles/every-arrow-is-a-decision.html');
const fails = [];
let passed = 0;
function ok(cond, msg) { if (cond) passed++; else fails.push(msg); }
function load(files) { const c = { console }; c.window = c; vm.createContext(c); files.forEach((f) => vm.runInContext(read(f), c, { filename: f })); return c; }
const ctx = load(['articles/every-arrow/northstar.js', 'articles/every-arrow/data.js', 'articles/every-arrow/trails.js']);
const D = ctx.EA_DATA, NS = ctx.EA_NS, T = ctx.EA_TRAILS;
const pcc = load(['privacy-command-center/data.js']).NS;

/* ── 1 · the figure contract ─────────────────────────────────────── */
const figRe = /<figure class="(fig[^"]*)" id="fig-([\w-]+)"[^>]*>([\s\S]*?)<\/figure>/g;
const figs = [...html.matchAll(figRe)];
const ids = figs.map((m) => m[2]);
ok(figs.length >= 30, `expected at least 30 interactive figures, found ${figs.length}`);
ok(new Set(ids).size === ids.length, 'figure ids are not unique');
for (const [, cls, id, body] of figs) {
  const trail = id.startsWith('trail-');
  ok(/class="fig-how"/.test(body), `fig-${id}: no instructions (.fig-how)`);
  ok(/class="fig-live"/.test(body), `fig-${id}: no live container (.fig-live)`);
  ok(/class="fig-static[^"]*"/.test(body), `fig-${id}: no static fallback (.fig-static)`);
  ok(/data-fig-reset/.test(body), `fig-${id}: no Reset button`);
  ok(/data-fig-link/.test(body), `fig-${id}: no "copy link to this state" button`);
  ok(/class="fig-read" aria-live="polite"/.test(body), `fig-${id}: no written interpretation region (.fig-read, aria-live)`);
  const st = /<div class="fig-static[^"]*"[^>]*>([\s\S]*?)<\/div>(?:<!-- \/static:[\w-]+ -->)?\s*<div class="fig-foot">/.exec(body);
  ok(st && st[1].replace(/<[^>]+>/g, '').trim().length > 80, `fig-${id}: static fallback is empty or trivial`);
  if (!trail || /fig-trail-nova/.test('fig-' + id)) {
    const teach = /<dl class="fig-teach">([\s\S]*?)<\/dl>/.exec(body);
    ok(!!teach, `fig-${id}: no lesson (.fig-teach)`);
    if (teach) {
      const dts = [...teach[1].matchAll(/<dt>([^<]+)<\/dt>/g)].map((m) => m[1]);
      ok(dts.length === 5 && dts[0] === 'You change' && dts[3] === 'The control' && dts[4] === 'The evidence', `fig-${id}: the lesson must answer the five questions in order (got ${dts.join(' / ')})`);
    }
  }
  if (trail) ok(T[id.slice(6)] && new RegExp(`data-trail="${id.slice(6)}"`).test(body), `fig-${id}: no matching trail story`);
}
/* every trail story is mounted somewhere */
for (const k of Object.keys(T)) if (k[0] !== '_') ok(ids.includes('trail-' + k), `trail "${k}" is not in the essay`);
/* a figure's interactive twin: each registered id has a container */
const registered = new Set([...read('articles/every-arrow/figures.js').matchAll(/EA\.fig\('([\w-]+)'/g), ...read('articles/every-arrow/figures2.js').matchAll(/EA\.fig\('([\w-]+)'/g)].map((m) => m[1]));
for (const r of registered) ok(ids.includes(r), `figures.js registers "${r}" but the essay has no fig-${r}`);
for (const id of ids) if (!id.startsWith('trail-')) ok(registered.has(id), `fig-${id} has no controller in figures.js / figures2.js`);

/* ── 2 · scenes, chapters, paths ─────────────────────────────────── */
const scenes = [...html.matchAll(/<section class="scene[^"]*" id="([\w-]+)"[^>]*data-title="([^"]+)"/g)];
ok(scenes.length === 23, `expected 23 scenes, found ${scenes.length}`);
for (const [, id] of scenes) {
  const sec = html.slice(html.indexOf(`id="${id}"`), html.indexOf('</section>', html.indexOf(`id="${id}"`)));
  ok(/<div class="brief x">/.test(sec), `#${id}: no executive brief`);
  ok(/<div class="scene-body">/.test(sec), `#${id}: no scene body`);
  ok(/class="takeaway"/.test(sec), `#${id}: no takeaway`);
  ok(new RegExp(`href="#${id}"`).test(html), `#${id}: not in the table of contents`);
}
const chapters = [...html.matchAll(/<div class="chapter[^"]*" id="(\w+)" data-title="([^"]+)"/g)].map((m) => m[1]);
ok(chapters.join() === 'see,decide,build,prove,kit', `chapters should be see,decide,build,prove,kit — got ${chapters}`);
for (const c of ['see', 'decide', 'build', 'prove']) {
  const i = html.indexOf(`id="${c}"`), j = html.indexOf('<div class="chapter', i + 10);
  const ch = html.slice(i, j < 0 ? undefined : j);
  const arc = /<ol class="ch-arc x"[\s\S]*?<\/ol>/.exec(ch);
  ok(arc && ['Situation', 'System', 'Consequence', 'Control', 'Evidence'].every((w) => arc[0].includes(`<b>${w}</b>`)), `chapter ${c}: opener must run situation → system → consequence → control → evidence`);
  ok(/<aside class="ch-close x"/.test(ch), `chapter ${c}: must close with its evidence`);
}
ok(/href="#kit"/.test(html) && /class="skip" href="#kit"/.test(html), 'no "skip to the field kit" link');
ok(/data-set-path="exec"/.test(html) && /data-set-path="full"/.test(html), 'no reading-path switch');

/* ── 3 · counts and dates agree everywhere ───────────────────────── */
const stamps = {};
for (const m of html.matchAll(/<span data-ea="([\w.]+)">([^<]*)<\/span>/g)) (stamps[m[1]] = stamps[m[1]] || new Set()).add(m[2]);
for (const [k, v] of Object.entries(stamps)) ok(v.size === 1, `data-ea="${k}" shows different values: ${[...v]}`);
ok([...(stamps.scenes || [])][0] === String(scenes.length), 'displayed scene count differs from the scenes in the essay');
ok([...(stamps.chapters || [])][0] === '5', 'displayed chapter count is not 5');
const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
ok(ld.datePublished === '2026-09-26' && /article:published_time" content="2026-09-26"/.test(html) && /datetime="2026-09-26"/.test(html), 'publication date disagrees between JSON-LD, meta and byline');
ok(ld.dateModified === /article:modified_time" content="([\d-]+)"/.exec(html)[1], 'modified date disagrees between JSON-LD and meta');
ok(ld.timeRequired === `PT${[...stamps['read.full']][0]}M`, 'JSON-LD timeRequired disagrees with the displayed reading time');
const meta = JSON.parse(read('article_metadata.json')).find((x) => x.slug === 'every-arrow-is-a-decision.html');
ok(String(meta.read_time) === [...stamps['read.full']][0], 'article_metadata.json read_time disagrees with the essay');
const pdf = JSON.parse(read('articles/every-arrow/pdf.json'));
ok(String(pdf.pages) === [...stamps['pdf.pages']][0], 'the displayed PDF page count disagrees with pdf.json');
ok(fs.existsSync(path.join(ROOT, 'articles/every-arrow/every-arrow-is-a-decision.pdf')), 'the printable PDF is missing');
ok(fs.existsSync(path.join(ROOT, 'articles/every-arrow/field-kit.md')), 'the field kit download is missing');

/* ── 4 · old deep links still land ───────────────────────────────── */
for (const a of ['job', 's01', 's02', 's02b', 's03', 's04', 's05', 's06', 's07', 'sBurn', 's08', 's09', 's10', 's11', 's12', 's13', 'cc-debug', 'cc-csv', 'cc-family', 'cc-optout', 'cc-forget', 'cc-auth'])
  ok(new RegExp(`id="${a}"`).test(html), `legacy anchor #${a} is gone — old links to it would break`);
for (const t of pcc.assumptionTests) if (t.essay) ok(new RegExp(`id="${t.essay}"`).test(html), `Command Center links to #${t.essay}, which the essay no longer has`);

/* ── 5 · the Command Center, in both directions ─────────────────── */
const app = read('privacy-command-center/app.js');
const navRoutes = new Set([...app.matchAll(/\['([a-z]+\/[a-z]+)', '/g)].map((m) => m[1]));
const essayBlock = app.slice(app.indexOf('P.ESSAY = {'), app.indexOf('};', app.indexOf('P.ESSAY = {')));
const essayMap = Object.fromEntries([...essayBlock.matchAll(/'([a-z]+\/[a-z]+)': \['([\w-]+)', /g)].map((m) => [m[1], m[2]]));
for (const [anchor, , route] of D.pccMap) {
  ok(navRoutes.has(route), `pccMap: route ${route} is not a Command Center page`);
  ok(essayMap[route] === anchor, `Command Center page ${route} must link back to #${anchor} (P.ESSAY)`);
  ok(new RegExp(`id="${anchor}"`).test(html), `pccMap: #${anchor} is not in the essay`);
}
for (const [route, anchor] of Object.entries(essayMap)) ok(D.pccMap.some((m) => m[2] === route && m[0] === anchor), `P.ESSAY has ${route} → #${anchor}, which data.js pccMap lacks`);
for (const m of html.matchAll(/href="\/privacy-command-center\/#\/([a-z]+\/[a-z]+)"/g)) ok(navRoutes.has(m[1]), `essay links to Command Center route ${m[1]}, which does not exist`);
ok(pcc.persona.name === 'Dana', 'the Command Center’s One Person should be Dana, the essay’s person');

/* ── 6 · one vocabulary: Northstar names the essay uses exist in the dataset ── */
const names = new Set([...pcc.vendors.map((v) => v.name), ...pcc.products.map((p) => p.name), ...pcc.subprocessors.map((s) => s.name.replace(/ \(.*\)$/, '')), ...pcc.systems.map((s) => s.name), ...pcc.models.map((m) => m.name)]);
for (const n of ['HelpHub CRM', 'MailPost', 'AdReach Network', 'Lumen Model API', 'GeoGrid SDK', 'PixelPeak', 'SignalRisk', 'Pulse', 'Nova Assistant', 'Northstar Messenger', 'Audience Builder', 'LLMCo summariser'])
  ok(names.has(n), `the essay names "${n}", which is not in the Northstar dataset`);
for (const inc of D.monitors.flatMap((m) => m.catches)) ok(pcc.incidents.some((i) => i.id === inc), `monitor catches ${inc}, which is not a Northstar incident`);
for (const f of NS.persona.facts) ok(['provided', 'observed', 'derived', 'inferred'].includes(f.origin), `persona fact "${f.a}" has no origin`);

/* ── 7 · sourcing and labels ─────────────────────────────────────── */
for (const m of html.matchAll(/<span class="lab lab--([\w-]+)">/g)) ok(['real', 'hist', 'model', 'syn', 'ill', 'anec', 'law'].includes(m[1]), `unknown label lab--${m[1]}`);
/* a "Real case" field note or case card must carry a citation */
for (const m of html.matchAll(/<div class="case-c">([\s\S]*?)<\/div>/g)) if (/Real case/.test(m[1])) ok(/data-src=/.test(m[1]), `a real-case card has no citation: ${m[1].replace(/<[^>]+>/g, '').slice(0, 60)}`);
ok(/Golle/.test(html) && /63%/.test(html), 'the 87% re-identification figure must carry its caveat (Golle, ~63%)');
ok(/Anecdote/.test(html.slice(html.indexOf('iDVD') - 400, html.indexOf('iDVD') + 800)), 'the iDVD “Burn” story must be labelled an anecdote');
ok(!/#1 place/.test(html + read('articles/every-arrow/trails.js')), 'unsourced superlative (“#1 place”) is back');
ok(!/remembers everything\./.test(html.replace(/The AI remembers everything\./g, '')), '“AI remembers everything” appears outside the quoted myth');
ok(/no verification guarantee/.test(html), 'the unlearning limitation is missing');
ok(/every copy, backups included, was encrypted/.test(html), 'the crypto-shredding caveat is missing');
ok(/does not predict harm/.test(html), 'the worst-day index must say it does not predict harm');

/* ── 8 · storage keys are registered ─────────────────────────────── */
const keys = read('data/platform/state-keys.json');
for (const m of (read('articles/every-arrow/core.js') + html).matchAll(/localStorage\.(?:get|set)Item\("([\w.]+)"/g)) ok(keys.includes(`"${m[1]}"`), `storage key ${m[1]} is not in data/platform/state-keys.json`);
ok(keys.includes('"ea.path.v1"'), 'ea.path.v1 is not registered in data/platform/state-keys.json');

if (fails.length) { console.error(fails.map((f) => '✗ ' + f).join('\n')); console.error(`\n${fails.length} failed, ${passed} passed`); process.exit(1); }
console.log(`✓ every-arrow structure: ${passed} checks passed (${figs.length} figures, ${scenes.length} scenes)`);
