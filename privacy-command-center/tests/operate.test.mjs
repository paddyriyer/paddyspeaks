/* OPERATE: consent propagation, deletion verification, retention, rights reach, observability. */
const clean = (p, t) => { if (p.errors.length) throw new Error(t + ': page errors: ' + p.errors.join(' | ')); };
const ROUTES = ['observability', 'privacy/consent', 'privacy/deletion', 'privacy/retention', 'privacy/rights'];
/* nearest rank, as the page computes it */
const nr = (arr, q) => { const a = arr.filter((x) => x != null).sort((x, y) => x - y); return a.length ? a[Math.max(0, Math.ceil(q * a.length) - 1)] : null; };

export default [
  { name: 'consent: Dana’s revocation reaches each place in order, and the replay moves through time', async run({ page, assert }) {
    const p = await page('privacy/consent', { reducedMotion: 'reduce' });
    const r = await p.evaluate(() => {
      const D = NS.consentPipeline.dana, rows = [...document.querySelectorAll('#rpTable tbody tr')];
      const arr = rows.map((tr) => tr.getAttribute('data-arrive'));
      const inp = document.getElementById('rpT'), stops = [];
      for (let i = 0; i <= +inp.max; i++) {
        inp.value = i; inp.dispatchEvent(new Event('input', { bubbles: true }));
        stops.push({ out: document.getElementById('rpOut').textContent, cls: rows.map((tr) => tr.className.match(/rp-(has|old|never)/)[1]) });
      }
      inp.value = 0; inp.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('rpPlay').click();
      const after = rows.map((tr) => tr.className.match(/rp-(has|old|never)/)[1]);
      return { arr, ents: rows.map((tr) => tr.getAttribute('data-ent-id')), steps: D.steps.map((s) => s.c), copies: NS.consentPipeline.copies.map((c) => c.ent), stops, after, sum: document.getElementById('rpSum').textContent };
    });
    clean(p, 'consent'); await p.closeAll();
    for (const c of r.steps.concat(r.copies)) assert(r.ents.includes(c), 'replay row missing for ' + c);
    assert(r.arr.length === r.steps.length + r.copies.length, 'one row per consumer and copy');
    const nums = r.arr.map((a) => (a === '' ? Infinity : +a));
    for (let i = 1; i < nums.length; i++) assert(nums[i] >= nums[i - 1], 'rows are ordered by when her “no” arrives (row ' + i + ')');
    assert(r.stops.length >= 3, 'at least three points in time');
    let prevHas = -1;
    r.stops.forEach((s, i) => {
      const has = s.cls.filter((c) => c === 'has').length;
      assert(s.cls.slice(0, has).every((c) => c === 'has'), 'at stop ' + i + ' the places with her “no” are a prefix of the ordered list');
      assert(has >= prevHas, 'arrivals only accumulate over time'); prevHas = has;
      s.cls.forEach((c, j) => { if (nums[j] === Infinity) assert(c === 'never', 'a place that never receives it is never shown as having it'); });
    });
    assert(r.stops[0].cls.filter((c) => c === 'has').length === 0 || nums[0] === 0, 'nothing has her “no” at the moment she says it');
    assert(r.after.join() === r.stops[r.stops.length - 1].cls.join(), 'Replay (reduced motion) lands on today');
    assert(/of \d+ places have her “no”/.test(r.sum), 'summary counts shown');
  } },
  { name: 'consent: stale consumers flagged, P50/P95/P99 match the probe data, vendor acknowledgements shown', async run({ page, assert }) {
    const p = await page('privacy/consent');
    const r = await p.evaluate(() => {
      const e = document.getElementById('opE2E');
      return { probes: NS.consentPipeline.probes.map((x) => x.e2e), stale: [...document.querySelectorAll('tr[data-stale]')].map((t) => t.getAttribute('data-consumer')),
        expectStale: NS.consentConsumers.filter((c) => c.p50 == null || c.stale > 0).map((c) => c.id),
        p50: +e.dataset.p50, p95: +e.dataset.p95, p99: +e.dataset.p99, n: +e.dataset.n,
        shown: [...e.querySelectorAll('.op-sv')].slice(0, 3).map((x) => x.textContent), fmt: [+e.dataset.p50, +e.dataset.p95, +e.dataset.p99].map(PCC.fmtSecs),
        vend: [...document.querySelectorAll('.op-vack tbody tr')].map((t) => ({ v: t.getAttribute('data-vendor'), ack: t.getAttribute('data-ack'), unk: !!t.querySelector('em.unknown'), text: t.innerText })),
        dv: NS.consentPipeline.dana.vendors, chain: !!document.querySelector('.op-promise .chainx'), promise: document.querySelector('.op-promise').innerText };
    });
    clean(p, 'consent stats'); await p.closeAll();
    assert(r.stale.slice().sort().join() === r.expectStale.slice().sort().join(), 'stale consumers flagged: ' + r.stale.join() + ' vs ' + r.expectStale.join());
    const done = r.probes.filter((x) => x != null);
    assert(r.n === done.length, 'percentiles use completed probes only');
    assert(r.p50 === nr(done, 0.5) && r.p95 === nr(done, 0.95) && r.p99 === nr(done, 0.99), 'P50/P95/P99 are nearest-rank over the probes');
    assert(r.p50 <= r.p95 && r.p95 <= r.p99, 'percentiles ordered');
    assert(r.shown.join() === r.fmt.join(), 'the figures shown are the computed ones: ' + r.shown.join());
    assert(r.vend.length === r.dv.length, 'every vendor that received her data is listed');
    r.vend.forEach((x) => { const d = r.dv.find((y) => y.v === x.v); assert(d, 'vendor ' + x.v + ' comes from the data');
      assert((x.ack === 'yes') === !!d.ack, x.v + ': acknowledgement matches the data');
      if (!d.ack) assert(x.unk && !/acknowledged \d/.test(x.text), x.v + ': a missing acknowledgement is shown as UNKNOWN, not success'); });
    assert(r.chain && /PR-OPTOUT/.test(r.promise) && /D-104/.test(r.promise), 'tied to PR-OPTOUT and D-104 with the chain');
  } },
  { name: 'deletion: Dana’s table lists every location; reached/missed/unverified agree with the data; unverified is UNKNOWN', async run({ page, assert }) {
    const p = await page('privacy/deletion');
    const r = await p.evaluate(() => {
      const t = document.getElementById('opDelTable');
      return { rows: [...t.querySelectorAll('tbody tr')].map((tr) => ({ loc: tr.getAttribute('data-loc'), o: tr.getAttribute('data-outcome'), unk: !!tr.querySelector('td[data-label="Outcome"] em.unknown'), ok: /✓/.test(tr.querySelector('td[data-label="Outcome"]').textContent), fresh: !!tr.querySelector('.fresh') || !!tr.querySelector('td[data-label="Evidence"] em.unknown') })),
        data: NS.deletionTrace.locations, targets: NS.deletionTargets.map((x) => x[0] + '|' + x[1]), counts: { ...t.dataset }, answer: document.querySelector('.op-answer').innerText,
        canary: document.querySelectorAll('#op-can ~ * tbody tr, section[aria-labelledby="op-can"] tbody tr').length, cans: NS.deletionCanaries.length, promise: document.querySelector('.op-promise').innerText };
    });
    clean(p, 'deletion'); await p.closeAll();
    const locs = r.rows.map((x) => x.loc);
    assert(locs.length === r.data.length && new Set(locs).size === locs.length, 'one row per location');
    for (const k of r.targets) assert(locs.includes(k), 'deletion target missing from Dana’s table: ' + k);
    for (const l of r.data) assert(locs.includes(l.key), 'location missing: ' + l.key);
    const rule = (l) => (l.hold ? 'held' : l.check === 'found' || l.receipt === 'failed' || l.receipt === 'none' ? 'missed' : l.check === 'absent' || l.check === 'attested' ? 'reached' : 'unverified');
    const c = { reached: 0, missed: 0, unverified: 0, held: 0 };
    r.data.forEach((l) => { c[rule(l)]++; const row = r.rows.find((x) => x.loc === l.key); assert(row.o === rule(l), l.key + ': outcome ' + row.o + ' vs rule ' + rule(l)); });
    for (const k of Object.keys(c)) assert(+r.counts[k] === c[k], k + ': ' + r.counts[k] + ' shown vs ' + c[k] + ' in the data');
    assert(c.reached + c.missed + c.unverified + c.held === +r.counts.n, 'outcomes add up to the locations');
    assert(new RegExp(c.reached + ' reached').test(r.answer) && new RegExp(c.missed + ' missed').test(r.answer) && new RegExp(c.unverified + ' unverified').test(r.answer), 'the answer quotes the same counts');
    r.rows.filter((x) => x.o === 'unverified').forEach((x) => assert(x.unk && !x.ok, x.loc + ': unverified must be shown as UNKNOWN, never a tick'));
    assert(r.rows.every((x) => x.fresh), 'every row shows evidence freshness or an unknown');
    assert(r.canary >= r.cans, 'every canary run listed');
    assert(/PR-DELETE/.test(r.promise) && /D-107/.test(r.promise), 'tied to PR-DELETE and D-107');
  } },
  { name: 'retention: declared vs observed vs required, violations agree with the data, unscanned shown as unknown', async run({ page, assert }) {
    const p = await page('privacy/retention');
    const r = await p.evaluate(() => ({ viol: [...document.querySelectorAll('#opRetTable tr[data-viol]')].map((t) => t.getAttribute('data-ds')), rows: document.querySelectorAll('#opRetTable tbody tr').length,
      expect: NS.datasets.filter((d) => { const dec = NS.retentionPolicy.declared[d.id], sc = !NS.retentionPolicy.notScanned.includes(d.id); return sc && d.age != null && dec != null && dec > 0 && d.age > dec; }).map((d) => d.id),
      notScanned: NS.retentionPolicy.notScanned.map((id) => { const tr = document.querySelector('#opRetTable tr[data-ds="' + id + '"]'); return !!tr && !!tr.querySelector('em.unknown'); }),
      n: NS.datasets.length, holds: document.querySelectorAll('section[aria-labelledby="op-holds"] tbody tr').length, nh: NS.legalHolds.length }));
    clean(p, 'retention'); await p.closeAll();
    assert(r.rows === r.n, 'every dataset listed');
    assert(r.viol.slice().sort().join() === r.expect.slice().sort().join(), 'violations: ' + r.viol.join() + ' vs ' + r.expect.join());
    assert(r.notScanned.every(Boolean), 'datasets the scanner cannot see are shown as UNKNOWN');
    assert(r.holds === r.nh, 'legal holds listed');
  } },
  { name: 'rights: the reach table covers all seven rights, with counts that match the wiring, and Dana’s requests', async run({ page, assert }) {
    const p = await page('privacy/rights');
    const r = await p.evaluate(() => ({
      rows: [...document.querySelectorAll('#opReach tbody tr')].map((t) => ({ id: t.getAttribute('data-right'), cells: [...t.querySelectorAll('td')].map((c) => c.textContent.trim()) })),
      kinds: NS.rightKinds.map((k) => k.id),
      reach: Object.fromEntries(NS.rightKinds.map((k) => [k.id, k.id === 'DELETE' ? NS.deletionTargets.map((t) => (t[3] === 'verified' ? 'reached' : t[3] === 'failed' ? 'missed' : 'unverified')) : NS.rightsReach[k.id].map((x) => x[1])])),
      dana: [...document.querySelectorAll('.op-req')].map((a) => a.getAttribute('data-req')), danaData: NS.danaRequests.map((d) => d.id),
      legal: /not legal advice/.test(document.querySelector('main').innerText) }));
    clean(p, 'rights'); await p.closeAll();
    assert(r.rows.length === 7, 'seven rights, got ' + r.rows.length);
    assert(r.rows.map((x) => x.id).join() === r.kinds.join(), 'rows follow the seven rights');
    ['ACCESS', 'CORRECT', 'DELETE', 'PORT', 'RESTRICT', 'OBJECT', 'APPEAL'].forEach((k) => assert(r.kinds.includes(k), 'right ' + k + ' covered'));
    r.rows.forEach((x) => {
      const w = r.reach[x.id], cnt = (o) => w.filter((y) => y === o).length;
      assert(+x.cells[2] === cnt('reached') && +x.cells[3] === cnt('missed') && +x.cells[4] === cnt('unverified'), x.id + ': reach counts ' + x.cells.slice(2, 5).join('/'));
    });
    assert(r.dana.join() === r.danaData.join(), 'Dana’s requests shown');
    assert(r.legal, 'deadlines labelled as orientation, not legal advice');
  } },
  { name: 'observability: every signal has value, denominator, target, trend, coverage, owner, freshness and records, grouped by promise', async run({ page, assert }) {
    const p = await page('observability');
    const r = await p.evaluate(() => ({
      sigs: [...document.querySelectorAll('.op-sig')].map((s) => ({ id: s.getAttribute('data-signal'), dts: [...s.querySelectorAll('.op-sf dt')].map((d) => d.textContent), dds: [...s.querySelectorAll('.op-sf dd')].map((d) => d.textContent.trim()),
        recs: s.querySelectorAll('.cite [data-ent]').length, link: !!s.querySelector('a.op-open[href^="#/"]'), rule: (s.querySelector('details p') || {}).textContent || '', hist: s.querySelectorAll('.op-hist td').length })),
      groups: [...document.querySelectorAll('.op-grp')].map((g) => g.getAttribute('aria-labelledby')), glance: document.querySelectorAll('.op-glance tbody tr').length }));
    clean(p, 'observability'); await p.closeAll();
    assert(r.sigs.length >= 10, 'at least ten signals, got ' + r.sigs.length);
    ['e2e', 'stale', 'vack', 'delfail', 'surv', 'retviol', 'joins', 'denied', 'anom', 'weak', 'fresh'].forEach((id) => assert(r.sigs.some((s) => s.id === id), 'signal ' + id + ' present'));
    for (const s of r.sigs) {
      assert(['Denominator', 'Target', 'Trend', 'Coverage', 'Owner', 'Freshness'].every((k) => s.dts.includes(k)), s.id + ': fields ' + s.dts.join());
      assert(s.dds.every((d) => d.length > 0), s.id + ': no blank field');
      assert(s.recs >= 1 && s.link, s.id + ': links to its records');
      assert(s.rule.length > 30 && s.hist >= 2, s.id + ': says how it is computed, with weekly readings');
    }
    assert(r.groups.includes('grp-PR-OPTOUT') && r.groups.includes('grp-PR-DELETE'), 'grouped by the promise each protects');
    assert(r.glance === r.sigs.length, 'the glance table lists every signal');
  } },
  { name: 'operate pages: no overflow at 390px, no NaN/undefined, a promise and citations on every page', async run({ page, assert }) {
    for (const route of ROUTES) for (const width of [1280, 390]) {
      const p = await page(route, { width });
      /* The site-wide legal row (lib/ps-platform.js) is unstyled until its lazily
       * added stylesheet loads; measure layout once it has. */
      await p.waitForFunction(() => { const n = document.querySelector('[data-ps-legal]'); return n && getComputedStyle(n).display === 'flex'; }, null, { timeout: 4000 }).catch(() => {});
      const r = await p.evaluate(() => ({ o: document.documentElement.scrollWidth - document.documentElement.clientWidth, t: document.querySelector('main').innerText,
        cites: document.querySelectorAll('main .cite').length, promise: document.querySelectorAll('main .op-promise, main .op-grp, main .op-proms').length,
        scroll: [...document.querySelectorAll('main .tbl-wrap, main .pv-scroll')].filter((el) => el.scrollWidth > el.clientWidth + 1).every((el) => el.tabIndex === 0 && el.getAttribute('role') === 'region' && el.getAttribute('aria-label')) }));
      clean(p, route + '@' + width); await p.closeAll();
      assert(r.o <= 0, route + ' overflows by ' + r.o + 'px at ' + width);
      assert(!/\b(NaN|undefined|Infinity)\b|\[object/.test(r.t), route + ': broken value in text');
      assert(r.cites > 0 && r.promise > 0, route + ': promise and citations present');
      assert(r.scroll, route + ': scrolling containers are focusable, labelled regions');
    }
  } }
];
