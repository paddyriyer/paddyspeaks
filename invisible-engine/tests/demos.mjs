// The Invisible Engine — demo model tests (no browser, no dependencies).
//   node invisible-engine/tests/demos.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'demos');
const load = (f) => { const ctx = { globalThis: {} }; ctx.globalThis = ctx; vm.runInNewContext(fs.readFileSync(path.join(DIR, f), 'utf8'), ctx); return ctx; };
let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('✗ ' + msg); } };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// Demo A: k(d) = (R²/(R²+d²))^1.5
const A = load('coil.js').IEDemoA.model;
ok(near(A.coupling(0), 1), 'coupling is 1 at the reader');
ok(near(A.coupling(A.R_CM), Math.pow(0.5, 1.5)), 'coupling at d = R is 2^-1.5');
let prev = 2;
for (let d = 0; d <= 10; d += 0.25) { const k = A.coupling(d); ok(k < prev || d === 0, `coupling decreases with distance (d=${d})`); ok(k > 0 && k <= 1, `coupling within (0, 1] at d=${d}`); prev = k; }
const dmax = A.maxRangeCm();
ok(A.powered(dmax - 0.01) && !A.powered(dmax + 0.01), 'powered threshold matches maxRangeCm');
ok(dmax > 1 && dmax < 6, 'illustrative working range is a few centimetres');
// far-field behaviour: roughly 1/d³ beyond the radius
ok(near(A.coupling(30) / A.coupling(60), 8, 0.5), 'beyond the loop radius coupling falls roughly as 1/d³');

// Demo B: views never call a plastic card tokenised or a payment anonymous
const B = load('wallet.js').IEDemoB.VIEWS;
const cardText = B.card.parties.map((p) => p.join(' ')).join(' ').toLowerCase();
const walletText = B.wallet.parties.map((p) => p.join(' ')).join(' ').toLowerCase();
ok(/card number \(pan\)/.test(cardText), 'plastic card: merchant receives the card number');
ok(!/token/.test(cardText), 'plastic card view never mentions a token');
ok(/device token \(not the card number\)/.test(walletText), 'wallet: merchant receives a device token');
ok(/authenticates on the phone every time/.test(walletText), 'wallet: user authentication on every payment');
ok(!/anonymous/.test(cardText + walletText) || /not anonymous/.test(cardText + walletText), 'no party view claims anonymity');
for (const k of ['card', 'wallet']) ok(B[k].parties.some((p) => /issuer/i.test(p[0])), `${k}: issuer view present`);


// Demo C: the BLE whisper — duty-cycle and reception model
const C = load('whisper.js').IEDemoC.model;
const P = Object.assign({}, C.DEFAULTS);
const expect = (P.txMa * P.onMs + (P.sleepUa / 1000) * (P.intervalMs - P.onMs)) / P.intervalMs + P.otherUa / 1000;
ok(near(C.avgCurrentMa(P), expect, 1e-12), 'average current follows the duty-cycle formula');
ok(near(C.lifeHours(P), P.capacityMah / expect, 1e-9), 'battery life is capacity over average current');
let prevLife = 0;
for (const T of C.INTERVALS_MS) { const l = C.lifeHours(Object.assign({}, P, { intervalMs: T })); ok(l > prevLife, `longer interval, longer life (T=${T} ms)`); prevLife = l; }
ok(C.INTERVALS_MS[0] === 20 && C.INTERVALS_MS[C.INTERVALS_MS.length - 1] === 10240, 'intervals stay within BLE’s 20 ms – 10.24 s');
let prevP = -1;
for (let k = 1; k <= 5; k++) { const pe = C.pEvent(Object.assign({}, P, { phones: k })); ok(pe > prevP && pe >= 0 && pe <= 1, `more listening phones, better odds (k=${k})`); prevP = pe; }
ok(C.pEvent(Object.assign({}, P, { dutyPct: 0 })) === 0 && C.meanWaitS(Object.assign({}, P, { dutyPct: 0 })) === Infinity, 'nobody listening means never heard');
for (const T of C.INTERVALS_MS) { const q = Object.assign({}, P, { intervalMs: T }); ok(C.pMinute(q) >= C.pEvent(q) - 1e-12, `a minute of events is at least as likely as one (T=${T})`); }

// Demo D: who can see what (lost.json)
const D = JSON.parse(fs.readFileSync(path.join(DIR, 'lost.json'), 'utf8'));
const actors = D.actors.map((a) => a.id);
const item = (id) => D.items.find((x) => x.id === id);
for (const it of D.items) ok(actors.every((a) => ['yes', 'no', 'meta'].includes(it.see[a])), `${it.id}: every party has a value`);
for (const it of D.items) ok(it.step >= 1 && it.step <= D.steps.length, `${it.id}: appears at a real step`);
ok(item('loc').see.relay === 'no', 'the relay never sees the location in a report');
ok(item('loc').see.tag === 'no', 'the tag never learns a location');
ok(item('loc').see.owner === 'yes' && item('loc').see.finder === 'yes', 'only the finder (its own) and the owner see the location');
ok(D.items.every((it) => it.see.listener === 'no' || it.id === 'ident'), 'a nearby listener hears only the changing identifier');
ok(item('ownerid').see.finder === 'no', 'the finder never learns who owns the tag');
ok(item('finderid').see.owner === 'no', 'the owner is not told who the finder was');
ok(D.steps.some((s) => /does not pair/.test(s.text)), 'the finder does not pair');
ok(!D.steps.some((s) => /live|real-time/.test(s.text)) || /not a live feed/.test(D.steps[3].text), 'never presented as live tracking');

// Demo E: four connections (connections.json)
const E = JSON.parse(fs.readFileSync(path.join(DIR, 'connections.json'), 'utf8'));
const tab = (id) => E.tabs.find((t) => t.id === id);
ok(E.tabs.map((t) => t.id).join() === 'setup,sighting,precision,nfc', 'four separate tabs in order');
for (const t of E.tabs) ok(E.fields.every(([k]) => typeof t[k] === 'string' && t[k].length > 10), `${t.id}: every field filled`);
ok(/^No\./.test(tab('sighting').pairs), 'a passing finder does not pair');
ok(/Not a global location/.test(tab('precision').not), 'precision finding is not a global location');
ok(/excluding iPhone SE/.test(tab('precision').not), 'precision finding excludes iPhone SE');
ok(/Not distant tracking/.test(tab('nfc').not) && /centimetres/.test(tab('nfc').range), 'NFC is touch-range, no distant tracking');
ok(/one Apple Account/.test(tab('setup').pairs), 'setup links the tag to one account');

console.log(fails ? `✗ ${fails} failed, ${passes} passed` : `✓ invisible-engine demos: ${passes} checks passed`);
process.exit(fails ? 1 : 0);
