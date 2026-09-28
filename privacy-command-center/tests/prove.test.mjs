/* PROVE & PERSON: search traceability, One Person, controls & evidence, review workbench. */
const clean = (p, t) => { if (p.errors.length) throw new Error(t + ': page errors: ' + p.errors.join(' | ')); };

const SIX = [
  'Who has precise location data?',
  'Which vendors still have data after consent was revoked?',
  'Which products use security data for another purpose?',
  'Can we prove Dana was deleted everywhere?',
  'Which AI models contain customer conversations?',
  'What changed since the last review?',
];

/* Type a question into the palette and read back what was rendered. */
async function ask(p, q) {
  await p.keyboard.press('Escape');
  await p.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); });
  await p.keyboard.press('/');
  await p.fill('#paletteInput', q);
  await p.waitForTimeout(80);
  return p.evaluate(() => {
    const box = document.getElementById('paletteResults');
    const answers = [...box.querySelectorAll('.answer')].map((a) => ({
      unknown: a.getAttribute('data-answer') === 'unknown',
      q: (a.querySelector('.ah') || {}).textContent || '',
      tags: [...a.querySelectorAll('.stmt > .tag')].map((t) => t.textContent),
      cite: !!a.querySelector(':scope > .cite'),
      citeChips: [...a.querySelectorAll(':scope > .cite .chip[data-ent]')].map((c) => c.getAttribute('data-ent')),
      allChips: [...a.querySelectorAll('[data-ent]')].map((c) => c.getAttribute('data-ent')),
      trail: !!a.querySelector('[data-act="trailAdd"]'),
      chain: !!a.querySelector('[data-go^="chain?from="]'),
      text: a.innerText,
    }));
    const missing = answers.flatMap((a) => a.allChips.filter((id) => !window.PCC.get(id)));
    return { answers, missing };
  });
}

