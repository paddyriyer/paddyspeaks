/* Privacy Command Center v1: one graph, many lenses.
 * Each test drives the real page. Expected values are recomputed from the graph
 * (window.PG) rather than copied from the view, so a test fails when the view
 * and the data disagree. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clean = (p, what, assert) => assert(!p.errors.length, what + ': page errors ' + p.errors.join(' | '));
/* these tests were written against the privacy lens; the default is now all four, so they name it */
const H = (o) => '#cc?' + Object.entries(Object.assign({ l: 'privacy' }, o)).map(([k, v]) => k + '=' + v).join('&');

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
    assert(JSON.stringify(r.nav) === JSON.stringify(['Command Center', 'Products', 'Everyday arrows', 'Every layer', 'Future', 'AI / agents', 'Reviews', 'Evidence', 'Ask privacy']), 'global navigation is the nine views of one graph: ' + r.nav.join(', '));
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
      const O = window.PCC1.offered, byF = {}; G.findings.forEach((f) => { byF[f.id] = f; });
      G.surfaces.forEach((s) => { O(G.questions, 'q', s.id).forEach((q) => {
        O(G.journeys, 'j', s.id).forEach((j) => { window.PCC1.set({ page: 'cc', s: s.id, j: j.id, q: q.id, c: [], u: 'person', p: 'reviewer', l: 'privacy' });
          const st = window.PCC1.state(), tag = q.id + '/' + s.id + '/' + j.id;
          if (st.q !== q.id || st.j !== j.id) out.push(tag + ': an offered combination was rewritten');
          check(tag);
          if (s.id !== 'all' && !window.PCC1.findings().some((id) => byF[id].s.indexOf(s.id) >= 0)) out.push(tag + ': no finding about this surface'); });
        O(G.subjects, 'u', s.id).forEach((u) => { window.PCC1.set({ s: s.id, j: s.j, q: q.id, u: u.id }); check(q.id + '/' + s.id + '/u:' + u.id); }); }); });
      return out;
    });
    clean(p, 'sweep', assert); await p.closeAll();
    assert(!bad.length, bad.slice(0, 8).join('\n'));
  } },
  { name: 'each surface offers only its own journeys, questions, concerns and subjects', async run({ page, assert }) {
    const p = await page(H({ s: 'pay', j: 'pay', q: 'know', u: 'person' }));
    const r = await p.evaluate(() => {
      const G = window.PG, out = [], opts = (id) => [...document.querySelectorAll('#' + id + ' option')].map((o) => o.value);
      const conc = () => [...document.querySelectorAll('#msPop input')].map((i) => i.value);
      const pay = { j: opts('selJ'), q: opts('selQ'), u: opts('selU'), c: conc() };
      G.surfaces.forEach((s) => {
        window.PCC1.set({ page: 'cc', s: s.id, j: s.j, q: 'know', c: [], u: 'person' });
        const R = G.relevance[s.id], same = (a, b) => a.length === b.length && a.every((x) => b.indexOf(x) >= 0);
        if (!R) { if (opts('selJ').length !== G.journeys.length || opts('selQ').length !== G.questions.length) out.push(s.id + ': all surfaces should offer everything'); return; }
        if (!same(opts('selJ'), R.j)) out.push(s.id + ' journeys ' + opts('selJ'));
        if (!same(opts('selQ'), R.q)) out.push(s.id + ' questions ' + opts('selQ'));
        if (!same(opts('selU'), R.u)) out.push(s.id + ' subjects ' + opts('selU'));
        if (!same(conc(), R.c)) out.push(s.id + ' concerns ' + conc());
        R.c.forEach((c) => { if (!G.findings.some((f) => f.c.indexOf(c) >= 0 && f.s.indexOf(s.id) >= 0)) out.push(s.id + ': concern ' + c + ' has no finding on this surface'); });
      });
      // switching surface drops what no longer belongs
      window.PCC1.set({ s: 'mail', j: 'mail', q: 'howlearn', c: ['tracking', 'ondevice'], u: 'feature' });
      window.PCC1.set({ s: 'pay', j: 'pay' });
      const sw = window.PCC1.state();
      // presets and change links land on offered combinations
      const presets = G.saved.map((v) => [v.label, v.s]).concat(G.focus.map((v) => [v.label, v.s]));
      presets.forEach(([l, x]) => { const R = G.relevance[x.s]; if (R && (R.j.indexOf(x.j) < 0 || R.q.indexOf(x.q) < 0 || R.u.indexOf(x.subj) < 0 || x.c.some((c) => R.c.indexOf(c) < 0))) out.push('preset ' + l + ' is not an offered combination'); });
      return { out, pay, sw };
    });
    const p2 = await page(H({ s: 'pay', j: 'mail', q: 'join', u: 'tenant', c: 'tenant' }));
    const fixed = await p2.evaluate(() => window.PCC1.state()); await p2.closeAll();
    clean(p, 'relevance', assert); await p.closeAll();
    assert(!r.pay.j.includes('mail') && !r.pay.j.includes('report') && r.pay.j.includes('pay'), 'wallet never offers read mail: ' + r.pay.j);
    assert(!r.pay.q.includes('join') && !r.pay.q.includes('consent') && !r.pay.q.includes('prove'), 'wallet questions: ' + r.pay.q);
    assert(!r.pay.c.includes('tenant') && !r.pay.c.includes('tracking'), 'wallet concerns: ' + r.pay.c);
    assert(!r.pay.u.includes('tenant') && !r.pay.u.includes('dataset'), 'wallet subjects: ' + r.pay.u);
    assert(!r.out.length, r.out.slice(0, 8).join('\n'));
    assert(r.sw.q === 'know' && r.sw.c.join() === 'ondevice' && r.sw.u === 'person', 'switching surface keeps only what belongs: ' + JSON.stringify(r.sw));
    assert(fixed.j === 'pay' && fixed.q === 'know' && fixed.u === 'person' && !fixed.c.length, 'a link with a mismatched combination falls back: ' + JSON.stringify(fixed));
  } },
  { name: 'one account, one life: the account is the join key, and each control narrows what a thief reaches', async run({ page, assert }) {
    const p = await page(H({ s: 'ident', j: 'account', q: 'stolen', u: 'person' }));
    const r = await p.evaluate(() => {
      const G = window.PG, root = document.getElementById('vis'), got = () => root.querySelectorAll('.tk-s.got').length, out = {};
      out.facts = root.querySelectorAll('#ol-res li').length;
      root.querySelector('[data-sf="0"]').click(); root.querySelector('[data-sf="1"]').click();
      out.factsAfter = root.querySelectorAll('#ol-res li').length;
      out.attackers = [];
      G.takeover.forEach((t, i) => {
        root.querySelector('[data-tk="' + i + '"]').click(); const before = got();
        document.getElementById('tk-fix').click(); const after = got();
        out.attackers.push({ id: t.id, before, after, expect: [t.gets.length, t.after.length], remains: /remain/i.test(document.getElementById('tk-res').innerText) });
      });
      return out;
    });
    const f = await p.evaluate(() => window.PCC1.findings());
    clean(p, 'takeover', assert); await p.closeAll();
    assert(r.facts > r.factsAfter, 'turning surfaces off removes the joins they made: ' + r.facts + ' → ' + r.factsAfter);
    r.attackers.forEach((a) => { assert(a.before === a.expect[0] && a.after === a.expect[1] && a.after < a.before, a.id + ' reach before/after the control: ' + JSON.stringify(a)); assert(a.remains, a.id + ' shows what remains'); });
    assert(f.includes('f_onelife') && f.includes('f_ext'), 'takeover findings: ' + f);
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
    const r = await p.evaluate(() => ({ v: [...document.querySelectorAll('.vd')].map((x) => x.textContent), rows: document.querySelectorAll('.tl-wide .tr').length, fails: document.querySelectorAll('.tl-wide .pill-fail').length, tallFails: document.querySelectorAll('.tl-tall .pill-fail').length, key: document.querySelector('.keyline').textContent }));
    const want = await p.evaluate(() => window.PG.consent.rows.filter((r) => r.st === 'fail').length);
    clean(p, 'consent', assert); await p.closeAll();
    assert(/LOCAL CONTROL\s*PASS/.test(r.v[0]) && /SYSTEM CONTROL\s*FAIL/.test(r.v[1]), 'local pass, system fail: ' + r.v);
    assert(r.fails === want && r.tallFails === want, 'failing rows match the data, in both layouts');
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
      const dts = [...document.querySelectorAll('#insp .five dt')].map((d) => d.textContent), dds = [...document.querySelectorAll('#insp .five dd')].map((d) => d.textContent);
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
  { name: 'four lenses (all, security, privacy, QA, data governance) change what is shown, never the graph', async run({ page, assert }) {
    const p = await page(H({ s: 'web', j: 'browse', q: 'where', u: 'person' }));
    const rows = {};
    for (const l of ['all', 'security', 'privacy', 'qa', 'gov']) {
      await p.set({ l });
      rows[l] = await p.evaluate(() => ({ dt: [...document.querySelectorAll('#insp .five dt')].map((d) => d.textContent), q: document.querySelector('.lensq').textContent, conv: document.querySelectorAll('.cv').length,
        lens: [...document.querySelectorAll('.sent ~ .refine [data-l], .refine [data-l]')].map((b) => b.textContent), arrows: document.querySelectorAll('.flow .arr').length, f: window.PCC1.findings(), note: (document.querySelector('.fnd .note') || {}).textContent || '' }));
    }
    clean(p, 'lens', assert); await p.closeAll();
    assert(JSON.stringify(rows.all.lens) === JSON.stringify(['All four', 'Security', 'Privacy', 'QA', 'Data governance']), 'the lens switch: ' + rows.all.lens);
    assert(rows.security.dt.includes('Security control') && !rows.security.dt.includes('Why?'), 'security lens shows the security control');
    assert(rows.qa.dt.includes('How would anyone know?') && rows.gov.dt.includes('Who holds it after this hop?'), 'QA asks for evidence; governance asks who holds it');
    assert(rows.all.dt.length === 8 && rows.all.conv === 3, 'all four: five privacy questions + security, QA and governance, and the convergence cards');
    assert(/trustworthy boundaries/.test(rows.all.q) && /how would anyone outside know/i.test(rows.qa.q) && /who holds it/i.test(rows.gov.q), 'each lens asks the essay’s question');
    assert(/control failures, unknowns/.test(rows.qa.note) && /retention, deletion/.test(rows.gov.note), 'the QA and governance finding rules are shown');
    assert(new Set(Object.values(rows).map((r) => r.arrows)).size === 1, 'same data: the graph never changes with the lens');
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
    assert(r.n === 16, 'sixteen saved views, got ' + r.n);
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
  { name: 'across time: recoverability, preservation and key lifecycle are a lens over the same graph', async run({ page, assert }) {
    const p = await page(H({ s: 'cloud', j: 'report', q: 'recover', u: 'dataset' }));
    const r = await p.evaluate(() => {
      const G = window.PG, o = {}, $ = (x) => document.querySelector(x), txt = (x) => ($(x) || {}).innerText || '';
      const grp = [...document.querySelectorAll('#selQ optgroup')].map((g) => [g.label, g.querySelectorAll('option').length]);
      o.groups = grp;
      o.refs = G.transforms.every((t) => G.nodes[t.node] && (!t.key || G.keys[t.key])) && G.holds.every((h) => h.items.every((i) => G.nodes[i[1]])) && G.archive.deps.every((d) => G.nodes[d.node]);
      // the five-year archive, bad outcome
      $('[data-am="bad"]').click();
      o.bad = txt('#ar-res'); o.badFail = document.querySelectorAll('#ar-res .dep.d-fail').length;
      window.PCC1.set({ p: 'executive' }); $('[data-am="bad"]').click(); o.execFirst = (document.querySelector('#ar-res .say p') || {}).className;
      window.PCC1.set({ p: 'reviewer' });
      // hashed: one-way, but matchable by comparison
      window.PCC1.set({ s: 'vendor', j: 'revoke', q: 'match' });
      o.tab = document.querySelector('[data-tt][aria-checked="true"]').getAttribute('data-tt');
      $('#candI').value = '  ' + G.subjectEmail.toUpperCase() + ' '; $('[data-cand]').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      o.hash = txt('#tf-res');
      // keyed pseudonym: reproducible only with the historical key and rule
      document.querySelector('[data-tt="pseudo"]').click();
      $('#candI').value = G.subjectEmail; $('[data-cand]').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      o.pOk = txt('#tf-res').toLowerCase().includes("same id: matched");
      $('[data-pk="rule"]').click(); $('[data-cand]').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); o.pRule = txt('#tf-res').toLowerCase().includes("different id");
      $('[data-pk="rule"]').click(); $('[data-pk="key"]').click(); $('[data-cand]').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); o.pKey = txt('#tf-res').toLowerCase().includes("cannot compute");
      o.principle = txt('.principle');
      // key destruction
      window.PCC1.set({ s: 'cloud', j: 'report', q: 'keygone' }); o.k2026 = txt('#kg-res');
      $('[data-kg="k_42"]').click(); o.k42 = txt('#kg-res');
      // legal hold: preservation is not only bytes
      window.PCC1.set({ q: 'hold' }); o.holdNote = txt('#vis');
      $('[data-hi="k_2026"]').click(); o.open = document.querySelector('#hd-use li').innerText;
      // delete vs preserve
      window.PCC1.set({ s: 'analytics', j: 'delete', q: 'holdworked' }); o.active = txt('#pv-res');
      $('[data-ph="1"]').click(); o.released = txt('#pv-res');
      // did the key destruction really work?
      window.PCC1.set({ s: 'cloud', j: 'report', q: 'unrecoverable' }); o.chain = txt('#vis'); o.ufind = window.PCC1.findings();
      // the both lens carries the four-lens archived record
      window.PCC1.set({ s: 'all', q: 'know', l: 'all' }); o.conv4 = txt('.conv4');
      return o;
    });
    const ev = await page('#evidence?ev=time');
    const reg = await ev.evaluate(() => ({ cards: document.querySelectorAll('.tvd').length, n: window.PG.transforms.length, q: document.querySelectorAll('.tvd')[0].querySelectorAll('dt').length }));
    await ev.closeAll();
    clean(p, 'across time', assert); await p.closeAll();
    assert(r.refs, 'every transformation, key, hold item and archive dependency points at a graph node');
    assert(r.groups.length === 2 && r.groups[1][0] === 'What must still be possible in the future?' && r.groups[1][1] === 7, 'seven future questions in their own group: ' + JSON.stringify(r.groups));
    assert(/Data exists\s*Yes/i.test(r.bad) && /Recoverable\s*Failed/i.test(r.bad) && r.badFail === 2, 'bad outcome: bytes exist, recovery failed, two keys missing');
    assert(r.execFirst === 'say-e', 'the executive reads the one-sentence version first');
    assert(r.tab === 'hash' && /Decrypt\s*None/i.test(r.hash) && /matches the stored hash/i.test(r.hash), 'hashed: no decrypt, but a known value matches after normalization');
    assert(r.pOk && r.pRule && r.pKey, 'pseudonym reproduces only with the historical key and rule');
    assert(/Key lifecycle can become data lifecycle/.test(r.principle), 'principle follows the tab: ' + r.principle);
    assert(/Conflicts with a hold\s*Yes: LH-901/i.test(r.k2026), 'destroying K-2026 conflicts with the active hold');
    assert(/legacy_extract_2022/.test(r.k42) && /Destroyed on 2026-06-30/.test(r.k42), 'K-42: destroyed, with a surviving plaintext copy');
    assert(/not legal advice/i.test(r.holdNote) && /Preservation is not only preserving bytes/.test(r.holdNote), 'hold: neutral, not legal advice, and more than bytes');
    assert(/^\S*\s*No\b|NO/.test(r.open) || /No/.test(r.open), 'without the key the held data cannot be opened: ' + r.open);
    assert(/Preserve relevant data/.test(r.active) && /pending/.test(r.active) && /Verification complete[\s\S]*failed/i.test(r.released), 'delete vs preserve: suspension now, release verified later with a failure');
    assert(/Key destruction/.test(r.chain) && /legacy_extract_2022/.test(r.chain) && r.ufind.includes('f_k42_plain'), 'key destruction control chain finds the surviving copy');
    assert(/Encryption answers who can read it/.test(r.conv4) && /QA/i.test(r.conv4) && /Governance/i.test(r.conv4), 'all four lenses: security, privacy, governance and QA on one archived record');
    assert(reg.cards === reg.n && reg.q === 9, 'every dataset followed across time with nine questions: ' + JSON.stringify(reg));
  } },
  { name: 'ask privacy answers recoverability questions with classified, cited lines', async run({ page, assert }) {
    const p = await page('#ask');
    const qs = ['Can this dataset be decrypted?', 'Who holds the key?', 'Which data becomes unrecoverable if this key is destroyed?', 'Can I match this hashed identifier back to a known customer?', 'Which algorithm and key version created this pseudonym?', 'Which records are currently under legal hold?', 'Would deleting this key violate an active preservation requirement?', 'Can this five-year-old archive actually be restored?', 'Which token mappings are required to interpret these records?', 'Which datasets physically exist but can no longer be meaningfully recovered?'];
    const out = await p.evaluate((qs) => qs.map((q) => { const a = window.PG.answer(q); return { q, same: a.q === q, n: a.lines.length, kinds: [...new Set(a.lines.map((l) => l[0]))] }; }), qs);
    const loose = await p.evaluate(() => window.PG.answer('could anyone decrypt the old events?').q);
    clean(p, 'ask time', assert); await p.closeAll();
    const K = ['FACT', 'INFERENCE', 'UNKNOWN', 'RECOMMENDATION', 'CONTROL FAILURE'];
    out.forEach((o) => { assert(o.same && o.n >= 2, o.q + ' answered by its own intent'); assert(o.kinds.every((k) => K.includes(k)), o.q + ': ' + o.kinds); });
    assert(out.some((o) => o.kinds.includes('CONTROL FAILURE')) && out.some((o) => o.kinds.includes('UNKNOWN')) && out.some((o) => o.kinds.includes('INFERENCE')), 'answers distinguish control failures, unknowns and inferences');
    assert(loose === 'Can this dataset be decrypted?', 'free text finds the decrypt intent: ' + loose);
  } },
  { name: 'on a phone every view fits the screen: nothing is cut off or hidden in a sideways scroll', async run({ page, assert }) {
    const p = await page('', { width: 390, height: 844 });
    const bad = await p.evaluate(() => {
      const G = window.PG, W = document.documentElement.clientWidth, out = [];
      const views = [];
      G.surfaces.forEach((s) => window.PCC1.offered(G.questions, 'q', s.id).forEach((q) => window.PCC1.offered(G.journeys, 'j', s.id).forEach((j) => views.push({ page: 'cc', s: s.id, j: j.id, q: q.id }))));
      views.push({ page: 'reviews' }, { page: 'evidence' }, { page: 'ask' });
      for (const v of views) {
        window.PCC1.set(Object.assign({ c: [], u: 'person', l: 'privacy', fm: false }, v));
        document.querySelectorAll('[data-act="connect"],[data-act="join"],[data-act="combine"]').forEach((b) => b.click());
        const tag = v.page + (v.q ? ':' + v.s + '/' + v.j + '/' + v.q : '');
        if (document.documentElement.scrollWidth > W) out.push(tag + ': page scrolls sideways');
        for (const e of document.querySelectorAll('#main *')) {
          if (e.closest('.sr-only')) continue;
          const r = e.getBoundingClientRect();
          if (r.width && r.height && (r.right > W + 1 || r.left < -1)) { out.push(tag + ': ' + (e.getAttribute('class') || e.tagName) + ' spans ' + Math.round(r.left) + '–' + Math.round(r.right)); break; }
        }
        if (out.length > 8) break;
      }
      return out;
    });
    clean(p, 'phone fit', assert); await p.closeAll();
    assert(!bad.length, bad.join('\n'));
  } },
  { name: 'the product carries no hiring language, no privacy score, and registers its storage key', async run({ assert }) {
    const text = ['index.html', 'app.js', 'graph.js', 'events.js', 'modes.js', 'pcc1.css', '../articles/every-arrow/shared.js'].map((f) => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');
    /* “a known candidate” is the hashing idea (hash a guess and compare); a job candidate is not welcome */
    const hit = text.match(/interview|hiring|job candidates?|candidates? for (the )?(role|job)|recruit|job application/i);
    assert(!/rainbow/i.test(text), 'no attack-table language');
    assert(!hit, 'hiring language found: ' + (hit && hit[0]));
    assert(!/privacy score/i.test(text), 'no privacy score');
    const keys = JSON.parse(fs.readFileSync(path.join(DIR, '..', 'data', 'platform', 'state-keys.json'), 'utf8'));
    assert(JSON.stringify(keys).includes('pcc.v1.views'), 'pcc.v1.views is listed in state-keys.json');
  } }
];
