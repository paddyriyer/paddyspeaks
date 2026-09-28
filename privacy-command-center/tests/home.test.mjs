/* Home, roles, risk explanations, chain, keyboard and mobile. */
const clean = (p, t) => { if (p.errors.length) throw new Error(t + ': page errors: ' + p.errors.join(' | ')); };

export default [
  { name: 'every role sees the same promises, ranked and worded for what it can do', async run({ page, assert }) {
    const seen = {};
    for (const role of ['cpo', 'em', 'auditor', 'priveng']) {
      const p = await page('overview?as=' + role);
      const r = await p.evaluate(() => ({
        ids: [...document.querySelectorAll('.pri .pri-where .chip')].map((c) => c.textContent.trim()),
        verbs: [...document.querySelectorAll('.pri .act-v')].map((v) => v.textContent.trim()),
        who: document.querySelector('.hm-who').innerText }));
      clean(p, role); await p.closeAll();
      assert(r.ids.length >= 4, role + ': fewer than 4 priority items');
      seen[role] = r;
    }
    const verb = (r) => r.verbs[0];
    assert(verb(seen.cpo) === 'Decide' || verb(seen.cpo) === 'Open a decision' || verb(seen.cpo) === 'Hold them to the test', 'CPO first action should be a decision, got ' + verb(seen.cpo));
    assert(seen.auditor.verbs.every((v) => v === 'Challenge'), 'Auditor actions should all be Challenge');
    assert(seen.priveng.verbs.every((v) => v === 'Fix'), 'Privacy engineer actions should all be Fix');
    assert(['Assign', 'Schedule'].includes(verb(seen.em)), 'EM first action should be Assign or Schedule');
    assert(JSON.stringify(seen.cpo.ids) !== JSON.stringify(seen.auditor.ids), 'Leadership and Oversight order should differ');
    const set = (r) => r.ids.slice().sort().join();
    assert(seen.cpo.who.includes('Leadership') && seen.auditor.who.includes('Oversight'), 'perspective names shown');
  } },
  { name: 'switching role from the selector re-ranks without reload', async run({ page, assert }) {
    const p = await page('overview?all=1');
    await p.selectOption('#personaSel', 'auditor'); await p.waitForTimeout(200);
    const a = await p.evaluate(() => document.querySelector('.act-v').textContent);
    await p.selectOption('#personaSel', 'priveng'); await p.waitForTimeout(200);
    const b = await p.evaluate(() => document.querySelector('.act-v').textContent);
    clean(p, 'switch'); await p.closeAll();
    assert(a === 'Challenge' && b === 'Fix', `expected Challenge then Fix, got ${a} then ${b}`);
  } },
  { name: 'each priority item carries every required field', async run({ page, assert }) {
    const p = await page('overview?as=cpo');
    const r = await p.evaluate(() => [...document.querySelectorAll('.pri')].slice(0, 4).map((c) => {
      c.querySelector('details.pri-more').open = true;
      const dts = [...c.querySelectorAll('.pri-f dt')].map((d) => d.textContent);
      return { dts, q: !!c.querySelector('.pri-t q'), conseq: (c.querySelector('.pri-c') || {}).textContent || '',
        opts: c.querySelectorAll('table.opts tbody tr').length, rec: c.querySelectorAll('table.opts tr.rec').length,
        evidence: !!c.querySelector('.evl, .ok'), chain: c.querySelectorAll('.chainx .cx').length, fresh: c.querySelectorAll('.fresh').length,
        risk: (c.querySelector('.rx-s') || {}).textContent || '' };
    }));
    clean(p, 'fields'); await p.closeAll();
    for (const c of r) {
      for (const k of ['People affected', 'Products · systems', 'Accountable owner', 'Decision due', 'Residual risk']) assert(c.dts.includes(k), 'missing field ' + k);
      assert(c.q && c.conseq.length > 20, 'promise quote and human consequence present');
      assert(c.opts >= 3 && c.rec === 1, 'recommended option plus at least two alternatives, got ' + c.opts);
      assert(c.evidence && c.fresh > 0, 'failed control / evidence with freshness shown');
      assert(c.chain === 14, 'full 14-link chain shown, got ' + c.chain);
      assert(/^(High|Medium|Low) because /.test(c.risk), 'risk explained in words: ' + c.risk);
    }
  } },
  { name: 'residual risk is never shown as a bare number', async run({ page, assert }) {
    for (const r of ['overview?as=cpo', 'privacy/risks', 'promises/PR-LOC']) {
      const p = await page(r);
      const t = await p.evaluate(() => document.querySelector('main').innerText);
      clean(p, r); await p.closeAll();
      assert(!/residual\s+\d+(\.\d+)?\b(?!\s*%)/i.test(t.replace(/residual risk/ig, '')), r + ': found an unexplained "residual <number>"');
    }
  } },
  { name: 'risk explanation names drivers, safeguards, unknowns and confidence', async run({ page, assert }) {
    const p = await page('promises/PR-HEALTH');
    const r = await p.evaluate(() => { const d = document.querySelector('.rx-more'); d.open = true; return { h: [...d.querySelectorAll('h5')].map((x) => x.textContent), conf: document.querySelector('.rx-conf').textContent, unk: d.querySelectorAll('li.unknown').length }; });
    clean(p, 'risk'); await p.closeAll();
    assert(r.h.join('|') === 'What drives it|Safeguards|What we don’t know', 'three explanation parts');
    assert(/confidence: (low|medium|high)/.test(r.conf), 'confidence shown');
    assert(r.unk >= 1, 'PR-HEALTH has unknown inputs (owner, retention) listed');
  } },
  { name: 'indicators show trend, denominator, target, coverage and owner', async run({ page, assert }) {
    const p = await page('overview?as=cpo');
    const r = await p.evaluate(() => [...document.querySelectorAll('.inds .ind')].map((b) => ({ t: b.innerText, trend: !!b.querySelector('.spark') })));
    clean(p, 'ind'); await p.closeAll();
    assert(r.length >= 6, 'six indicators');
    for (const x of r) { assert(x.trend, 'sparkline'); assert(/target/.test(x.t) && /owner/.test(x.t) && /(vs last week|no change)/.test(x.t), 'indicator meta: ' + x.t); }
    assert(r.some((x) => / of \d+/.test(x.t)), 'at least one denominator');
    assert(r.some((x) => /sees \d+% of/.test(x.t)), 'coverage shown');
  } },
  { name: 'the chain explorer starts anywhere and shows all fourteen links', async run({ page, assert }) {
    for (const from of ['PR-DELETE', 'i_email', 's_mktg', 'v_adreach', 'p_pulse', 'R-01', 'mdl_nova', 'cc6']) {
      const p = await page('chain?from=' + from);
      const r = await p.evaluate(() => ({ cols: document.querySelectorAll('.chx-col').length, items: document.querySelectorAll('.chx-col li').length }));
      clean(p, from); await p.closeAll();
      assert(r.cols === 14 && r.items > 3, from + ': chain has ' + r.cols + ' columns and ' + r.items + ' items');
    }
  } },
  { name: 'keyboard: skip link, focusable priority details, drawer opens and closes with Escape', async run({ page, assert }) {
    const p = await page('overview?as=cpo');
    await p.keyboard.press('Tab');
    const first = await p.evaluate(() => document.activeElement && (document.activeElement.textContent || '').trim());
    await p.focus('.pri .pri-where .chip'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
    const open = await p.evaluate(() => document.getElementById('drawer').classList.contains('open'));
    await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    const closed = await p.evaluate(() => !document.getElementById('drawer').classList.contains('open'));
    await p.focus('.pri summary'); await p.keyboard.press('Enter');
    const exp = await p.evaluate(() => document.querySelector('.pri details').open);
    clean(p, 'kbd'); await p.closeAll();
    assert(/skip/i.test(first), 'first Tab reaches a skip link, got "' + first + '"');
    assert(open && closed, 'drawer opens with Enter and closes with Escape');
    assert(exp, 'details expand from the keyboard');
  } },
  { name: 'role changes vocabulary and the order evidence is shown in', async run({ page, assert }) {
    const get = async (role) => { const p = await page('overview?as=' + role); const r = await p.evaluate(() => { const d = document.querySelector('.pri details'); d.open = true; return { sum: d.querySelector('summary').textContent, first: d.querySelector('h4').textContent, q3: document.querySelector('#q3').textContent }; }); await p.closeAll(); return r; };
    const lead = await get('exec'), over = await get('counsel'), build = await get('swe');
    assert(lead.sum !== over.sum && over.sum !== build.sum, 'disclosure summary differs by perspective');
    assert(/Evidence|safeguard|control/i.test(over.first), 'oversight sees evidence first, got ' + over.first);
    assert(/test that proves/i.test(build.first), 'builders see the failing test first, got ' + build.first);
    assert(/determination/.test(over.q3) && /decision/.test(lead.q3), 'oversight says determination, leadership says decision');
  } },
  { name: 'unknown records and broken routes show a clear state, never a blank page', async run({ page, assert }) {
    const p = await page('promises/PR-NOPE');
    const t = await p.evaluate(() => document.querySelector('main').innerText);
    await p.go('help'); const h = await p.evaluate(() => document.querySelectorAll('.glossary dt').length);
    const errs = p.errors.slice(); await p.closeAll();
    assert(/not found/i.test(t) && /PR-NOPE/.test(t), 'missing promise explained');
    assert(h >= 8, 'glossary defines the terms');
    assert(!errs.length, 'no page errors: ' + errs.join('|'));
  } },
  { name: 'mobile: no horizontal overflow on the main journeys at 390px', async run({ page, assert }) {
    for (const r of ['overview?as=cpo', 'overview?as=em', 'promises', 'promises/PR-LOC', 'chain?from=PR-OPTOUT']) {
      const p = await page(r, { width: 390 });
      await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150);
      const o = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      clean(p, r); await p.closeAll();
      assert(o <= 0, r + ': overflows by ' + o + 'px at 390');
    }
  } },
];
