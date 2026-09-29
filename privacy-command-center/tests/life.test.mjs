/* Connected Life: the household as a data system — graph, people, physical actions,
 * routines, network context, inferences and offboarding (views-life.js over data-life.js). */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const AXE = fs.readFileSync(createRequire(path.join(process.env.A11Y_DEPS || process.cwd(), 'noop.js')).resolve('axe-core/axe.min.js'), 'utf8');
const clean = (p, t) => { if (p.errors.length) throw new Error(t + ': page errors: ' + p.errors.join(' | ')); };
const noJunk = (t) => !/\b(NaN|undefined|Infinity|\[object Object\])\b/.test(t);
const ROUTES = ['life/graph', 'life/people', 'life/actions', 'life/routines', 'life/networks', 'life/inferences', 'life/offboarding'];

export default [
  { name: 'Connected Life is a top-level area; every page renders, links to its essay scene, and cites records', async run({ page, assert }) {
    const p = await page('life/graph');
    const nav = await p.evaluate(() => { const h = [...document.querySelectorAll('.side h2')].find((x) => /Connected Life/.test(x.textContent)); const links = []; let n = h && h.nextElementSibling; while (n && n.tagName === 'A') { links.push(n.getAttribute('data-route')); n = n.nextElementSibling; } return links; });
    assert(JSON.stringify(nav) === JSON.stringify(['life/graph', 'life/people', 'life/actions', 'life/routines', 'life/networks', 'life/inferences', 'life/offboarding']), 'Connected Life nav group: ' + nav.join(', '));
    for (const r of ROUTES) {
      await p.go(r);
      const o = await p.evaluate(() => ({ t: document.querySelector('main').innerText, essay: (document.querySelector('main .essay-link a') || {}).href || '', cite: document.querySelectorAll('main .cite').length, err: !!document.querySelector('.err-state'),
        missing: [...document.querySelectorAll('main [data-ent]')].filter((c) => !window.PCC.get(c.dataset.ent)).length }));
      assert(!o.err && noJunk(o.t), r + ': renders without junk');
      assert(/every-arrow-is-a-decision\.html#(home|guest|door|routine|network|infer|oldkeys)$/.test(o.essay), r + ': links back to its essay scene: ' + o.essay);
      assert(o.cite >= 1 && o.missing === 0, r + ': cites records that resolve');
    }
    clean(p, 'life'); await p.closeAll();
  } },
  { name: 'household graph: the enlarged thirteen-link chain, and an arrow’s fourteen answers with UNKNOWN as a finding', async run({ page, assert }) {
    const p = await page('life/graph?a=ar_sdk');
    const r = await p.evaluate(() => ({ chain: [...document.querySelectorAll('.lf-chain li b')].map((b) => b.textContent), qs: document.querySelectorAll('.lf-14 > div').length,
      unk: document.querySelectorAll('.lf-14 > div.unk .unknown').length, want: window.NS.life.questions.filter((q) => window.NS.life.arrows.find((a) => a.id === 'ar_sdk')[q[0]] == null).length,
      devices: document.querySelectorAll('.lf-map .lf-dev').length, roomsDevs: window.NS.life.devices.filter((d) => d.room && d.room !== 'rm_ruth').length }));
    assert(r.chain.join(' → ') === 'Person → Household → Place → Device → Sensor → Account → Network → Cloud → Integration → Vendor → Inference → Automation → Physical action', 'chain: ' + r.chain.join(' → '));
    assert(r.qs === 14, 'fourteen questions, got ' + r.qs);
    const so = await p.evaluate(() => ({ rows: document.querySelectorAll('.lf-sol tbody tr').length, n: window.NS.life.solutions.length, st: [...document.querySelectorAll('.lf-sol tbody tr td:nth-child(3)')].every((td) => /in place|partly|not yet|no Northstar control/.test(td.textContent)) }));
    assert(so.rows === so.n && so.n === 10 && so.st, 'the ten engineering answers, each with a status');
    assert(r.want > 0 && r.unk === r.want, 'every unanswered question shown as UNKNOWN (' + r.unk + ' of ' + r.want + ')');
    assert(r.devices === r.roomsDevs, 'every device with a room is on the plan');
    clean(p, 'graph'); await p.closeAll();
  } },
  { name: 'people: eight distinct roles, and the guests who never agreed', async run({ page, assert }) {
    const p = await page('life/people');
    const r = await p.evaluate(() => ({ cols: [...document.querySelectorAll('.lf-roles thead th')].slice(1).map((t) => t.textContent), rows: document.querySelectorAll('.lf-roles tbody tr').length, guests: window.NS.life.guests.length,
      text: document.querySelector('main').innerText }));
    assert(JSON.stringify(r.cols) === JSON.stringify(['Device owner', 'Administrator', 'Data subject', 'Household member', 'Guest', 'Bystander', 'Installer', 'Vendor operator']), 'roles: ' + r.cols.join(', '));
    assert(r.rows === (await p.evaluate(() => window.NS.life.people.length)), 'every person has a row');
    assert(/of 8<\/b>|\d+ of 8/.test(r.text) && /biometric/i.test(r.text), 'counts who never agreed and who reaches a biometric system');
    clean(p, 'people'); await p.closeAll();
  } },
  { name: 'physical-action register: ten capabilities, identity assurance on every path, filters', async run({ page, assert }) {
    const p = await page('life/actions');
    const r = await p.evaluate(() => ({ groups: [...document.querySelectorAll('#lfReg .lf-grp th')].map((t) => t.textContent), rows: document.querySelectorAll('#lfReg tbody tr[data-pa]').length, n: window.NS.life.actions.length,
      tagged: [...document.querySelectorAll('#lfReg tbody tr[data-pa]')].every((tr) => tr.querySelector('.lf-as, .unknown')), navCount: (document.querySelector('.side a[data-route="life/actions"] .ct') || {}).textContent }));
    assert(r.groups.length === 10 && r.rows === r.n, 'all ' + r.n + ' paths in 10 capability groups: ' + r.groups.join(', '));
    assert(r.tagged, 'every path states its identity assurance');
    await p.go('life/actions?cap=unlock&weak=1');
    const f = await p.evaluate(() => [...document.querySelectorAll('#lfReg tbody tr[data-pa]')].map((tr) => tr.dataset.weak === '1' && tr.closest('tbody').querySelector('.lf-grp th').textContent === 'Unlocking'));
    assert(f.length >= 3 && f.every(Boolean), 'capability + weak-identity filter');
    assert(+r.navCount === (await p.evaluate(() => window.PCC.lifeWeakActions().length)), 'nav badge equals the weak-identity metric');
    clean(p, 'actions'); await p.closeAll();
  } },
  { name: 'automation review: every routine shows the fourteen review fields and a risk band', async run({ page, assert }) {
    const p = await page('life/routines');
    const r = await p.evaluate(() => [...document.querySelectorAll('.lf-rt')].map((a) => ({ f: [...a.querySelectorAll('.lf-rtf dt')].map((d) => d.textContent), band: !!a.querySelector('header .tag[class*="sev-"]') })));
    const want = ['Trigger', 'Conditions', 'Identity source · confidence', 'Privileges', 'Actions', 'Devices affected', 'Bystanders affected', 'When offline', 'Last review', 'Owner', 'Evidence', 'Emergency disable', 'Human confirmation', 'Safety and privacy consequence'];
    assert(r.length === (await p.evaluate(() => window.NS.life.automations.length)), 'every routine reviewed');
    assert(r.every((x) => JSON.stringify(x.f) === JSON.stringify(want) && x.band), 'fields in order, and a band');
    const top = await p.evaluate(() => document.querySelector('.lf-rt').dataset.rt);
    assert(top === 'au_welcome' || top === 'au_nova', 'highest risk first: ' + top);
    clean(p, 'routines'); await p.closeAll();
  } },
  { name: 'network context: moving a device shows what changes; eight things tracked for every network', async run({ page, assert }) {
    const p = await page('life/networks');
    const cols = await p.evaluate(() => document.querySelectorAll('section[aria-labelledby="lf-net-a"] thead th').length);
    assert(cols === 3 + 8, 'network, trust, operator + eight tracked, got ' + cols);
    await p.selectOption('[data-lf-net="to"]', 'nw_office'); await p.waitForTimeout(200);
    const r = await p.evaluate(() => ({ h: location.hash, diff: document.querySelectorAll('.lf-cmp .lf-diff').length, head: document.querySelector('.lf-cmp thead').innerText }));
    assert(/to=nw_office/.test(r.h) && /office/i.test(r.head) && r.diff > 0, 'compare follows the choice: ' + r.h);
    clean(p, 'networks'); await p.closeAll();
  } },
  { name: 'inferences carry provenance, confidence, permitted uses, correction and expiry; offboarding covers six layers', async run({ page, assert }) {
    const p = await page('life/inferences');
    const r = await p.evaluate(() => ({ heads: [...document.querySelectorAll('.lf-inf thead th')].map((t) => t.textContent), rows: [...document.querySelectorAll('.lf-inf tbody tr')].map((tr) => [...tr.children].map((c) => c.textContent.trim())) }));
    assert(['From', 'Confidence', 'Permitted uses', 'Explanation', 'Correction', 'Appeal', 'Expiry'].every((h) => r.heads.includes(h)), 'columns: ' + r.heads.join(', '));
    assert(r.rows.length >= 8 && r.rows.every((c) => c.every((x) => x.length) && /^\d+%$/.test(c[3])), 'every inference complete');
    await p.go('life/offboarding?t=tr_phone&care=r');
    const a = await p.evaluate(() => document.querySelectorAll('.lf-layers tbody tr.lf-rem').length);
    await p.go('life/offboarding?t=tr_phone&care=t');
    const b = await p.evaluate(() => ({ rem: document.querySelectorAll('.lf-layers tbody tr.lf-rem').length, layers: document.querySelectorAll('.lf-layers tbody tr').length, wf: document.querySelectorAll('.lf-wf').length }));
    assert(b.layers === 6 && a > b.rem, 'six layers; tombstones leave less behind than a reset (' + a + ' → ' + b.rem + ')');
    assert(b.wf === (await p.evaluate(() => window.NS.life.workflows.length)), 'every workflow shown');
    clean(p, 'inferences/offboarding'); await p.closeAll();
  } },
  { name: 'axe: no serious or critical WCAG 2.2 AA violations on any Connected Life page, at 1280 and 390px', async run({ page, assert }) {
    for (const width of [1280, 390]) {
      const p = await page('life/graph', { width });
      for (const r of ROUTES) {
        await p.go(r); await p.waitForTimeout(150);
        await p.addScriptTag({ content: AXE });
        const v = await p.evaluate(async () => (await window.axe.run(document.querySelector('main'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] }))
          .violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => x.id + ' (' + x.nodes.length + '): ' + x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')));
        assert(v.length === 0, r + ' @' + width + ': ' + v.join('; '));
      }
      clean(p, 'axe'); await p.closeAll();
    }
  } },
  { name: 'mobile: Connected Life pages do not overflow at 390px', async run({ page, assert }) {
    const p = await page('life/graph', { width: 390 });
    for (const r of ROUTES) {
      await p.go(r);
      const o = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, scroll: [...document.querySelectorAll('main .tbl-wrap, main .pv-scroll')].filter((el) => el.scrollWidth > el.clientWidth + 1).every((el) => el.tabIndex === 0 && el.getAttribute('role') === 'region' && el.getAttribute('aria-label')) }));
      assert(o.over <= 0, r + ': overflow ' + o.over);
      assert(o.scroll, r + ': scrollable regions are focusable and labelled');
    }
    clean(p, 'mobile'); await p.closeAll();
  } }
];
