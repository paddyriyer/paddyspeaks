/* One privacy model, two experiences: the Command Center side.
 *
 * articles/every-arrow/shared.js is what the essay and the Command Center agree
 * on. The essay's side is checked by articles/every-arrow/tests/edition4.mjs;
 * this file checks that every shared link, phrase and question opens a view
 * here that answers it, that documented and synthetic content never mix, and
 * that a recommended test is never shown as a result. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const load = (f, n) => { const c = {}; c.window = c; vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), c); return c[n]; };
const X = load('articles/every-arrow/shared.js', 'EA_SHARED');
const C = load('articles/every-arrow/compare.js', 'EA_CMP');
const clean = (p, what, assert) => assert(!p.errors.length, what + ': page errors ' + p.errors.join(' | '));
const text = (p) => p.evaluate(() => document.getElementById('main').innerText.replace(/\s+/g, ' '));
const PAGES = ['#cc', '#products', '#everyday', '#layers', '#sensors', '#future', '#ai', '#reviews', '#evidence', '#ask'];

export default [
  { name: 'sync: the twenty questions both properties answer each open a view here that answers them', async run({ page, assert }) {
    assert(X.sync.length === 20, 'twenty questions');
    for (const q of X.sync) {
      const p = await page(q.app);
      const t = await text(p), err = await p.evaluate(() => !!document.querySelector('.err'));
      clean(p, q.app, assert); await p.closeAll();
      assert(!err, `${q.q}: ${q.app} could not be drawn`);
      assert(t.toLowerCase().includes(q.ak.toLowerCase()), `${q.q}: ${q.app} must show “${q.ak}”`);
    }
  } },
  { name: 'sync: the twenty ambient questions (whose data, which sensor, what left, what survived) each open a view that answers them', async run({ page, assert }) {
    assert(X.syncAmbient.length === 20, 'twenty ambient questions');
    for (const q of X.syncAmbient) {
      const p = await page(q.app);
      const t = await text(p), err = await p.evaluate(() => !!document.querySelector('.err'));
      clean(p, q.app, assert); await p.closeAll();
      assert(!err, `${q.q}: ${q.app} could not be drawn`);
      assert(t.toLowerCase().includes(q.ak.toLowerCase()), `${q.q}: ${q.app} must show “${q.ak}”`);
    }
  } },
  { name: 'sensors: sensed is not collected; the four designs change what leaves, the data subject is not the owner, and a test is never a result', async run({ page, assert }) {
    const leave = {};
    for (const alt of ['A', 'B', 'C', 'D']) {
      const p = await page('#sensors?sm=cafe&alt=' + alt);
      leave[alt] = await p.evaluate(() => [...document.querySelectorAll('.m-obs tbody tr')].map((r) => [r.querySelector('th').textContent, r.querySelector('.ss').textContent]));
      clean(p, 'cafe ' + alt, assert); await p.closeAll();
    }
    const tx = (alt) => leave[alt].filter((r) => r[1] === 'Transmitted').map((r) => r[0]);
    assert(tx('A').includes('The barista’s face') && !tx('B').includes('The barista’s face') && !tx('C').includes('The menu') && tx('D').length === 0, 'A sends faces, B crops them away, C sends no image, D sends nothing: ' + JSON.stringify({ A: tx('A'), B: tx('B'), C: tx('C') }));
    const states = new Set(Object.values(leave).flat().map((r) => r[1]));
    assert(['Ephemeral on device', 'Transmitted', 'Derived only', 'Unknown'].every((s) => states.has(s)) && !states.has('Collected'), 'explicit states, never “collected”: ' + [...states]);
    const room = await page('#sensors?sm=room');
    const r = await room.evaluate(() => ({ t: document.getElementById('main').innerText, runs: [...document.querySelectorAll('.fat .qs')].map((x) => x.textContent), unk: document.querySelectorAll('#dnH ~ .five .eb-unk').length }));
    clean(room, 'room', assert); await room.closeAll();
    assert(/Device owner\s*The host/i.test(r.t) && /Data subject\s*Guest B/i.test(r.t), 'the owner and the data subject are different people');
    assert(r.runs.length === 4 && r.runs.every((x) => x === 'NOT RUN'), 'the false activation test is shown as not run');
    assert(r.unk >= 3, 'what the architecture does not establish is UNKNOWN');
    const f = await page('#sensors?sm=forget');
    const o = await f.evaluate(() => { const before = document.querySelector('.rsum').innerText; document.querySelector('[data-drv="transcript"]').click(); return { before, after: document.querySelector('.rsum').innerText }; });
    clean(f, 'forget', assert); await f.closeAll();
    assert(/6 derivatives survive/.test(o.before) && /5 derivatives survive/.test(o.after), 'deleting the audio leaves six derivatives; reaching the transcript leaves five: ' + JSON.stringify(o));
    const g = await page('#sensors?sm=gap');
    const aw = await g.evaluate(() => [...document.querySelectorAll('.aw')].map((x) => x.textContent));
    clean(g, 'gap', assert); await g.closeAll();
    assert(aw.includes('Unclear') && aw.includes('Not applicable') && aw.includes('Clear'), 'awareness has its own states, and consent is not assessed: ' + aw);
  } },
  { name: 'sensors: “Whose data?” highlights flows about people other than the owner, across the room, the morning and the events graph', async run({ page, assert }) {
    const a = await page('#everyday?et=amb&by=1&ds=employees');
    const r = await a.evaluate(() => ({ hit: [...document.querySelectorAll('.ambl > li.ds-hit b')].map((b) => b.textContent), people: document.querySelectorAll('.bp').length }));
    clean(a, 'amb', assert); await a.closeAll();
    assert(r.hit.join() === 'The doorbell sees a delivery,Buy a coffee' && r.people >= 8, 'employees: the delivery and the coffee; every bystander shown: ' + JSON.stringify(r));
    const e = await page('#everyday?ds=contacts&e=m3');
    const g = await e.evaluate(() => ({ hit: document.querySelectorAll('#eg .ds-hit').length, note: document.getElementById('dsnote').innerText }));
    clean(e, 'graph', assert); await e.closeAll();
    assert(g.hit >= 1 && /concern contacts/.test(g.note), 'the events graph highlights records about contacts: ' + JSON.stringify(g));
    const c = await page('#sensors?sm=cafe&alt=A&ds=bystanders');
    const n = await c.evaluate(() => document.querySelectorAll('.m-obs tr.ds-hit').length);
    clean(c, 'cafe bystanders', assert); await c.closeAll();
    assert(n >= 4, 'the café highlights the barista, the customers, the screen and the phones: ' + n);
  } },
  { name: 'sync: every shared phrase is shown, word for word, where shared.js says the Command Center shows it', async run({ page, assert }) {
    for (const ph of X.phrases) {
      const p = await page(ph.app);
      const t = await text(p);
      clean(p, ph.app, assert); await p.closeAll();
      if (ph.id === 'decision') continue;   /* the title of both properties; the Command Center says it in its essay link */
      assert(t.toLowerCase().includes(ph.t.replace(/\.$/, '').toLowerCase()), `“${ph.t}” must appear at ${ph.app}`);
    }
  } },
  { name: 'sync: every essay link (?view=…) lands on a real view, and the essay’s eight products are the Products view', async run({ page, assert }) {
    const links = Object.values(X.sections).map((s) => s.app).concat(X.links, C.products.map((p) => '?view=product&product=' + p.id), ['?view=ai&mode=agent', '?view=ecosystems', '?view=future&mode=hold', '?view=journey&event=ask-flight&connect=1', '?view=layers&hop=tls']);
    for (const u of links) {
      const p = await page(u);
      const r = await p.evaluate(() => ({ hash: location.hash, search: location.search, err: !!document.querySelector('.err'), cur: (document.querySelector('.nav a[aria-current]') || {}).textContent }));
      clean(p, u, assert); await p.closeAll();
      assert(!r.err && !r.search && /^#(products|layers|sensors|everyday|future|ai|reviews|evidence)/.test(r.hash), `${u} → ${r.hash} (${r.cur})`);
    }
    const p = await page('#products');
    const r = await p.evaluate(() => [...document.querySelectorAll('[data-pr]')].map((b) => b.getAttribute('data-pr')));
    clean(p, 'products', assert); await p.closeAll();
    assert(JSON.stringify(r) === JSON.stringify(C.products.map((x) => x.id)), 'the eight products, in the essay’s order');
  } },
  { name: 'sync: Products shows only cited claims, the arrow to watch, and a synthetic arrow that never mixes with them', async run({ page, assert }) {
    for (const pr of C.products) {
      const p = await page('#products?pr=' + pr.id + '&fa=1');
      const r = await p.evaluate(() => ({
        claims: document.querySelectorAll('.clm .cl').length, kinds: [...document.querySelectorAll('.clm .cl .eb')].map((b) => b.textContent),
        docBand: !!document.querySelector('.clm .band-doc'), synInClaims: !!document.querySelector('.clm .band-syn'),
        follow: !!document.querySelector('.fol .band-syn'), docInFollow: !!document.querySelector('.fol .band-doc'),
        hot: [...document.querySelectorAll('.parrow li')].findIndex((li) => li.classList.contains('hot')),
        untested: [...document.querySelectorAll('.cl-test')].every((li) => /Nobody has run it/.test(li.innerText)),
        uncited: [...document.querySelectorAll('.clm .cl:not(.cl-test)')].filter((li) => !li.querySelector('.src a')).length,
        synth: (document.querySelector('.fol a.btn') || {}).getAttribute ? document.querySelector('.fol a.btn').getAttribute('href') : ''
      }));
      clean(p, pr.id, assert); await p.closeAll();
      const want = pr.cos.reduce((n, co) => n + ['sec', 'pri', 'qa', 'gov'].reduce((m, l) => m + pr.cells[co][l].length, 0), 0);
      assert(r.claims === want, `${pr.id}: ${r.claims} claims shown, compare.js has ${want}`);
      assert(r.docBand && !r.synInClaims && r.follow && !r.docInFollow, `${pr.id}: documented and synthetic stay apart, each in its band`);
      assert(r.hot === pr.hot, `${pr.id}: the arrow to watch is hop ${pr.hot}`);
      assert(r.untested && r.uncited === 0, `${pr.id}: tests say they were not run; every other claim is cited`);
      assert(r.synth === X.products[pr.id].synth, `${pr.id}: the synthetic version opens ${X.products[pr.id].synth}`);
      assert(r.kinds.every((k) => ['Documented', 'Setting', 'Limit', 'Test'].includes(k)), `${pr.id}: only the essay’s labels`);
    }
  } },
  { name: 'sync: a recommended test is never shown as a result, anywhere', async run({ page, assert }) {
    const p = await page('#reviews?rv=qa');
    const r = await p.evaluate(() => ({ essayTests: document.querySelectorAll('#etH ~ .cls .cl-test').length, status: document.querySelector('#etH + p').innerText, statuses: [...document.querySelectorAll('.tt .qs')].map((x) => x.textContent) }));
    clean(p, 'qa', assert); await p.closeAll();
    const want = C.products.reduce((n, pr) => n + pr.cos.reduce((m, co) => m + ['sec', 'pri', 'qa', 'gov'].reduce((k, l) => k + pr.cells[co][l].filter((it) => it[0] === 'test').length, 0), 0), 0);
    assert(r.essayTests === want && /NOT RUN/.test(r.status) && /nobody has run them/.test(r.status), `the essay's ${want} tests are listed as not run: ${r.essayTests}`);
    assert(r.statuses.length === 14 && r.statuses.every((s) => ['PASS', 'FAIL', 'NOT RUN', 'UNKNOWN'].includes(s)), 'fourteen templates, each PASS, FAIL, NOT RUN or UNKNOWN: ' + r.statuses);
    const e = await page('#evidence?ev=claims');
    const t = await e.evaluate(() => ({ tests: [...document.querySelectorAll('.cl-test')].map((li) => li.innerText), legend: [...document.querySelectorAll('.evlg .eb')].map((b) => b.textContent) }));
    clean(e, 'claims', assert); await e.closeAll();
    assert(t.tests.length === want && t.tests.every((x) => /Nobody has run it/.test(x) && !/PASS|FAIL/.test(x)), 'documented claims: every test is a recommendation');
    assert(JSON.stringify(t.legend) === JSON.stringify(['Documented', 'Setting', 'Limit', 'Test', 'Unknown']), 'the evidence labels: ' + t.legend);
  } },
  { name: 'sync: the four-lens review asks the essay’s twenty-eight questions and turns unknowns into findings, not defects', async run({ page, assert }) {
    const p = await page('#reviews?rv=lens');
    const r = await p.evaluate(() => {
      const qs = [...document.querySelectorAll('.rvl li > p')].map((x) => x.textContent);
      document.querySelector('[data-ra="qa3"][data-av="unk"]').click();
      document.querySelector('[data-ra="security2"][data-av="no"]').click();
      document.querySelector('[data-ra="gov5"][data-av="ev"]').click();
      return { qs, out: document.getElementById('rvo').innerText, tags: [...document.querySelectorAll('#rvo .tag')].map((t) => t.textContent) };
    });
    clean(p, 'review', assert); await p.closeAll();
    const want = ['security', 'privacy', 'qa', 'gov'].flatMap((l) => X.review[l]);
    assert(JSON.stringify(r.qs) === JSON.stringify(want), 'the twenty-eight questions, in order');
    assert(r.tags.includes('UNKNOWN') && r.tags.includes('RISK') && r.tags.includes('DESIGN QUESTION') && r.tags.includes('DECISION'), 'unknown, risk, design question and decision: ' + r.tags);
    assert(/Unknown is a finding, not a verdict/.test(r.out) && /Evidence needed/.test(r.out) && /Follow-up tests/.test(r.out) && /None has been run/.test(r.out), 'findings, decisions, evidence needed and follow-up tests');
  } },
  { name: 'sync: Future never offers to decrypt a hash; AI shows which risks lack the control they need', async run({ page, assert }) {
    const p = await page('#future?tf=hash');
    const r = await p.evaluate(() => ({ t: document.getElementById('main').innerText, decrypt: [...document.querySelectorAll('button')].filter((b) => /decrypt/i.test(b.textContent)).length, rows: document.querySelectorAll('.m-fut tbody tr').length }));
    clean(p, 'future', assert); await p.closeAll();
    assert(/Reversible: no/i.test(r.t) && r.decrypt === 0 && /One-way does not necessarily mean unlinkable/.test(r.t), 'hashing: not reversible, no decrypt action, matchable');
    assert(r.rows === 8, 'eight transformations');
    const a = await page('#ai');
    const o = await a.evaluate(() => {
      const open = () => [...document.querySelectorAll('.rk.open b')].map((b) => b.textContent);
      const before = open(); document.querySelector('[data-aic="approval"]').click();
      return { before, after: open() };
    });
    clean(a, 'ai', assert); await a.closeAll();
    assert(o.before.includes('Autonomous action') && !o.after.includes('Autonomous action'), 'human approval closes autonomous action: ' + JSON.stringify(o));
  } },
  { name: 'sync: ask privacy answers the shared questions and labels documented claims, settings, limits and tests', async run({ page, assert }) {
    const p = await page('#ask?ask=' + encodeURIComponent('What evidence proves this claim?'));
    const tags = await p.evaluate(() => [...document.querySelectorAll('.ans .tag')].map((t) => t.textContent));
    clean(p, 'ask', assert); await p.closeAll();
    for (const k of ['DOCUMENTED', 'SETTING', 'LIMIT', 'TEST', 'UNKNOWN']) assert(tags.includes(k), 'evidence answer carries ' + k + ': ' + tags);
    for (const q of ['Who can observe this request before it reaches the service?', 'What survives after TLS terminates?', 'Can this hash be reversed?', 'What inference does this join create?', 'What tools can this AI agent call?', 'Which control stops being true at the next layer?']) {
      const a = await page('#ask?ask=' + encodeURIComponent(q));
      const r = await a.evaluate(() => ({ h: (document.querySelector('.ans h2') || {}).textContent, n: document.querySelectorAll('.ans .al').length }));
      clean(a, q, assert); await a.closeAll();
      assert(r.h === q && r.n >= 2, q + ' → ' + r.h);
    }
  } },
  { name: 'one click, one redraw: no view piles up listeners across renders (2026-10-05 incident)', async run({ page, assert }) {
    /* every view, two controls clicked back and forth: the redraws per click must stay flat */
    const cases = [['#products', '[data-pr="browser"]', '[data-pr="mail"]'], ['#layers', '.m-hops [data-hop="tls"]', '.m-hops [data-hop="dns"]'], ['#sensors', '[data-sf="camera"]', '[data-sf="network"]'],
      ['#sensors?sm=room', '[data-hop2="mic"]', '[data-hop2="log"]'], ['#future', '[data-tf="hash"]', '[data-tf="token"]'], ['#ai', '[data-rk="inject"]', '[data-rk="memory"]'], ['#reviews', '[data-rv="qa"]', '[data-rv="lens"]'],
      ['#everyday?e=m8', '[data-connect]', '[data-connect]'], ['#everyday?et=amb', '[data-by]', '[data-by]'], ['#evidence?ev=claims', '[data-kind="doc"]', '[data-kind="test"]'], ['#cc', '.refine [data-l="qa"]', '.refine [data-l="gov"]']];
    const bad = [];
    for (const [route, a, b] of cases) {
      const p = await page(route);
      await p.evaluate(() => { window.__r = 0; new MutationObserver(() => window.__r++).observe(document.getElementById('main'), { childList: true }); });
      const per = [];
      for (let i = 0; i < 8; i++) { await p.click(i % 2 ? b : a); await p.waitForTimeout(30); per.push(await p.evaluate(() => { const x = window.__r; window.__r = 0; return x; })); }
      clean(p, route, assert); await p.closeAll();
      if (Math.max.apply(null, per) > 1) bad.push(route + ': redraws per click ' + per.join(','));
    }
    assert(!bad.length, 'a click redraws more than once (listeners piling up):\n' + bad.join('\n'));
  } },
  { name: 'pop-ups open inside the window at every width (2026-10-05: the Views menu opened off the left edge)', async run({ page, assert }) {
    const bad = [];
    for (const route of ['#cc', '#sensors', '#everyday']) {
      for (const width of [1440, 1100, 1000, 900, 760, 600, 390]) {
        const p = await page(route, { width });
        for (const [btn, pop] of [['#vmBtn', '#vmPop'], ['#selC', '#msPop']]) {
          if (!(await p.$(btn))) continue;
          await p.click(btn);
          const r = await p.evaluate((sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { l: b.left, r: b.right, w: b.width, W: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth }; }, pop);
          if (!r.w || r.l < 0 || r.r > r.W || r.sw > r.W + 1) bad.push(route + '@' + width + ' ' + pop + ': [' + Math.round(r.l) + ', ' + Math.round(r.r) + '] in a ' + r.W + 'px window, page ' + r.sw + 'px wide');
          await p.keyboard.press('Escape');
        }
        clean(p, route + '@' + width, assert); await p.closeAll();
      }
    }
    assert(!bad.length, 'a pop-up opens outside the window:\n' + bad.join('\n'));
  } },
  { name: 'sync: every view fits a phone and passes axe (no serious or critical issue)', async run({ page, assert }) {
    const req = createRequire(path.join(process.env.A11Y_DEPS || process.cwd(), 'noop.js'));
    const AXE = fs.readFileSync(req.resolve('axe-core/axe.min.js'), 'utf8');
    const bad = [];
    for (const h of PAGES.concat(['#products?pr=mail&fa=1', '#layers?hop=tls', '#future?tf=hold', '#ai?rk=inject', '#reviews?rv=qa&tt=consent', '#reviews?rv=gov', '#reviews?rv=changes', '#everyday?et=eco', '#everyday?e=m8&connect=1', '#evidence?ev=claims', '#sensors?sm=cafe&alt=C&ds=bystanders', '#sensors?sm=room', '#sensors?sm=forget', '#sensors?sm=gap&aw=doorbell', '#sensors?sm=attack&dev=glasses', '#sensors?sm=home', '#everyday?et=amb&by=1&ds=employees', '#everyday?ds=contacts&e=m3', '#products?pr=wearable&fa=1'])) {
      for (const width of [1280, 390]) {
        const p = await page(h, { width });
        await p.addScriptTag({ content: AXE });
        const r = await p.evaluate(async () => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth,
          v: (await window.axe.run(document.getElementById('main'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] })).violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => x.id + ' ×' + x.nodes.length + ' ' + x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')) }));
        clean(p, h + '@' + width, assert); await p.closeAll();
        if (r.sw > r.w + 1) bad.push(h + '@' + width + ': page scrolls sideways (' + r.sw + ' > ' + r.w + ')');
        r.v.forEach((x) => bad.push(h + '@' + width + ': ' + x));
      }
    }
    assert(!bad.length, bad.join('\n'));
  } }
];
