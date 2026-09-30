#!/usr/bin/env node
/**
 * Every Arrow Is a Decision, EDITION 3 (archived at articles/every-arrow/edition-3.html) —
 * structure test (no browser, no network). Edition 4 is tested by tests/edition4.mjs.
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
const html = read('articles/every-arrow/edition-3.html');
const fails = [];
let passed = 0;
function ok(cond, msg) { if (cond) passed++; else fails.push(msg); }
function load(files) { const c = { console }; c.window = c; vm.createContext(c); files.forEach((f) => vm.runInContext(read(f), c, { filename: f })); return c; }
const ctx = load(['articles/every-arrow/northstar.js', 'articles/every-arrow/data.js', 'articles/every-arrow/trails.js']);
const D = ctx.EA_DATA, NS = ctx.EA_NS, T = ctx.EA_TRAILS;
const pcc = load(['privacy-command-center/v10/data.js', 'privacy-command-center/v10/data-life.js']).NS;

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
const registered = new Set([...read('articles/every-arrow/figures.js').matchAll(/EA\.fig\('([\w-]+)'/g), ...read('articles/every-arrow/figures2.js').matchAll(/EA\.fig\('([\w-]+)'/g), ...read('articles/every-arrow/house.js').matchAll(/EA\.fig\('([\w-]+)'/g)].map((m) => m[1]));
for (const r of registered) ok(ids.includes(r), `figures.js registers "${r}" but the essay has no fig-${r}`);
for (const id of ids) if (!id.startsWith('trail-')) ok(registered.has(id), `fig-${id} has no controller in figures.js / figures2.js / house.js`);

/* ── 2 · scenes, chapters, paths ─────────────────────────────────── */
const scenes = [...html.matchAll(/<section class="scene[^"]*" id="([\w-]+)"[^>]*data-title="([^"]+)"/g)];
ok(scenes.length === 31, `expected 31 scenes, found ${scenes.length}`);
for (const [, id] of scenes) {
  const sec = html.slice(html.indexOf(`id="${id}"`), html.indexOf('</section>', html.indexOf(`id="${id}"`)));
  ok(/<div class="brief x">/.test(sec), `#${id}: no executive brief`);
  ok(/<div class="scene-body">/.test(sec), `#${id}: no scene body`);
  ok(/class="takeaway"/.test(sec), `#${id}: no takeaway`);
  ok(new RegExp(`href="#${id}"`).test(html), `#${id}: not in the table of contents`);
}
const chapters = [...html.matchAll(/<div class="chapter[^"]*" id="(\w+)" data-title="([^"]+)"/g)].map((m) => m[1]);
ok(chapters.join() === 'see,decide,build,prove,house,kit', `chapters should be see,decide,build,prove,house,kit — got ${chapters}`);
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
ok([...(stamps.chapters || [])][0] === '6', 'displayed chapter count is not 6');
const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
ok(ld.datePublished === '2026-09-26' && /article:published_time" content="2026-09-26"/.test(html) && /datetime="2026-09-26"/.test(html), 'publication date disagrees between JSON-LD, meta and byline');
ok(ld.dateModified === /article:modified_time" content="([\d-]+)"/.exec(html)[1], 'modified date disagrees between JSON-LD and meta');
ok(ld.timeRequired === `PT${[...stamps['read.full']][0]}M`, 'JSON-LD timeRequired disagrees with the displayed reading time');
ok(/<meta name="robots" content="noindex, follow">/.test(html), 'the archived edition must be noindex');
ok(/<link rel="canonical" href="https:\/\/paddyspeaks\.com\/articles\/every-arrow\/edition-3\.html">/.test(html), 'the archived edition is canonical to its own URL');
ok(/class="archive-note"[\s\S]{0,600}href="\/articles\/every-arrow-is-a-decision\.html"/.test(html), 'the archived edition points readers to the current edition');
const pdf = JSON.parse(read('articles/every-arrow/edition-3.pdf.json'));
ok(String(pdf.pages) === [...stamps['pdf.pages']][0], 'the displayed PDF page count disagrees with pdf.json');
ok(fs.existsSync(path.join(ROOT, 'articles/every-arrow/edition-3.pdf')), 'the printable PDF is missing');
ok(fs.existsSync(path.join(ROOT, 'articles/every-arrow/field-kit.md')), 'the field kit download is missing');

/* ── 4 · old deep links still land ───────────────────────────────── */
for (const a of ['job', 's01', 's02', 's02b', 's03', 's04', 's05', 's06', 's07', 'sBurn', 's08', 's09', 's10', 's11', 's12', 's13', 'cc-debug', 'cc-csv', 'cc-family', 'cc-optout', 'cc-forget', 'cc-auth'])
  ok(new RegExp(`id="${a}"`).test(html), `legacy anchor #${a} is gone — old links to it would break`);
for (const t of pcc.assumptionTests) if (t.essay) ok(new RegExp(`id="${t.essay}"`).test(html), `Command Center links to #${t.essay}, which the essay no longer has`);

/* ── 5 · the Command Center, in both directions ─────────────────── */
const app = read('privacy-command-center/v10/app.js');
const navBlock = app.slice(app.indexOf('P.NAV = ['), app.indexOf('];', app.indexOf('P.NAV = [')));
const navRoutes = new Set([...navBlock.matchAll(/\['([a-z]+(?:\/[a-z]+)?)', '/g)].map((m) => m[1]));
const navLabel = Object.fromEntries([...navBlock.matchAll(/\['([a-z]+(?:\/[a-z]+)?)', '([^']+)'\]/g)].map((m) => [m[1], m[2]]));
const essayBlock = app.slice(app.indexOf('P.ESSAY = {'), app.indexOf('};', app.indexOf('P.ESSAY = {')));
const essayMap = Object.fromEntries([...essayBlock.matchAll(/'([a-z]+(?:\/[a-z]+)?)': \['([\w-]+)', /g)].map((m) => [m[1], m[2]]));
for (const [anchor, , route] of D.pccMap) {
  ok(navRoutes.has(route), `pccMap: route ${route} is not a Command Center page`);
  ok(navLabel[route] === D.pccMap.find((m) => m[2] === route)[3], `pccMap: ${route} is called “${navLabel[route]}” in the Command Center, not “${D.pccMap.find((m) => m[2] === route)[3]}”`);
  ok(essayMap[route] === anchor, `Command Center page ${route} must link back to #${anchor} (P.ESSAY)`);
  ok(new RegExp(`id="${anchor}"`).test(html), `pccMap: #${anchor} is not in the essay`);
}
for (const [route, anchor] of Object.entries(essayMap)) ok(D.pccMap.some((m) => m[2] === route && m[0] === anchor), `P.ESSAY has ${route} → #${anchor}, which data.js pccMap lacks`);
for (const m of html.matchAll(/href="\/privacy-command-center\/v10\/#\/([a-z]+(?:\/[a-z]+)?)">In the Command Center: <b>([^<]+)<\/b>/g)) { ok(navRoutes.has(m[1]), `essay links to Command Center route ${m[1]}, which does not exist`); ok(navLabel[m[1]] === m[2].replace(/&amp;/g, '&'), `essay calls ${m[1]} “${m[2]}”; the Command Center calls it “${navLabel[m[1]]}”`); }
for (const m of html.matchAll(/href="\/privacy-command-center\/v10\/#\/([a-z]+(?:\/[a-z]+)?)"/g)) ok(navRoutes.has(m[1]), `essay links to Command Center route ${m[1]}, which does not exist`);
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


/* ── 9 · chapter 5, the house is a data system ──────────────────── */
{
  const L = NS.life;
  ok(!!L, 'northstar.js carries the household (EA_NS.life) from data-life.js');
  ok(L.chain.map((c) => c[1]).join(' → ') === 'Person → Household → Place → Device → Sensor → Account → Network → Cloud → Integration → Vendor → Inference → Automation → Physical action', 'the enlarged graph has the thirteen links in order');
  ok(L.questions.length === 14, 'every arrow answers fourteen questions');
  ok(L.roles.map((r) => r[1]).join('|') === 'Device owner|Administrator|Data subject|Household member|Guest|Bystander|Installer|Vendor operator', 'the eight household roles');
  ok(L.capabilities.length === 10, 'the physical-action register covers ten capabilities');
  for (const a of L.arrows) for (const q of L.questions) ok(q[0] in a, `arrow ${a.id} has no field for “${q[1]}” (use null for UNKNOWN)`);
  const chap = html.slice(html.indexOf('<div class="chapter" id="house"'), html.indexOf('<div class="chapter kit"'));
  const want = ['home', 'guest', 'door', 'routine', 'network', 'infer', 'oldkeys'];
  for (const id of want) {
    const m = new RegExp(`<section class="scene[^"]*" id="${id}"[\\s\\S]*?</section>`).exec(chap);
    ok(!!m, `chapter 5 scene #${id} is missing`);
    if (!m) continue;
    const b = m[0];
    ok(/class="brief x"/.test(b), `#${id}: no brief`);
    ok(/<div class="lede">/.test(b), `#${id}: no human moment (.lede)`);
    ok(/<dt>The control<\/dt>/.test(b) && /<dt>The evidence<\/dt>/.test(b), `#${id}: no control and evidence`);
    ok(/class="pcc-link"><a href="\/privacy-command-center\/v10\/#\/life\//.test(b), `#${id}: no Connected Life link`);
    ok(/class="takeaway"/.test(b), `#${id}: no takeaway`);
  }
  for (const line of ['Alexa does not need to whisper to Siri', 'The identity graph can introduce them', 'When software controls a door', 'privacy architecture becomes physical architecture', 'The network may not read every letter'])
    ok(chap.includes(line), `chapter 5 is missing the line “${line}”`);
  ok(/none of the documented paths below requires one company&rsquo;s assistant to hand a recording/.test(chap), 'chapter 5 must say plainly that the join paths do not need assistants to share recordings');
  ok(!/(assistants?|Alexa|Siri|Google Assistant)[^.<]{0,80}\b(share|shares|exchange|exchanges|swap|swaps|send|sends)\s+(their\s+)?(voice\s+)?recordings\s+(with|to)\s+(each other|one another|competitors?)/i.test(html), 'the essay must not claim competing assistants share recordings');
  const coda = html.slice(html.indexOf('id="coda"'), html.indexOf('</section>', html.indexOf('id="coda"')));
  const lines = [...coda.matchAll(/<li[^>]*>([^<]+)<\/li>/g)].map((m) => m[1].trim());
  ok(lines.join(' | ') === 'Some arrows copy data. | Some arrows create an identity. | Some arrows make an inference. | And some arrows open the door. | Every arrow is still a decision.', 'the essay ends with the five closing lines, in order: ' + lines.join(' | '));
  ok(/A person does not live inside one application\. They move through rooms, devices, networks, vehicles, accounts and relationships\. Privacy engineering must follow them across all of those boundaries\./.test(coda), 'the final thesis sentence is in the coda');
  ok(L.solutions.length === 10, 'ten engineering answers');
  for (const x of L.solutions) ok(new RegExp(`id="${x.essay}"`).test(html), `engineering answer ${x.id} points at #${x.essay}, which is not in the essay`);
  const sol = /data-static="solutions"[^>]*>([\s\S]*?)<!-- \/static:solutions -->/.exec(html);
  ok(sol && (sol[1].split('<tbody>')[1].match(/<tr[ >]/g) || []).length === L.solutions.length, 'the solutions table lists every engineering answer');
  const pccL = pcc.life;
  ok(pccL && JSON.stringify(pccL.chain) === JSON.stringify(L.chain), 'essay and Command Center read the same household (regenerate northstar.js)');
}

/* ── 10 · one account, one life: fair to every ecosystem, same records as the Command Center ── */
{
  const hs = load(['articles/every-arrow/northstar.js', 'articles/every-arrow/sources.js', 'articles/every-arrow/house.js']).EA_HOUSE;
  const g = load(['privacy-command-center/graph.js']).PG;
  const strip = (t) => t.map((x) => ({ id: x.id, label: x.label, how: x.how, gets: x.gets, mfa: x.mfa, control: x.control, evidence: x.evidence, after: x.after, residual: x.residual }));
  ok(JSON.stringify(hs.account.surfaces) === JSON.stringify(g.oneLife.surfaces) && JSON.stringify(hs.account.joins) === JSON.stringify(g.oneLife.joins), 'the essay and the Command Center disagree about what one account joins');
  ok(JSON.stringify(strip(hs.account.attackers)) === JSON.stringify(strip(g.takeover)), 'the essay and the Command Center disagree about the four attackers');
  const sc = /<section class="scene" id="account"[\s\S]*?<\/section>/.exec(html);
  ok(!!sc, 'scene #account is missing');
  if (sc) {
    const b = sc[0];
    ok(/class="brief x"/.test(b) && /<div class="lede">/.test(b) && /class="takeaway"/.test(b), '#account: brief, lede and takeaway');
    ok(/href="\/privacy-command-center\/#cc\?[^"]*q=stolen/.test(b), '#account: links to the Command Center view');
    ok(!/never leaves (the|your) device/i.test(b.replace(/often summarised as &ldquo;your data never leaves the device&rdquo;\. That is not what Apple says\./, '')), '#account: do not attribute “never leaves the device” to Apple');
    ok(/That is not what Apple says/.test(b), '#account: correct the “never leaves the device” summary');
    ok(!/(reads?|scans?) (her |your )?(Gmail|mail) (content )?(for|to show) ads/i.test(b) && /not been used to personalise ads since 2017/.test(b), '#account: Gmail content is not used for ads (since 2017)');
    ok(/since November 2025 US users can choose/.test(b) && /off unless they turn it on/.test(b), '#account: Wallet ad use is US, opt-in, since Nov 2025');
    ok(/applies to both/.test(b), '#account: the join-key risk applies to both ecosystems');
    ok(/working around it within months/.test(b), '#account: cookie encryption is not presented as a complete fix');
    ok(/as KrebsOnSecurity reported/.test(b), '#account: MFA bombing is attributed to its reporter, not to Apple');
  }
}

if (fails.length) { console.error(fails.map((f) => '✗ ' + f).join('\n')); console.error(`\n${fails.length} failed, ${passed} passed`); process.exit(1); }
console.log(`✓ every-arrow structure: ${passed} checks passed (${figs.length} figures, ${scenes.length} scenes)`);
