/* Privacy Command Center v1: the Events layer.
 * EVENT → IDENTIFIER → SYSTEM → DERIVED DATA → INFERENCE. Expected values are
 * recomputed here from window.PG.events (an independent walk over each
 * event's own chain), not copied from the view. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clean = (p, what, assert) => assert(!p.errors.length, what + ': page errors ' + p.errors.join(' | '));
const click = (p, sel) => p.evaluate((s) => { const el = document.querySelector(s); if (!el) throw new Error('missing ' + s); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, sel);

const REQUIRED = ['Sign in', 'New device added', 'App installed', 'Permission granted', 'Location used', 'Search performed', 'Email sent', 'Calendar event created', 'File uploaded', 'File shared', 'Purchase made', 'Payment method used', 'Passkey created', 'Browser sync', 'Cloud backup', 'Account linked', 'Third-party app connected', 'Voice assistant used', 'AI assistant prompt', 'Photo uploaded', 'Contact accessed', 'Device telemetry sent', 'Security alert', 'Password / account recovery', 'Data exported', 'Account / data deleted'];
const CASES = ['Cross-device identity', 'Cloud sync', 'Single account across services', 'Third-party login', 'Permissions changing over time', 'Family / shared accounts', 'Work + personal crossover', 'Backup and restore', 'AI assistant context', 'Search → location → purchase', 'Photo metadata', 'Advertising and analytics', 'Account recovery and security', 'Deletion and export'];
const CHANGES = ['New service starts receiving location', 'Retention changed from 30 → 365 days', 'New identifier added', 'AI feature begins using email context', 'Third-party processor added', 'Purpose changed'];

export default [
  { name: 'events: every everyday event, ten families, the morning timeline, the use cases and six changes', async run({ page, assert }) {
    const p = await page('');
    const r = await p.evaluate(() => {
      const E = window.PG.events;
      return {
        types: E.types.map((t) => t.label), fams: E.families.map((f) => f.id), typeFams: E.types.every((t) => E.fam(t.fam)),
        chips: [...document.querySelectorAll('#evl .etl-i')].map((li) => li.querySelector('.evc-t').textContent + ' ' + li.querySelector('.evc-l').textContent),
        chipFam: [...document.querySelectorAll('#evl .etl-i')].map((li) => getComputedStyle(li.querySelector('.etl-dot')).backgroundColor),
        cases: E.cases.map((c) => c.title), changes: E.changes.map((c) => c.title),
        workspace: document.querySelectorAll('.ws .card').length, before: !!document.querySelector('#evl + .sent, #evl ~ .sent')
      };
    });
    clean(p, 'events home', assert); await p.closeAll();
    REQUIRED.forEach((x) => assert(r.types.includes(x), 'missing event type: ' + x));
    assert(r.fams.length === 10 && r.typeFams, 'ten families, every type in one: ' + r.fams);
    assert(r.chips.join('|') === ['8:02 AM Unlock phone', '8:04 AM Sign in', '8:06 AM Check email', '8:15 AM Search: “coffee near me”', '8:20 AM Maps: directions to a café', '8:32 AM Bought coffee', '9:10 AM Shared a file', '9:30 AM Asked AI about my flight'].join('|'), 'morning timeline: ' + r.chips.join('|'));
    assert(new Set(r.chipFam).size >= 6, 'families are told apart by colour: ' + new Set(r.chipFam).size);
    assert(CASES.every((c) => r.cases.includes(c)) && r.cases.includes('Devices across platforms'), 'the fourteen use cases, plus devices across platforms: ' + r.cases.join(', '));
    assert(JSON.stringify(r.changes) === JSON.stringify(CHANGES), 'the six changes: ' + r.changes.join(', '));
    assert(r.workspace === 3 && r.before, 'the events layer sits above an unchanged three-part workspace');
  } },
  { name: 'events: clicking an event highlights exactly what that event touched, recomputed from its own chain', async run({ page, assert }) {
    const p = await page('');
    const out = await p.evaluate(() => {
      const E = window.PG.events, res = [];
      for (const ev of E.day.events) {
        window.PCC1.set({ page: 'cc', et: 'day', e: ev.id });
        const set = E.compose(E.day);
        // independent walk: the event's own chain, then joins whose needs are all reached
        const t = E.type(ev.type), mine = {}; mine[ev.id] = 1;
        let grew = true; const chain = (ev.chain || t.chain).map((s) => s.replace(/^ev>/, ev.id + '>').split('>'));
        while (grew) { grew = false; chain.forEach(([a, b]) => { if (mine[a] && !mine[b]) { mine[b] = 1; grew = true; } }); set.edges.forEach((e) => { const n = E.nodes[e.b]; if (n && n.needs && mine[e.a] && !mine[e.b] && set.nodes[e.b]) { mine[e.b] = 1; grew = true; } }); }
        const on = [...document.querySelectorAll('#eg .en.on')].map((b) => b.getAttribute('data-n')).sort();
        res.push({ id: ev.id, on, want: Object.keys(mine).sort(), story: document.querySelector('.estory').innerText, pressed: document.getElementById('evc-' + ev.id).getAttribute('aria-pressed'), paths: document.querySelectorAll('#eg .ee.on').length });
      }
      return res;
    });
    clean(p, 'highlight', assert); await p.closeAll();
    out.forEach((o) => {
      assert(JSON.stringify(o.on) === JSON.stringify(o.want), o.id + ': highlighted ' + o.on.join(',') + ' expected ' + o.want.join(','));
      assert(o.pressed === 'true' && o.paths > 0, o.id + ': chip pressed and its lines drawn');
      assert(/EVENT[\s\S]*IDENTIFIER[\s\S]*SYSTEM[\s\S]*DERIVED DATA[\s\S]*INFERENCE/i.test(o.story), o.id + ': the story reads event → identifier → system → derived data → inference');
    });
    const coffee = out.find((o) => o.id === 'm6'), ai = out.find((o) => o.id === 'm8');
    assert(coffee.on.includes('i_tok') && coffee.on.includes('x_merchant') && coffee.on.includes('d_purchase') && !coffee.on.includes('d_lochist'), 'bought coffee: token, shop, receipt; not location history');
    assert(ai.on.includes('s_mail') && ai.on.includes('s_cal') && ai.on.includes('n_itinerary'), 'asked AI about my flight: mail, calendar, itinerary');
  } },
  { name: 'events: the graph draws collected, derived, inferred, shared-outside and deleted nodes differently', async run({ page, assert }) {
    const p = await page('#cc?et=cases&e=deletion');
    const r = await p.evaluate(() => {
      const st = (sel) => { const el = document.querySelector('#eg ' + sel); if (!el) return null; const c = getComputedStyle(el); return { bs: c.borderStyle, bg: c.backgroundImage, bc: c.backgroundColor, td: getComputedStyle(el.querySelector('.en-n')).textDecorationLine, t: el.innerText }; };
      const o = { collected: st('.s-collected[data-n="d_purchase"]'), shared: st('.s-shared[data-n="d_theircopy"]'), gone: st('.gone[data-n="d_searchhist"]') };
      window.PCC1.set({ et: 'day', e: 'm8' });
      o.derived = st('.s-derived[data-n="d_ctx"]'); o.inferred = st('.s-inferred[data-n="n_itinerary"]');
      return o;
    });
    clean(p, 'node styles', assert); await p.closeAll();
    assert(r.collected && r.collected.bs === 'solid' && r.collected.bg === 'none', 'collected: solid');
    assert(r.derived && /repeating-linear-gradient/.test(r.derived.bg), 'derived: striped');
    assert(r.inferred && r.inferred.bs === 'dotted', 'inferred: dotted');
    assert(r.shared && r.shared.bs === 'solid' && /↗/.test(r.shared.t), 'shared outside: outlined, with an arrow');
    assert(r.gone && r.gone.bs === 'dashed' && r.gone.td === 'line-through' && /deleted/i.test(r.gone.t), 'deleted: faded, struck through, and labelled (not by fading alone)');
  } },
  { name: 'events: “Why is this connected?” answers six questions, and each decision changes what can be inferred', async run({ page, assert }) {
    const p = await page('#cc?e=m5');
    await click(p, '[data-ek="i_acct>s_maps"]');
    const why = await p.evaluate(() => ({ h: document.getElementById('whyH').textContent, dts: [...document.querySelectorAll('.why .whyl dt')].map((d) => d.textContent), acts: [...document.querySelectorAll('.why .act')].map((b) => b.textContent) }));
    const dead = () => p.evaluate(() => { const e = window.PCC1.events(); return Object.keys(e.st).filter((k) => k !== '__short' && !e.st[k].ok).sort(); });
    const expect = (dec) => p.evaluate((dec) => { const E = window.PG.events, st = E.evaluate(E.compose(E.day), dec); return Object.keys(st).filter((k) => k !== '__short' && !st[k].ok).sort(); }, dec);
    await click(p, '[data-do="scope"][data-ek="i_acct>s_maps"]');
    const scoped = await dead(), res1 = await p.evaluate(() => document.querySelector('.act-res').textContent);
    await click(p, '[data-do="scope"][data-ek="i_acct>s_maps"]');
    const undone = await dead();
    await click(p, '[data-n="d_lochist"]'); await click(p, '[data-ek="s_maps>d_lochist"]'); await click(p, '[data-do="short"][data-ek="s_maps>d_lochist"]');
    const shortened = await dead(), res2 = await p.evaluate(() => document.querySelector('.act-res').textContent);
    await click(p, '[data-evreset]');
    await click(p, '[data-n="n_away"]'); await click(p, '[data-ek="n_homework>n_away"]'); await click(p, '[data-do="cut"][data-ek="n_homework>n_away"]');
    const cut = await dead();
    const vs = { scope: await expect({ 'i_acct>s_maps': 'scope' }), short: await expect({ 's_maps>d_lochist': 'short' }), cut: await expect({ 'n_homework>n_away': 'cut' }) };
    clean(p, 'why', assert); await p.closeAll();
    assert(/Account ID → Maps/.test(why.h), 'asks about the clicked connection: ' + why.h);
    assert(JSON.stringify(why.dts) === JSON.stringify(['Purpose', 'Needed?', 'Identifier used', 'Retention', 'Who can use it?', 'Can these contexts be separated?']), 'six answers: ' + why.dts);
    assert(JSON.stringify(why.acts) === JSON.stringify(['Keep connection', 'Scope it', 'Shorten retention', 'Separate contexts']), 'four decisions: ' + why.acts);
    assert(JSON.stringify(scoped) === JSON.stringify(vs.scope) && scoped.includes('n_away') && scoped.includes('n_habit') && !scoped.includes('n_commute'), 'scoping Maps breaks the cross-service joins only: ' + scoped);
    assert(/can no longer recognize the same person/.test(res1), 'scoping says so in plain words: ' + res1);
    assert(!undone.length, 'pressing the decision again undoes it');
    assert(JSON.stringify(shortened) === JSON.stringify(vs.short) && shortened.includes('n_commute'), 'shorter location history: no commute pattern: ' + shortened);
    assert(/Too short to build/.test(res2), 'shortening explains what it stops: ' + res2);
    assert(JSON.stringify(cut) === JSON.stringify(vs.cut) && JSON.stringify(cut) === JSON.stringify(['n_away']), 'separating home from the itinerary removes only “away from home”: ' + cut);
  } },
  { name: 'events: every connection in every view can answer “why”, in plain words', async run({ page, assert }) {
    const p = await page('');
    const bad = await p.evaluate(() => {
      const E = window.PG.events, out = [];
      const defs = [E.day].concat(E.cases).concat(E.types.map((t) => ({ id: t.id, inf: 'all', events: [{ id: 'x1', type: t.id, label: t.label }] })));
      E.changes.forEach((c) => defs.push(Object.assign({}, E.day, { id: c.id, _x: { add: c.add, mark: c.edge } })));
      const JARGON = /identity resolution|deterministic|control failure|data subject|processing activit|lawful basis|pseudonymi|minimi[sz]ation|undefined|NaN/i;
      for (const d of defs) {
        const set = E.compose(d, d._x);
        for (const e of set.edges) {
          const x = E.explain(set, e.k, 'all', E.evaluate(set, {}));
          ['why', 'need', 'id', 'ret', 'who', 'sep'].forEach((f) => { if (!x[f] || JARGON.test(x[f])) out.push(d.id + ' ' + e.k + ' ' + f + ': ' + x[f]); });
          if (!E.needs[x.need]) out.push(d.id + ' ' + e.k + ': need ' + x.need);
        }
      }
      E.changes.forEach((c) => { const set = E.compose(E.day, { add: c.add, mark: c.edge }); if (!set.ek[c.edge]) out.push(c.id + ': its edge is not in the graph'); });
      const ch = E.changes.find((c) => c.kind === 'Retention'); if (E.nodes[ch.node].ret[1] !== ch.to) out.push('retention change disagrees with the record');
      return out;
    });
    const src = fs.readFileSync(path.join(DIR, 'events.js'), 'utf8');
    clean(p, 'plain', assert); await p.closeAll();
    assert(!bad.length, bad.slice(0, 8).join('\n'));
    assert(!/identity resolution|control failure|lawful basis|data subject/i.test(src), 'events.js keeps to plain language');
    assert(/These two services can recognize the same person/.test(fs.readFileSync(path.join(DIR, 'app.js'), 'utf8')), 'joins are named in plain words');
  } },
  { name: 'events: ecosystems relabel the same pattern; they never change its shape', async run({ page, assert }) {
    const p = await page('#cc?e=m8');
    const shape = () => p.evaluate(() => ({ nodes: [...document.querySelectorAll('#eg [data-n]')].map((b) => b.getAttribute('data-n')).join(','), on: [...document.querySelectorAll('#eg .en.on')].length, names: [...document.querySelectorAll('#eg .k-sys .en-n')].map((x) => x.textContent), note: (document.querySelector('.eco-n') || {}).textContent || '', one: (document.querySelector('.ecobar .oneid-h') || {}).textContent || '', svc: document.querySelectorAll('.ecobar .oneid-l li').length }));
    const all = await shape(), out = {};
    for (const eco of ['apple', 'google', 'ms']) { await click(p, '[data-eco="' + eco + '"]'); out[eco] = await shape(); }
    await click(p, '[data-eco="mixed"]'); const mixed = await shape();
    const svc = await p.evaluate(() => Object.fromEntries(window.PG.events.ecos.filter((e) => e.services).map((e) => [e.id, e.services.length])));
    const hash = await p.evaluate(() => location.hash.replace('eco=mixed', 'eco=ms'));
    clean(p, 'eco', assert); await p.closeAll();
    for (const eco of ['apple', 'google', 'ms']) {
      const o = out[eco];
      assert(o.nodes === all.nodes && o.on === all.on, eco + ': same nodes and highlight as All');
      assert(o.names.some((n) => /-like/.test(n)) && o.names.join() !== all.names.join(), eco + ': relabelled with -like names: ' + o.names.join(', '));
      assert(/synthetic/.test(o.note) && /not|none/i.test(o.note), eco + ': says it is synthetic and not a claim about any company');
      assert(o.svc === svc[eco] && new RegExp(svc[eco] + ' services').test(o.one), eco + ': one identity in front of ' + svc[eco] + ' services');
    }
    assert(/eco=ms/.test(hash) && /e=m8/.test(hash), 'the ecosystem and the event are in the URL: ' + hash);
    assert(mixed.nodes === all.nodes && mixed.on === all.on && mixed.names.includes('iPhone-like phone'), 'mixed devices relabel the morning without changing its shape: ' + mixed.names.join(', '));
  } },
  { name: 'events: the use cases tell their stories (AI context, intent, permissions, family, deletion, changes)', async run({ page, assert }) {
    const p = await page('#cc?et=cases&e=aictx');
    const r = await p.evaluate(() => {
      const E = window.PG.events, o = {}, txt = (s) => (document.querySelector(s) || {}).innerText || '';
      o.ctxRows = document.querySelectorAll('.ctxt tbody tr').length;
      o.ctxWant = E.compose(E.caseById('aictx')).edges.filter((e) => e.b === 'd_ctx').length;
      o.reach = txt('.xp');
      // leave out every Optional source: the answer still works
      const cutK = (k) => document.querySelector('.ctxt [data-do="cut"][data-ek="' + k + '"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const aset = E.compose(E.caseById('aictx'));
      aset.edges.filter((e) => e.b === 'd_ctx' && E.explain(aset, e.k, 'all', {}).need === 'optional').forEach((e) => cutK(e.k));
      o.itinAfterOptional = window.PCC1.events().st.n_itinerary.ok;
      cutK('d_res>d_ctx');
      o.itinAfterRes = window.PCC1.events().st.n_itinerary.ok;
      // search → location → purchase: the inference needs all three
      window.PCC1.set({ et: 'cases', e: 'intent' });
      const set = E.compose(E.caseById('intent'));
      o.intentSrc = E.sources(set, 'n_expecting').length; o.alone = document.querySelectorAll('.comb .evc-f').length;
      o.partial = E.compose(Object.assign({}, E.caseById('intent'), { events: E.caseById('intent').events.slice(0, 2) })).nodes.n_expecting ? 'present' : 'absent';
      window.PCC1.set({ et: 'cases', e: 'permissions' }); o.perm = txt('.xp');
      o.permMonths = Math.round((Date.parse(E.asOf) - Date.parse(E.caseById('permissions').perm.granted)) / 864e5 / 30.44);
      window.PCC1.set({ et: 'cases', e: 'family' }); o.family = txt('.xp:last-of-type');
      window.PCC1.set({ et: 'cases', e: 'deletion' }); o.del = txt('.xp');
      const dset = E.compose(E.caseById('deletion')), rows = Object.keys(dset.nodes).filter((id) => E.nodes[id] && E.nodes[id].kind === 'data' && id !== 'd_delrec');
      o.delGone = rows.filter((id) => !E.onDel[E.nodes[id].onDel][0]).length; o.delKept = rows.length - o.delGone;
      window.PCC1.set({ et: 'changes', e: 'ch1' }); o.chg = txt('.chgbox'); o.newLine = document.querySelectorAll('#eg .ee.m-new').length; o.newNode = !!document.querySelector('#eg .is-new[data-n="s_weather"]');
      o.unreviewed = document.querySelectorAll('.chc:not(.rv)').length; o.unreviewedWant = E.changes.filter((c) => !c.reviewed).length;
      // every case and type renders without junk
      o.junk = [];
      E.cases.forEach((c) => { window.PCC1.set({ et: 'cases', e: c.id }); if (/undefined|NaN|\[object/.test(document.getElementById('evl').innerText) || !document.querySelector('#eg')) o.junk.push(c.id); });
      E.types.forEach((t) => { window.PCC1.set({ et: 'all', e: t.id }); if (/undefined|NaN|\[object/.test(document.getElementById('evl').innerText) || !document.querySelector('#eg .en.on')) o.junk.push(t.id); });
      return o;
    });
    clean(p, 'cases', assert); await p.closeAll();
    assert(r.ctxRows === r.ctxWant && r.ctxWant >= 6, 'AI context lists everything the assistant receives: ' + r.ctxRows);
    assert(/one feature reaches 5 services/.test(r.reach) && /see all of them at once/.test(r.reach), 'AI context asks the one-feature question: ' + r.reach.slice(0, 160));
    assert(r.itinAfterOptional === true && r.itinAfterRes === false, 'optional sources can go and the answer survives; without the reservation it cannot');
    assert(r.intentSrc === 3 && r.partial === 'absent' && r.alone === 3, 'intent appears only when search, location and purchase are joined');
    assert(new RegExp(r.permMonths + ' months ago').test(r.perm) && /Still on/.test(r.perm), 'permissions: months computed from the dates: ' + r.perm);
    assert(/UNKNOWN/.test(r.family) && /cannot tell/.test(r.family), 'family: whose activity is an honest unknown');
    assert(new RegExp(r.delGone + ' records? deleted; ' + r.delKept + ' records remain').test(r.del) && /Kept by law/i.test(r.del) && /Outside your reach/i.test(r.del), 'deletion: what goes and what stays, counted: ' + r.del.slice(0, 120));
    assert(/did not go through review/.test(r.chg) && r.newLine >= 1 && r.newNode, 'a change is marked new on the graph and says it was not reviewed');
    assert(r.unreviewed === r.unreviewedWant, 'unreviewed changes stand out');
    assert(!r.junk.length, 'every use case and event renders: ' + r.junk.join(', '));
  } },
  { name: 'events: review presets are valid selectors, the keyboard reaches every connection, focus mode hides the layer', async run({ page, assert }) {
    const p = await page('');
    const bad = await p.evaluate(() => {
      const E = window.PG.events, out = [];
      [E.day].concat(E.cases).concat(E.types).forEach((x) => { const c = x.cc, f = window.PCC1.fit({ s: c.s, j: c.j, q: c.q }); if (f.s !== c.s || f.j !== c.j || f.q !== c.q) out.push((x.id) + ': ' + JSON.stringify(c) + ' → ' + JSON.stringify({ s: f.s, j: f.j, q: f.q })); });
      return out;
    });
    await p.evaluate(() => window.PCC1.set({ et: 'day', e: 'm6' }));
    const keys = await p.evaluate(() => {
      const listed = [...document.querySelectorAll('#evi .cx')].map((b) => b.getAttribute('data-ek')).sort();
      const E = window.PG.events, set = E.compose(E.day), R = E.reach(set, 'm6');
      return { listed, want: set.edges.filter((e) => R[e.a] && R[e.b]).map((e) => e.k).sort(), svgHidden: document.querySelector('.eg-svg').getAttribute('aria-hidden') };
    });
    await p.focus('#evi .cx'); await p.keyboard.press('Enter');
    const after = await p.evaluate(() => ({ why: !!document.getElementById('whyH'), focus: document.activeElement.id }));
    await click(p, '[data-evcc]');
    const ws = await p.evaluate(() => window.PCC1.state());
    clean(p, 'presets', assert); await p.closeAll();
    const fm = await page('#cc?fm=1&e=m6');
    const hidden = await fm.evaluate(() => getComputedStyle(document.getElementById('evl')).display);
    clean(fm, 'fm', assert); await fm.closeAll();
    assert(!bad.length, 'review presets rewritten by the surface rules:\n' + bad.join('\n'));
    assert(JSON.stringify(keys.listed) === JSON.stringify(keys.want) && keys.svgHidden === 'true', 'the inspector lists every connection the event touches, as buttons');
    assert(after.why && after.focus === 'whyH', 'Enter on a listed connection opens “Why is this connected?” and moves focus to it');
    assert(ws.s === 'pay' && ws.j === 'pay' && ws.q === 'where', 'review in the workspace sets the selectors for the event: ' + JSON.stringify(ws));
    assert(hidden === 'none', 'focus mode hides the events layer');
  } },
  { name: 'events: devices across platforms: each platform account sees only its own devices, and the linking moves to what runs everywhere', async run({ page, assert }) {
    const p = await page('#cc?et=cases&e=xplat');
    const read = () => p.evaluate(() => {
      const e = window.PCC1.events(), E = window.PG.events, dv = window.PCC1.state().dv || E.dvDefault;
      return { dv, accounts: E.devAccounts(dv).map((a) => a.label + ':' + a.devices.join('+')), head: (document.querySelector('.dv-h') || {}).textContent || '', rows: [...document.querySelectorAll('.dv-acc li')].map((li) => li.innerText.replace(/\s+/g, ' ')),
        sysNames: [...document.querySelectorAll('#eg .k-sys .en-n')].map((x) => x.textContent), xplat: e.st.n_xplat && e.st.n_xplat.ok, laptopOnPhoneAccount: !!e.set.ek['i_dev2>s_account'], hash: location.hash };
    });
    const mixed = await read();
    await p.selectOption('#dv-case-laptop', 'mac'); await p.waitForTimeout(60); await p.selectOption('#dv-case-tablet', 'ipad'); await p.waitForTimeout(60);
    const apple = await read();
    await p.selectOption('#dv-case-phone', 'android'); await p.selectOption('#dv-case-laptop', 'linux'); await p.selectOption('#dv-case-tablet', 'none'); await p.waitForTimeout(60);
    const linux = await read();
    await p.evaluate(() => window.PCC1.set({ dv: '' }));
    await click(p, '[data-ek="i_email>s_sync"]'); await click(p, '[data-do="scope"][data-ek="i_email>s_sync"]');
    const scoped = await p.evaluate(() => window.PCC1.events().st.n_xplat.ok);
    const want = await p.evaluate(() => ({ def: window.PG.events.devAccounts('ios.win.androidtab').length, mac: window.PG.events.devAccounts('ios.mac.ipad').length }));
    clean(p, 'xplat', assert); await p.closeAll();
    assert(mixed.accounts.length === want.def && /3 platform accounts across 3 devices; none of them sees every device/.test(mixed.head), 'iPhone + Windows + Android: three accounts, none sees every device: ' + mixed.head);
    assert(mixed.sysNames.includes('Apple-like Account') && mixed.sysNames.includes('Microsoft-like Account') && mixed.sysNames.includes('Google-like Account') && !mixed.laptopOnPhoneAccount, 'each device signs in to its own platform account: ' + mixed.sysNames.join(', '));
    assert(mixed.xplat, 'mixed platforms are still one person, through what runs everywhere');
    assert(apple.accounts.length === want.mac && /One platform account, the Apple-like Account, sees all 3 devices/.test(apple.head) && apple.laptopOnPhoneAccount && apple.xplat && /dv=ios\.mac\.ipad/.test(apple.hash), 'one family: one account sees every device; the mix is in the URL: ' + apple.head + ' ' + apple.hash);
    assert(linux.rows.some((r) => /Linux laptop → Local sign-in/.test(r)) && linux.rows.length === 2 && linux.xplat, 'a Linux laptop has no platform account, a missing tablet is left out, and the person is still joined: ' + linux.rows.join(' | '));
    assert(scoped === false, 'scoping the email address on browser sync breaks the cross-platform join');
  } },
  { name: 'events: on a phone every tab, case and open question fits the screen', async run({ page, assert }) {
    const p = await page('', { width: 390, height: 844 });
    const bad = await p.evaluate(async () => {
      const E = window.PG.events, W = document.documentElement.clientWidth, out = [];
      const views = [{ et: 'day', e: '' }, { et: 'all', e: '' }, { et: 'changes', e: '' }, { et: 'cases', e: '' }].concat(E.day.events.map((e) => ({ et: 'day', e: e.id }))).concat(E.cases.map((c) => ({ et: 'cases', e: c.id }))).concat(E.changes.map((c) => ({ et: 'changes', e: c.id })));
      for (const eco of ['all', 'ms', 'mixed']) for (const v of views) {
        window.PCC1.set(Object.assign({ page: 'cc', eco }, v));
        const n = document.querySelector('#eg [data-n]'); if (n && v.et === 'cases') n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const ek = document.querySelector('#evi [data-ek]'); if (ek) ek.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const tag = eco + ':' + v.et + '/' + v.e;
        if (document.documentElement.scrollWidth > W) out.push(tag + ': page scrolls sideways');
        for (const el of document.querySelectorAll('#evl *')) {
          if (el.closest('.sr-only') || el.closest('svg')) continue;
          const r = el.getBoundingClientRect();
          if (r.width && r.height && (r.right > W + 1 || r.left < -1)) { out.push(tag + ': ' + (el.getAttribute('class') || el.tagName) + ' spans ' + Math.round(r.left) + '–' + Math.round(r.right)); break; }
        }
        if (out.length > 8) break;
      }
      return out;
    });
    clean(p, 'phone events', assert); await p.closeAll();
    assert(!bad.length, bad.join('\n'));
  } },
  { name: 'events: axe finds no serious or critical issue in the events layer, open or closed, desktop or phone', async run({ page, assert }) {
    const req = createRequire(path.join(process.env.A11Y_DEPS || process.cwd(), 'noop.js'));
    const AXE = fs.readFileSync(req.resolve('axe-core/axe.min.js'), 'utf8');
    const bad = [];
    for (const [hash, width, js] of [['', 1280], ['#cc?e=m6', 1280], ['#cc?e=m5', 1280, '[data-ek="i_acct>s_maps"]'], ['#cc?et=cases&e=aictx&eco=google', 1280], ['#cc?et=cases&e=deletion', 1280], ['#cc?et=changes&e=ch2', 1280], ['#cc?et=all&e=passkey', 1280], ['#cc?e=m8', 390, '#evi [data-ek]'], ['#cc?et=cases&e=intent', 390], ['#cc?et=cases&e=xplat', 1280], ['#cc?eco=mixed&e=m2&dv=android.linux.none', 390]]) {
      const p = await page(hash, { width });
      if (js) await click(p, js);
      await p.addScriptTag({ content: AXE });
      const v = await p.evaluate(async () => (await window.axe.run(document.getElementById('evl'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] })).violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => x.id + ' ×' + x.nodes.length + ' ' + x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')));
      clean(p, 'axe ' + hash, assert); await p.closeAll();
      v.forEach((x) => bad.push((hash || 'home') + '@' + width + ': ' + x));
    }
    assert(!bad.length, bad.join('\n'));
  } }
];