export default [
  { name: 'search: each of the six investigations answers with citations that resolve to real records', async run({ page, assert }) {
    const p = await page('overview?all=1');
    for (const q of SIX) {
      const r = await ask(p, q);
      assert(r.answers.length === 1, q + ': expected one answer, got ' + r.answers.length);
      const a = r.answers[0];
      assert(!a.unknown, q + ': answered UNKNOWN');
      assert(a.q === q, q + ': answered a different question: ' + a.q);
      assert(a.cite && a.citeChips.length >= 3, q + ': citations block with records, got ' + a.citeChips.length);
      assert(r.missing.length === 0, q + ': cited ids not in the registry: ' + r.missing.join(', '));
      assert(a.tags.length >= 2 && a.tags.every((t) => ['FACT', 'INFERENCE', 'RECOMMENDATION', 'UNKNOWN'].includes(t)), q + ': labelled statements');
      assert(a.trail && a.chain, q + ': offers Add to trail and Open the chain');
      assert(!/\b(NaN|undefined|Infinity)\b/.test(a.text), q + ': broken value in the answer');
    }
    clean(p, 'six'); await p.closeAll();
  } },
  { name: 'search: every answer — intents and analyst — is rendered with a citations block', async run({ page, assert }) {
    const p = await page('overview?all=1');
    const r = await p.evaluate(() => window.PCC.INTENTS.map((i) => { const d = document.createElement('div'); d.innerHTML = window.PCC.answerHTML(i.q, i.run()); const a = d.querySelector('.answer'); return { q: i.q, cite: !!a.querySelector(':scope > .cite'), n: a.querySelectorAll(':scope > .cite .chip').length, unk: a.dataset.answer === 'unknown' }; }));
    for (const x of r) assert(x.cite && (x.n > 0 || x.unk), x.q + ': no citations');
    await p.click('#analystBtn'); await p.waitForTimeout(100);
    await p.evaluate(() => document.querySelectorAll('#analyst [data-aq], #analyst [data-ai]').forEach((b) => b.click()));
    const an = await p.evaluate(() => [...document.querySelectorAll('#aAnswers .msg')].map((m) => ({ cite: !!m.querySelector('.answer > .cite'), n: m.querySelectorAll('.answer > .cite .chip').length, bad: [...m.querySelectorAll('[data-ent]')].filter((c) => !window.PCC.get(c.dataset.ent)).length })));
    clean(p, 'analyst'); await p.closeAll();
    assert(an.length >= 10, 'analyst answered every question, got ' + an.length);
    for (const m of an) { assert(m.cite && m.n > 0, 'analyst answer without citations'); assert(m.bad === 0, 'analyst cited a missing record'); }
  } },
  { name: 'search: an unanswerable question is an explicit UNKNOWN, never an invented answer', async run({ page, assert }) {
    const p = await page('overview?all=1');
    for (const q of ['How many cats does Northstar own?', 'What is Dana’s favourite colour?']) {
      const r = await ask(p, q);
      assert(r.answers.length === 1 && r.answers[0].unknown, q + ': expected one UNKNOWN answer');
      assert(r.answers[0].tags.join() === 'UNKNOWN', q + ': only an UNKNOWN statement');
      assert(r.answers[0].cite && r.answers[0].citeChips.length === 0, q + ': empty citations shown as unknown');
    }
    clean(p, 'unknown'); await p.closeAll();
  } },
  { name: 'search: result clicks and “Add to trail” are recorded in the trail', async run({ page, assert }) {
    const p = await page('overview?all=1');
    await ask(p, SIX[3]);
    await p.click('#paletteResults [data-act="trailAdd"]');
    const t1 = await p.evaluate(() => window.PCC.state.trail.slice());
    await p.click('#paletteResults .pr[data-ent]'); await p.waitForTimeout(100);
    const t2 = await p.evaluate(() => ({ trail: window.PCC.state.trail.slice(), pal: document.getElementById('palette').hidden, drawer: document.getElementById('drawer').classList.contains('open') }));
    await p.keyboard.press('Escape');
    await ask(p, SIX[0]);
    await p.click('#paletteResults [data-go^="chain?from="]'); await p.waitForTimeout(200);
    const t3 = await p.evaluate(() => ({ trail: window.PCC.state.trail.slice(), hash: location.hash }));
    clean(p, 'trail'); await p.closeAll();
    assert(t1.includes('u_dana'), 'Add to trail records the anchor');
    assert(t2.trail.length > t1.length && t2.pal && t2.drawer, 'a result click opens its record, closes the palette and extends the trail');
    assert(t3.hash.startsWith('#/chain?from=') && t3.trail.includes('PR-LOC'), 'Open the chain records the anchor and navigates');
  } },
  { name: 'One Person distinguishes collected, observed, derived, inferred and external data, each fully described', async run({ page, assert }) {
    const p = await page('explore/person');
    const r = await p.evaluate(() => {
      const facts = [...document.querySelectorAll('.pf-fact')];
      return { origins: [...new Set(facts.map((f) => f.dataset.origin))].sort(), n: facts.length,
        full: facts.every((f) => ['Source · dataset and system', 'Purpose', 'Kept', 'Who can see it', 'Promise it touches', 'Her rights reach it?'].every((k) => [...f.querySelectorAll('dt')].some((d) => d.textContent === k))),
        cites: facts.every((f) => f.querySelectorAll('.cite .chip[data-ent]').length > 0),
        missing: [...document.querySelectorAll('main [data-ent]')].filter((c) => !window.PCC.get(c.dataset.ent)).map((c) => c.dataset.ent),
        badFields: window.PCC.dana().facts.filter((x) => !x.d || x.missingFields.length).map((x) => x.f.id),
        joins: document.querySelectorAll('.pf-joins tbody tr').length, chain: document.querySelectorAll('#pfChain ~ .chainx .cx, .pf-sec .chainx .cx').length,
        rights: !!document.querySelector('a[href="#/privacy/rights"]') && !!document.querySelector('a[href="#/privacy/deletion"]'),
        sections: ['pfKnow', 'pfInfer', 'pfJoin', 'pfPredict', 'pfDisclose'].every((id) => document.getElementById(id)) };
    });
    assert(r.origins.join() === 'collected,derived,external,inferred,observed', 'five origins, got ' + r.origins);
    assert(r.full, 'every fact names source, purpose, retention, access, promise and rights');
    assert(r.cites, 'every fact cites its records');
    assert(!r.missing.length, 'unknown ids: ' + r.missing);
    assert(!r.badFields.length, 'facts naming fields their dataset does not have: ' + r.badFields);
    assert(r.joins >= 5 && r.chain === 14 && r.rights && r.sections, 'joins, chain, rights links and the five sections');
    await p.check('[data-lever="ttl"]');
    const after = await p.evaluate(() => ({ gone: document.querySelectorAll('.pf-fact.gone').length, sum: document.getElementById('pfSum').textContent }));
    clean(p, 'person'); await p.closeAll();
    assert(after.gone > 0 && /removed by the levers/.test(after.sum), 'a lever removes facts and says so');
  } },
  { name: 'controls table shows last test, result, evidence, freshness and next test for every control', async run({ page, assert }) {
    const p = await page('assurance/controls');
    const r = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('.pf-ctl tbody tr')];
      const cell = (tr, l) => { const td = tr.querySelector('[data-label="' + l + '"]'); return td ? td.textContent.trim() : ''; };
      return { rows: rows.length, total: window.NS.controls.length,
        ok: rows.every((tr) => ['Last test', 'Result', 'Evidence', 'Next test', 'Owner · scope'].every((l) => cell(tr, l).length > 0) && tr.querySelector('[data-label="Freshness"] .fresh')),
        levels: document.querySelectorAll('.pf-rung').length };
    });
    assert(r.rows === r.total, 'all ' + r.total + ' controls listed, got ' + r.rows);
    assert(r.ok, 'every row has last test, result, evidence, freshness and next test');
    assert(r.levels === 6, 'ladder L0–L5');
    await p.go('assurance/controls?r=fail');
    const f = await p.evaluate(() => ({ n: document.querySelectorAll('.pf-ctl tbody tr').length, allFail: [...document.querySelectorAll('.pf-ctl [data-label="Result"]')].every((x) => /Failed/.test(x.textContent)) }));
    await p.go('assurance/evidence');
    const e = await p.evaluate(() => ({ items: document.querySelectorAll('.pf-evi').length, tab: (document.querySelector('.pf-tabs [aria-selected="true"]') || {}).textContent }));
    clean(p, 'controls'); await p.closeAll();
    assert(f.n > 0 && f.allFail, 'result filter');
    assert(e.items === r.total && e.tab === 'Evidence locker', 'evidence tab lists every control');
  } },
  { name: 'review workbench shows the eight questions, launch conditions and a re-review date', async run({ page, assert }) {
    const p = await page('privacy/reviews');
    const list = await p.evaluate(() => ({ cards: document.querySelectorAll('.pf-rv').length, total: window.NS.reviews.length }));
    assert(list.cards === list.total, 'every review on the list');
    for (const fid of ['f_fraud', 'f_memory', 'f_pickup']) {
      await p.go('privacy/reviews/' + fid);
      const r = await p.evaluate(() => ({ q: document.querySelectorAll('.pf-8q tr[data-q]').length, conds: [...document.querySelectorAll('.pf-cond')].map((c) => ({ s: c.dataset.state, check: !!c.querySelector('.pf-kind') })),
        re: (document.querySelector('.pf-rereview') || {}).textContent || '', ev: document.querySelectorAll('.pf-need li').length, prom: document.querySelectorAll('.pf-pl li').length,
        missing: [...document.querySelectorAll('main [data-ent]')].filter((c) => !window.PCC.get(c.dataset.ent)).length }));
      assert(r.q === 8, fid + ': eight questions, got ' + r.q);
      assert(r.conds.length >= 2 && r.conds.every((c) => c.check && ['pass', 'fail', 'stale', 'unknown'].includes(c.s)), fid + ': launch conditions with their checks');
      assert(/\d{4}|sign-off|Due now|Expired/.test(r.re), fid + ': re-review stated: ' + r.re);
      assert(r.ev >= 1 && r.prom >= 1 && r.missing === 0, fid + ': evidence, promises, resolvable records');
    }
    clean(p, 'reviews'); await p.closeAll();
  } },
  { name: 'mobile: PROVE pages do not overflow at 390px', async run({ page, assert }) {
    for (const r of ['explore/person', 'assurance/controls', 'assurance/evidence', 'privacy/reviews', 'privacy/reviews/f_fraud']) {
      const p = await page(r, { width: 390 });
      const o = await p.evaluate(() => {
        document.querySelectorAll('main details').forEach((d) => { d.open = true; });
        const W = document.documentElement.clientWidth, over = document.documentElement.scrollWidth - W;
        const who = over > 0 ? [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > W + 1 && !e.closest('.tbl-wrap,.canvas,[hidden],[inert]')).slice(0, 4).map((e) => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right)) : [];
        return { over, who };
      });
      clean(p, r); await p.closeAll();
      assert(o.over <= 0, r + ': overflows by ' + o.over + 'px at 390: ' + o.who.join(' | '));
    }
  } },
];
