/* Privacy Command Center v1: one graph, many lenses.
 * Each test drives the real page. Expected values are recomputed from the graph
 * (window.PG) rather than copied from the view, so a test fails when the view
 * and the data disagree. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clean = (p, what, assert) => assert(!p.errors.length, what + ': page errors ' + p.errors.join(' | '));
const H = (o) => '#cc?' + Object.entries(o).map(([k, v]) => k + '=' + v).join('&');

export default [
  { name: 'the first screen is five selectors, one graph, one findings panel, one decision panel', async run({ page, assert }) {
    const p = await page('');
    const r = await p.evaluate(() => ({
      sel: ['selP', 'selS', 'selJ', 'selQ', 'selC'].map((id) => !!document.getElementById(id)),
      cards: document.querySelectorAll('#main .card').length,
      vis: !!document.querySelector('#vis'), fnd: document.querySelectorAll('.fnd .fi').length, dec: document.querySelectorAll('.dcs .dec > div').length,
      nav: [...document.querySelectorAll('.nav a')].map((a) => a.textContent.trim()),
      hash: location.hash
    }));
    clean(p, 'home', assert); await p.closeAll();
    assert(r.sel.every(Boolean), 'persona, surface, journey, question and concern selectors present');
    assert(r.cards === 3 && r.vis, 'exactly three workspace sections, got ' + r.cards);
    assert(r.fnd >= 3 && r.fnd <= 5, '3–5 findings, got ' + r.fnd);
    assert(r.dec === 4, 'decision shows risk, why, mitigation, evidence');
    assert(JSON.stringify(r.nav) === JSON.stringify(['Command Center', 'Reviews', 'Evidence', 'Ask privacy']), 'global navigation is four items: ' + r.nav.join(', '));
    assert(/^#cc\?/.test(r.hash), 'state is written to the URL');
  } },
  { name: 'every question on every surface and journey resolves to a view with 3–5 classified findings', async run({ page, assert }) {
    const p = await page('');
    const bad = await p.evaluate(() => {
      const G = window.PG, out = [], K = ['FACT', 'INFERENCE', 'UNKNOWN', 'CONTROL FAILURE'];
      const check = (tag) => {
        if (document.querySelector('.err')) out.push(tag + ': error state');
        const t = document.getElementById('main').innerText; if (/undefined|NaN|\[object/.test(t)) out.push(tag + ': junk text');
        const tags = [...document.querySelectorAll('.fi .tag')].map((x) => x.textContent);
        if (tags.length < 3 || tags.length > 5) out.push(tag + ': ' + tags.length + ' findings');
        if (tags.some((x) => K.indexOf(x) < 0)) out.push(tag + ': unclassified finding');
      };
      G.questions.forEach((q) => { G.surfaces.forEach((s) => { window.PCC1.set({ page: 'cc', q: q.id, s: s.id, j: s.j, c: [], u: 'person', p: 'reviewer', l: 'privacy' }); check(q.id + '/' + s.id); });
        G.journeys.forEach((j) => { window.PCC1.set({ q: q.id, s: 'all', j: j.id }); check(q.id + '/j:' + j.id); }); });
      return out;
    });
    clean(p, 'sweep', assert); await p.closeAll();
    assert(!bad.length, bad.slice(0, 8).join('\n'));
  } },
  { name: 'the same finding reads differently per persona; the executive sees issue, options, recommendation, residual risk', async run({ page, assert }) {
    const p = await page(H({ s: 'analytics', j: 'revoke', q: 'consent', u: 'person' }));
    const lens = {}, ids = {};
    for (const who of ['reviewer', 'builder', 'auditor', 'executive']) {
      await p.set({ p: who });
      lens[who] = await p.evaluate(() => [...document.querySelectorAll('.lensline b')].map((b) => b.textContent));
      ids[who] = await p.evaluate(() => window.PCC1.findings());
      if (who === 'executive') lens.execDec = await p.evaluate(() => [...document.querySelectorAll('.dcs dt')].map((d) => d.textContent));
      if (who === 'builder') lens.builderFirst = await p.evaluate(() => document.querySelector('.dcs dt').textContent);
    }
    clean(p, 'personas', assert); await p.closeAll();
    assert(lens.reviewer.includes('DESIGN ISSUE') && lens.builder.includes('REQUIRED CONTROL') && lens.auditor.includes('EVIDENCE FAILURE') && lens.executive.includes('RISK'), 'consent export finding worded per persona: ' + JSON.stringify(lens));
    assert(ids.reviewer.includes('f_consent_export') && ids.builder.includes('f_consent_export'), 'same underlying finding');
    assert(ids.executive.length <= 3, 'executive sees at most three findings');
    assert(JSON.stringify(lens.execDec) === JSON.stringify(['Issue', 'Options', 'Recommendation', 'Residual risk']), 'executive decision format: ' + lens.execDec);
    assert(/where the control lives/i.test(lens.builderFirst), 'builder leads with where the control lives');
  } },
  { name: 'consent: local control passes while the system control fails', async run({ page, assert }) {
    const p = await page(H({ p: 'auditor', s: 'analytics', j: 'revoke', q: 'consent', u: 'person' }));
    const r = await p.evaluate(() => ({ v: [...document.querySelectorAll('.vd')].map((x) => x.textContent), rows: document.querySelectorAll('.tl .tr').length, fails: document.querySelectorAll('.tl .pill-fail').length, key: document.querySelector('.keyline').textContent }));
    const want = await p.evaluate(() => window.PG.consent.rows.filter((r) => r.st === 'fail').length);
    clean(p, 'consent', assert); await p.closeAll();
    assert(/LOCAL CONTROL\s*PASS/.test(r.v[0]) && /SYSTEM CONTROL\s*FAIL/.test(r.v[1]), 'local pass, system fail: ' + r.v);
    assert(r.fails === want, 'failing rows match the data');
    assert(/distributed state, not a checkbox/.test(r.key), 'consent is distributed state');
  } },
  { name: 'tenant isolation: filtering is not isolation, and a mostly correct report is still wrong', async run({ page, assert }) {
    const p = await page(H({ p: 'auditor', s: 'cloud', j: 'report', q: 'control', c: 'tenant', u: 'tenant' }));
    const pdf = await p.evaluate(() => { const b = [...document.querySelectorAll('.hop')].find((x) => /PDF/.test(x.textContent)); b.click(); return document.querySelector('.stmt-r').textContent; });
    const want = await p.evaluate(() => { const r = window.PG.statement.rows; return Math.round(r.filter((x) => x[1] === 'Tenant A').length / r.length * 100); });
    const cli = await p.evaluate(() => { const b = [...document.querySelectorAll('.hop')].find((x) => /Dashboard/.test(x.textContent)); b.click(); return { warn: document.querySelector('.warn-big').textContent, x: document.querySelectorAll('.json .x').length }; });
    clean(p, 'tenant', assert); await p.closeAll();
    assert(pdf.includes(want + '% correct') && pdf.includes('100% wrong'), 'statement percentage computed from rows: ' + pdf);
    assert(cli.warn === 'FILTERING ≠ ISOLATION' && cli.x === 2, 'payload shows the two foreign tenants and the warning');
  } },
  { name: 'journeys: every arrow opens five questions, and the boundary it crosses is derived from zones', async run({ page, assert }) {
    const p = await page(H({ s: 'web', j: 'browse', q: 'where', u: 'person' }));
    const r = await p.evaluate(() => {
      const J = window.PG.journeys.find((j) => j.id === 'browse'), arrows = document.querySelectorAll('.flow .arr');
      arrows[2].click();
      const dts = [...document.querySelectorAll('.five dt')].map((d) => d.textContent), dds = [...document.querySelectorAll('.five dd')].map((d) => d.textContent);
      return { n: arrows.length, want: J.hops.length - 1, dts, boundary: dds[3], expect: J.hops[2].z + '>' + J.hops[3].z };
    });
    clean(p, 'journey', assert); await p.closeAll();
    assert(r.n === r.want, 'one arrow per hop');
    assert(r.dts.join('|') === 'What moved?|Why?|Under which identity?|Across which trust boundary?|What can the receiver now learn?', 'the five questions: ' + r.dts);
    assert(/Service → Third party/.test(r.boundary), 'boundary from zones (' + r.expect + '): ' + r.boundary);
  } },
  { name: '2026 surfaces: passkeys, selective disclosure, AI routing, mail observation and agents', async run({ page, assert }) {
    const p = await page(H({ s: 'ident', j: 'signin', q: 'prove', c: 'authentication', u: 'credential' }));
    const pk = await p.evaluate(() => ({ head: document.querySelector('.pkt thead').textContent, recovery: [...document.querySelectorAll('.pq li')].find((l) => /recovery/.test(l.textContent)).textContent, key: document.querySelector('#vis .keyline').textContent }));
    await p.set({ s: 'did', j: 'age', q: 'provewithout' });
    const age = await p.evaluate(() => ({ ans: document.querySelector('.sd-ans').textContent, old: document.querySelectorAll('.sd-old li').length }));
    await p.set({ s: 'ai', j: 'ai', q: 'leftdevice' });
    const ai = await p.evaluate(() => ({ zones: [...document.querySelectorAll('.rq .zone')].map((z) => z.textContent), key: document.querySelector('#vis .keyline').textContent }));
    await p.set({ s: 'mail', j: 'mail', q: 'whoknows' });
    const mail = await p.evaluate(() => ({ key: document.querySelector('#vis .keyline').textContent, fail: document.querySelectorAll('.unseen li.o-fail').length }));
    await p.set({ s: 'ai', j: 'ai', q: 'infer' });
    const ag = await p.evaluate(() => { const before = getComputedStyle(document.querySelector('.inf-on')).display; document.querySelector('[data-act="combine"]').click(); return { before, after: getComputedStyle(document.querySelector('.inf-on')).display, neq: document.querySelector('.neq').textContent, inf: document.querySelector('.inf-on b').textContent }; });
    clean(p, 'surfaces', assert); await p.closeAll();
    assert(/Password/.test(pk.head) && /Passkey/.test(pk.head) && /failing/i.test(pk.recovery), 'password vs passkey, recovery failing');
    assert(/does not remove the privacy problem/.test(pk.key), 'trust-model line');
    assert(age.ans === 'TRUE' && age.old >= 5, 'age proof: one boolean against a full document');
    assert(ai.zones.join(',') === 'On device,Private compute,Third-party model', 'three execution zones: ' + ai.zones);
    assert(/itself a privacy decision/.test(ai.key), 'routing line');
    assert(/email is also reading us/.test(mail.key) && mail.fail >= 1, 'mail observation');
    assert(ag.before === 'none' && ag.after !== 'none' && /UNLIMITED AUTHORIZED INFERENCE/.test(ag.neq) && /medical/.test(ag.inf), 'agent inference appears only after combining');
  } },
  { name: 'security, privacy and both lenses change what is shown', async run({ page, assert }) {
    const p = await page(H({ s: 'web', j: 'browse', q: 'where', u: 'person' }));
    const rows = {};
    for (const l of ['privacy', 'security', 'both']) { await p.set({ l }); rows[l] = await p.evaluate(() => ({ dt: [...document.querySelectorAll('.five dt')].map((d) => d.textContent), q: document.querySelector('.lensq').textContent, conv: document.querySelectorAll('.cv').length })); }
    clean(p, 'lens', assert); await p.closeAll();
    assert(rows.security.dt.includes('Security control') && !rows.security.dt.includes('Why?'), 'security lens shows the security control');
    assert(rows.both.dt.length === 6 && rows.both.conv === 3, 'both: five privacy questions + security control, and the convergence cards');
    assert(/trustworthy boundaries/.test(rows.both.q), 'convergence line');
  } },
  { name: 'ask privacy separates fact, inference, recommendation and unknown, and never invents an answer', async run({ page, assert }) {
    const p = await page('#ask?ask=' + encodeURIComponent('Which systems still use this user after consent revocation?'));
    const a = await p.evaluate(() => ({ tags: [...document.querySelectorAll('.ans .tag')].map((t) => t.textContent), cites: document.querySelectorAll('.ans .cite').length }));
    await p.evaluate(() => { document.getElementById('askI').value = 'What is the capital of France?'; document.getElementById('askF').requestSubmit(); });
    await p.waitForTimeout(80);
    const u = await p.evaluate(() => [...document.querySelectorAll('.ans .tag')].map((t) => t.textContent));
    clean(p, 'ask', assert); await p.closeAll();
    assert(a.tags.includes('FACT') && a.tags.includes('UNKNOWN') && a.tags.includes('RECOMMENDATION') && a.cites >= 3, 'classified and cited: ' + a.tags);
    assert(u.length === 1 && u[0] === 'UNKNOWN', 'an unanswerable question gets only UNKNOWN');
  } },
  { name: 'saved views are presets over the same selectors', async run({ page, assert }) {
    const p = await page('');
    const r = await p.evaluate(() => {
      const out = []; document.getElementById('vmBtn').click();
      const n = document.querySelectorAll('[data-sv]').length;
      window.PG.saved.forEach((v) => { document.querySelector('[data-sv="' + v.id + '"]').click(); const st = window.PCC1.state(); if (st.p !== v.s.p || st.s !== v.s.s || st.j !== v.s.j || st.q !== v.s.q) out.push(v.id); if (document.querySelector('.err')) out.push(v.id + ' error'); document.getElementById('vmBtn').click(); });
      return { n, out };
    });
    clean(p, 'saved', assert); await p.closeAll();
    assert(r.n === 12, 'twelve saved views, got ' + r.n);
    assert(!r.out.length, 'presets apply: ' + r.out);
  } },
  { name: 'links into the earlier explorer forward to v10', async run({ page, assert }) {
    const p = await page('#/assurance/controls', { noWait: true });
    await p.waitForURL(/\/v10\/#\/assurance\/controls/);
    await p.waitForFunction(() => document.querySelector('#view') && document.querySelector('#view').children.length > 0);
    const t = await p.evaluate(() => document.title);
    clean(p, 'legacy', assert); await p.closeAll();
    assert(/Northstar Privacy Explorer \(v10\)/.test(t), 'landed on v10: ' + t);
  } },
  { name: 'focus mode keeps selectors and workspace; keyboard reaches every selector; phone width does not overflow', async run({ page, assert }) {
    const p = await page(H({ fm: 1 }));
    const fm = await p.evaluate(() => ({ nav: getComputedStyle(document.querySelector('.nav')).display, chips: document.querySelectorAll('[data-fv]').length, ws: !!document.querySelector('.ws') }));
    await p.evaluate(() => document.getElementById('selC').click());
    const open = await p.evaluate(() => !document.getElementById('msPop').hidden);
    await p.keyboard.press('Escape');
    const closed = await p.evaluate(() => document.getElementById('msPop').hidden && document.activeElement.id === 'selC');
    clean(p, 'focus', assert); await p.closeAll();
    assert(fm.nav === 'none' && fm.chips === 3 && fm.ws, 'focus mode hides navigation, shows three walkthrough views');
    assert(open && closed, 'concern menu opens, and Escape closes it and returns focus');
    for (const h of ['', H({ s: 'did', j: 'age', q: 'provewithout' }), H({ s: 'mail', j: 'mail', q: 'whyleft' }), H({ s: 'cloud', j: 'report', q: 'control', c: 'tenant' }), '#evidence']) {
      const m = await page(h, { width: 390, height: 844 });
      const o = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      clean(m, 'mobile ' + h, assert); await m.closeAll();
      assert(o <= 0, (h || 'home') + ': overflows by ' + o + 'px at 390');
    }
  } },
  { name: 'the product carries no hiring language, no privacy score, and registers its storage key', async run({ assert }) {
    const text = ['index.html', 'app.js', 'graph.js', 'pcc1.css'].map((f) => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');
    const hit = text.match(/interview|hiring|candidate|recruit|job application/i);
    assert(!hit, 'hiring language found: ' + (hit && hit[0]));
    assert(!/privacy score/i.test(text), 'no privacy score');
    const keys = JSON.parse(fs.readFileSync(path.join(DIR, '..', 'data', 'platform', 'state-keys.json'), 'utf8'));
    assert(JSON.stringify(keys).includes('pcc.v1.views'), 'pcc.v1.views is listed in state-keys.json');
  } }
];
