/* Investigate: lineage and purpose, vendors and geography, AI and agents,
 * Worst Day and the Risk radar. Expectations are recomputed here from the raw
 * records (window.NS), never copied from the views. */
const clean = (p, t) => { if (p.errors.length) throw new Error(t + ': page errors: ' + p.errors.join(' | ')); };
/* A decimal that is not a people count ("2.4M") or a measured percentage
 * from evidence ("97.1% recall") is a score in disguise. */
const DECIMAL = /\b\d+\.\d+\b(?![MKB%])/;

export default [
  { name: 'AI inventory lists every model and traces customer conversations to exactly the models that hold them', async run({ page, assert }) {
    const p = await page('privacy/ai');
    const r = await p.evaluate(() => {
      const NS = window.NS, convo = NS.aiConversationData.map((x) => x.ds);
      const expected = NS.models.map((m) => {
        const x = NS.aiModels[m.id] || {};
        const vec = m.vector ? NS.datasets.filter((d) => d.system === m.vector).map((d) => d.id) : [];
        const src = [].concat(m.training, x.fineTune || [], x.rag || [], x.memory || [], vec);
        return { id: m.id, convo: src.some((d) => convo.includes(d)), src, neverForgets: !!(x.retrain && x.retrain.excludesDeleted === false) };
      });
      const cards = [...document.querySelectorAll('article.iv-model')].map((c) => ({ id: c.dataset.model, convo: !!c.querySelector('.iv-convo.yes'),
        ret: (c.querySelector('.ai-ret') || {}).textContent || '', unlearn: (c.querySelector('.ai-unlearn') || {}).textContent || '', agents: !!c.querySelector('.ai-agents') }));
      const links = [...document.querySelectorAll('table.ai-links tbody tr')].map((t) => t.dataset.model + '|' + t.dataset.ds);
      const agents = NS.agents.map((a) => { const c = document.querySelector('article.iv-agent[data-agent="' + a.id + '"]'); return { id: a.id, tools: a.tools.length, rows: c ? c.querySelectorAll('table.ag-tools tbody tr').length : 0, approval: c ? [...c.querySelectorAll('table.ag-tools tbody tr td:nth-child(5)')].every((td) => td.textContent.trim().length > 0) : false }; });
      return { expected, cards, links, agents, convoDs: convo };
    });
    clean(p, 'ai'); await p.closeAll();
    assert(r.cards.length === r.expected.length, 'one card per model: ' + r.cards.length + ' of ' + r.expected.length);
    for (const e of r.expected) {
      const c = r.cards.find((x) => x.id === e.id);
      assert(c, 'model missing from the inventory: ' + e.id);
      assert(c.convo === e.convo, e.id + ': conversation badge ' + c.convo + ', expected ' + e.convo);
      assert(/kept/i.test(c.ret), e.id + ': retention shown');
      assert(/leaves the model/.test(c.unlearn) && /Deletion path/.test(c.unlearn), e.id + ': deletion and unlearning limits shown');
      if (e.neverForgets) assert(/Never/.test(c.unlearn), e.id + ': a model that keeps deleted people must say so');
      assert(c.agents, e.id + ': agents section present');
      for (const d of e.src) assert(r.links.includes(e.id + '|' + d), 'lineage table misses ' + d + ' → ' + e.id);
    }
    assert(r.expected.filter((e) => e.convo).length >= 2, 'the synthetic data has several conversation-holding models');
    for (const d of r.convoDs) assert(r.links.some((l) => l.endsWith('|' + d)), 'conversation dataset ' + d + ' traced to a model');
    for (const a of r.agents) assert(a.rows === a.tools && a.approval, a.id + ': every tool listed with its approval boundary');
  } },
  { name: 'lineage shows origin → transformations → destinations and flags purpose drift at use', async run({ page, assert }) {
    const p = await page('explore/flows?d=d_fraudfeat');
    const r = await p.evaluate(() => {
      const NS = window.NS, rows = [...document.querySelectorAll('.iv-hops tbody tr[data-flow]')];
      const row = (id) => rows.find((t) => t.dataset.flow === id);
      const dirs = rows.map((t) => t.querySelector('.tag').textContent);
      const drifted = rows.filter((t) => /not collected for this/.test(t.textContent)).map((t) => t.dataset.flow);
      return { dirs, drifted, fl10tr: row('fl10') && row('fl10').children[2].textContent, want: NS.transforms.fl10,
        origin: document.body.innerText.includes(NS.origins.d_fraudfeat.how), edges: document.querySelectorAll('.iv-map .edge').length, arrows: document.querySelectorAll('.iv-map .edge path[marker-end]').length,
        legend: !!document.querySelector('.iv-mapcard .legend'), changes: [...document.querySelectorAll('.iv-ch-purpose')].map((x) => x.textContent) };
    });
    clean(p, 'lineage');
    assert(r.dirs.includes('upstream') && r.dirs.includes('downstream'), 'hops upstream and downstream: ' + r.dirs.join(','));
    assert(r.origin, 'origin of the records is stated');
    assert(r.fl10tr === r.want, 'transformation for fl10 shown: ' + r.fl10tr);
    assert(r.drifted.includes('fl10'), 'fraud features read for advertising flagged as not collected for this');
    assert(r.changes.some((t) => /PRV-0217/.test(t)), 'purpose drift at use cites its finding');
    assert(r.edges > 0 && r.arrows === r.edges && r.legend, 'map has arrowheads on every edge and a legend');
    await p.go('explore/flows?d=d_purchase');
    const s = await p.evaluate(() => ({ schema: [...document.querySelectorAll('.iv-ch-schema')].map((x) => x.textContent).join(' '), unknownTr: document.querySelectorAll('.iv-hops td:nth-child(3) .unknown').length }));
    assert(/precise_lat/.test(s.schema), 'schema change (new precise location fields) detected');
    assert(s.unknownTr > 0, 'hops nobody described show UNKNOWN transformations');
    await p.go('explore/flows?f=fl14');
    const f = await p.evaluate(() => ({ sel: !!document.querySelector('.iv-hops tr.iv-selrow[data-flow="fl14"]'), ds: document.getElementById('ivDs').value, mapSel: !!document.querySelector('.iv-map .edge.iv-sel[data-ent="fl14"]') }));
    clean(p, 'lineage 2'); await p.closeAll();
    assert(f.sel && f.mapSel && f.ds === 'd_lochist', 'a flow link opens its dataset with the arrow selected');
  } },
  { name: 'purpose: every open drift finding shows collection vs use and the promise it breaks', async run({ page, assert }) {
    const p = await page('privacy/purpose');
    const r = await p.evaluate(() => {
      const NS = window.NS, open = (f) => !['closed', 'mitigated', 'accepted'].includes(f.status);
      const drift = NS.findings.filter((f) => /PURPOSE DRIFT/.test(f.kind) && open(f));
      return { drift: drift.map((f) => ({ id: f.id, promises: NS.promises.filter((pr) => (pr.findings || []).includes(f.id)).map((pr) => pr.id) })),
        cards: [...document.querySelectorAll('article.iv-drift')].map((c) => ({ id: c.dataset.finding, links: [...c.querySelectorAll('.iv-proms a[href^="#/promises/"]')].map((a) => a.getAttribute('href').split('/').pop()), both: /At collection/.test(c.textContent) && /At use/.test(c.textContent) })),
        rows: document.querySelectorAll('.iv-ptab tbody tr').length, personal: NS.datasets.filter((d) => d.fields.some((x) => x[1] >= 2)).length };
    });
    clean(p, 'purpose'); await p.closeAll();
    assert(r.cards.length === r.drift.length, 'one card per open purpose-drift finding');
    for (const d of r.drift) {
      const c = r.cards.find((x) => x.id === d.id);
      assert(c && c.both, d.id + ': collection and use shown side by side');
      assert(d.promises.length > 0, d.id + ': synthetic data links it to a promise');
      for (const pr of d.promises) assert(c.links.includes(pr), d.id + ': promise ' + pr + ' linked');
    }
    assert(r.rows === r.personal, 'every personal dataset is in the table: ' + r.rows + ' of ' + r.personal);
  } },
  { name: 'vendors: every vendor listed with jurisdiction and deletion status, unknowns shown as unknown', async run({ page, assert }) {
    for (const route of ['explore/vendors', 'governance/vendors']) {
      const p = await page(route);
      const r = await p.evaluate(() => {
        const NS = window.NS;
        return { vendors: NS.vendors.map((v) => ({ id: v.id, del: (NS.vendorOps[v.id] || { deletion: { state: 'unknown' } }).deletion.state, subUnknown: v.subprocessors.some((s) => NS.subprocessors.find((x) => x.id === s).region === 'unknown'), contract: !!v.contract })),
          rows: [...document.querySelectorAll('table.vend-t tbody tr[data-vendor]')].map((t) => ({ id: t.dataset.vendor, jur: t.querySelector('.c-jur').textContent.trim(), jurUnk: !!t.querySelector('.c-jur .unknown'), del: t.querySelector('.c-del').textContent.trim(), delUnk: !!t.querySelector('.c-del .unknown'), conUnk: !!t.children[3].querySelector('.unknown') })),
          subs: document.querySelectorAll('tr[data-sub]').length, nsubs: NS.subprocessors.length };
      });
      clean(p, route); await p.closeAll();
      assert(r.rows.length === r.vendors.length, route + ': ' + r.rows.length + ' rows for ' + r.vendors.length + ' vendors');
      for (const v of r.vendors) {
        const row = r.rows.find((x) => x.id === v.id);
        assert(row && row.jur && row.del, route + ' ' + v.id + ': jurisdiction and deletion status present');
        assert(row.delUnk === (v.del === 'unknown'), route + ' ' + v.id + ': deletion unknown shown as UNKNOWN only when it is unknown');
        if (v.subUnknown) assert(row.jurUnk, route + ' ' + v.id + ': an unknown subprocessor jurisdiction is shown as unknown');
        if (!v.contract) assert(row.conUnk, route + ' ' + v.id + ': a missing contract is a finding');
      }
      assert(r.subs === r.nsubs, route + ': every subprocessor listed');
    }
  } },
  { name: 'Worst Day: safeguards move the blast radius in the expected direction, in bands not decimals', async run({ page, assert }) {
    const read = (p) => p.evaluate(() => { const e = document.querySelector('.iv-wd-res'); return { rank: +e.dataset.rank, points: +e.dataset.points, band: e.querySelector('.iv-wd-bw').textContent, text: e.innerText }; });
    const p = await page('privacy/worstday?ds=d_lochist');
    const a = await read(p);
    await p.check('[data-wd="ttl"]'); const b = await read(p);
    await p.check('[data-wd="tokenise"]'); const c = await read(p);
    await p.uncheck('[data-wd="ttl"]'); await p.uncheck('[data-wd="tokenise"]'); const back = await read(p);
    await p.check('input[name="wdSc"][value="vendor"]'); const vend = await read(p);
    clean(p, 'wd lochist'); await p.closeAll();
    assert(b.points < a.points && b.rank <= a.rank, 'enforcing retention makes it smaller: ' + a.points + ' → ' + b.points);
    assert(c.rank < a.rank, 'retention plus scoped tokens lowers the band: ' + a.band + ' → ' + c.band);
    assert(back.points === a.points && back.band === a.band, 'switching them off returns to today');
    assert(vend.rank === 0, 'no vendor holds location history, so a vendor breach is contained: ' + vend.band);
    for (const x of [a, b, c]) assert(!DECIMAL.test(x.text) && !/score/i.test(x.text), 'no decimal or score in the result: ' + x.text.slice(0, 120));
    const q = await page('privacy/worstday?ds=d_pulsecycle');
    const d = await read(q);
    await q.uncheck('[data-wd="keys"]'); const e = await read(q);
    clean(q, 'wd pulse'); await q.closeAll();
    assert(e.rank > d.rank, 'removing per-person keys (a control failure) makes a breach worse: ' + d.band + ' → ' + e.band);
  } },
  { name: 'risk radar explains every risk in words and shows no bare numbers', async run({ page, assert }) {
    for (const route of ['privacy/risks', 'privacy/risks?r=R-04', 'privacy/risks?r=R-08']) {
      const p = await page(route);
      const r = await p.evaluate(() => ({ items: [...document.querySelectorAll('.iv-risks .iv-risk')].map((li) => li.querySelector('p').textContent), n: window.NS.risks.length,
        text: document.querySelector('main').innerText, radar: !!document.querySelector('svg.iv-radar[role="img"][aria-label]'), rows: document.querySelectorAll('.iv-rf tbody tr').length, nf: window.NS.riskFactors.length,
        full: !!document.querySelector('.iv-rsel .rx-more'), unknownList: document.querySelectorAll('.iv-rsel .rx-more li.unknown').length }));
      clean(p, route); await p.closeAll();
      assert(r.items.length === r.n, route + ': every risk listed');
      for (const s of r.items) assert(/^(High|Medium|Low) because /.test(s), route + ': explained in words: ' + s);
      assert(!/residual\s*[:=]?\s*\d/i.test(r.text), route + ': a bare residual number');
      assert(!/\d\s*\/\s*5\b/.test(r.text) && !/\bscore\s*\d/i.test(r.text), route + ': a factor score');
      assert(!DECIMAL.test(r.text), route + ': a decimal: ' + (r.text.match(DECIMAL) || [])[0]);
      assert(r.radar && r.rows === r.nf && r.full, route + ': radar with a text alternative, a factor table and the full explanation');
    }
  } },
  { name: 'investigate pages: no errors, no NaN or undefined, no overflow at 1280 and 390', async run({ page, assert }) {
    for (const w of [1280, 390]) for (const r of ['explore/flows', 'explore/flows?d=d_identity_graph', 'privacy/purpose', 'explore/vendors', 'governance/vendors', 'explore/geo', 'privacy/ai', 'privacy/worstday', 'privacy/risks']) {
      const p = await page(r, { width: w });
      const x = await p.evaluate(() => ({ t: document.querySelector('main').innerText, o: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        regions: [...document.querySelectorAll('main .iv-scroll, main .tbl-wrap')].filter((e) => e.scrollWidth > e.clientWidth + 1).every((e) => e.tabIndex === 0 && e.getAttribute('role') === 'region' && e.getAttribute('aria-label')),
        cite: document.querySelectorAll('main .cite').length }));
      clean(p, r + '@' + w); await p.closeAll();
      assert(!/\b(NaN|undefined|Infinity)\b|\[object/.test(x.t), r + '@' + w + ': broken text');
      assert(x.o <= 0, r + '@' + w + ': overflows by ' + x.o + 'px');
      assert(x.regions, r + '@' + w + ': a scrolling box is not a labelled, focusable region');
      assert(x.cite > 0, r + '@' + w + ': cites its records');
    }
  } },
  { name: 'keyboard: a lineage arrow opens its record, and an agent opens with its chain', async run({ page, assert }) {
    const p = await page('explore/flows?d=d_fraudfeat');
    await p.focus('.iv-map .edge[data-ent="fl10"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
    const a = await p.evaluate(() => ({ open: document.getElementById('drawer').classList.contains('open'), t: document.getElementById('drawerBody').textContent }));
    await p.keyboard.press('Escape');
    await p.evaluate(() => window.PCC.open('ag_support')); await p.waitForTimeout(100);
    const b = await p.evaluate(() => ({ t: document.getElementById('drawerBody').textContent, cols: document.querySelectorAll('#drawerBody .chainx .cx').length }));
    clean(p, 'kbd'); await p.closeAll();
    assert(a.open && /fl10/.test(a.t), 'Enter on an arrow opens the flow record');
    assert(/Nova Support Agent/.test(b.t) && b.cols === 14, 'agent passport with the full chain');
  } },
];
