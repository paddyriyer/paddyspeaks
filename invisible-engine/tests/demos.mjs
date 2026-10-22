// The Invisible Engine — demo model tests (no browser, no dependencies).
//   node invisible-engine/tests/demos.mjs
import crypto from 'node:crypto';
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


// Demo F: key protection — toy but real arithmetic
const F = load('keys.js').IEDemoF.model;
const nodeSha = (x) => crypto.createHash('sha256').update(x, 'utf8').digest('hex');
for (const x of ['', 'abc', 'Platform 4, Central Station, 14:05', 'é—ü', 'x'.repeat(130)]) ok(F.sha256(x) === nodeSha(x), `SHA-256 matches Node for ${JSON.stringify(x.slice(0, 12))}`);
const own = F.ownerKeys(123456789n, 'seed-a');
for (let i = 0; i < 5; i++) {
  const Pi = F.tagPublic(own.P, own.seed, i), di = F.ownerPrivate(own.d, own.seed, i);
  ok(F.modpow(F.g, di, F.p) === Pi, `window ${i}: the tag's public key matches the owner's private key without the tag holding d`);
  const rep = F.seal(Pi, 'loc ' + i, 987654321n + BigInt(i));
  ok(F.open(di, rep) === 'loc ' + i, `window ${i}: the owner opens the sealed report`);
  ok(F.open(F.ownerPrivate(own.d, own.seed, i + 1), rep) === null, `window ${i}: the next window's key cannot open it`);
  ok(F.open(di, Object.assign({}, rep, { ct: (rep.ct[0] === 'f' ? '0' : 'f') + rep.ct.slice(1) })) === null, `window ${i}: a tampered report is rejected`);
  ok(!JSON.stringify({ E: String(rep.E), ct: rep.ct, lookup: rep.lookup }).includes('loc'), `window ${i}: what the relay stores does not contain the location`);
}
ok(F.tagPublic(own.P, own.seed, 1) !== F.tagPublic(own.P, own.seed, 2), 'the broadcast key changes between windows');
const mk = 55555n, sg = F.sign(mk, 'firmware v2', 777n);
ok(F.verify(F.modpow(F.g, mk, F.p), 'firmware v2', sg) && !F.verify(F.modpow(F.g, mk, F.p), 'firmware v3', sg), 'a signature verifies with the public key and fails on a changed message');
const shared = F.shareWindows(own.seed, 2, 4);
ok(Object.keys(shared).join() === '2,3,4' && shared[3] === F.windowSecret(own.seed, 3), 'sharing hands over only the chosen windows');

// Demo K: consent vs confidentiality (consent.json)
const Kd = JSON.parse(fs.readFileSync(path.join(DIR, 'consent.json'), 'utf8'));
const rd = (id) => Kd.readers.find((r) => r.id === id);
ok(Kd.levels.every((l) => rd('holder').see[l.id] === 'yes'), 'the account holder sees the location at every protection level');
ok(['e2e', 'e2epq'].every((l) => rd('relay').see[l] === 'no' && rd('wire').see[l] === 'no'), 'end-to-end: neither the relay nor the network can read it');
ok(rd('relay').see.tls === 'yes' && rd('wire').see.tls === 'no', 'in-transit only: the network cannot, the service can');
ok(Kd.scenarios.map((x) => x.id).join() === 'lost,covert', 'two scenarios: a lost bag and a hidden tag');
ok(/cannot tell a lost bag from a person/.test(Kd.scenarios[1].consent), 'the hidden-tag scenario says encryption cannot judge consent');
ok(/disabling it can alert the person who placed it/.test(Kd.safety), 'the safety note says disabling can alert whoever placed it');
ok(/None of these depend on the encryption/.test(Kd.helps_note), 'protections for the carrier do not depend on encryption');
const allK = JSON.stringify(Kd).toLowerCase();
ok(!/(how to (find|disable|silence|defeat)|remove the battery|bypass)/.test(allK), 'no operational evasion or disablement instructions');


// Demo K's script reads the page's cell classes; the page must carry them.
const m07 = fs.readFileSync(path.join(DIR, '..', 'm07.html'), 'utf8');
const holderRow = (m07.match(/<tr data-reader="holder">(.*?)<\/tr>/) || [])[1] || '';
ok((holderRow.match(/class="v-yes"/g) || []).length === Kd.levels.length, 'demo K page: the account holder row is marked readable at every level');
ok(/classList\.contains\('v-yes'\)/.test(fs.readFileSync(path.join(DIR, 'consent.js'), 'utf8')), 'demo K script reads the same v-yes class the page carries');


// Phase 4: the quantum simulator and demos G, H, I
const Q = load('qsim.js').IEQ;
const near6 = (a, b) => Math.abs(a - b) < 1e-9;
let st = Q.zero(1); for (const g of ['H', 'Z', 'H']) st = Q.apply1(st, 1, 0, Q.GATES[g]);
ok(near6(Q.probs(st)[1], 1), 'H → Z → H takes |0⟩ to |1⟩');
st = Q.apply1(Q.zero(1), 1, 0, Q.GATES.H); const plus = Q.probs(st);
st = Q.apply1(st, 1, 0, Q.GATES.Z);
ok(near6(Q.probs(st)[0], plus[0]) && near6(st[1][0], -Math.sqrt(plus[1])), 'Z changes the relative phase, not the probabilities');
for (let d = 0; d <= 360; d += 15) {
  let t = Q.apply1(Q.zero(1), 1, 0, Q.GATES.H); t = Q.apply1(t, 1, 0, Q.P(d * Math.PI / 180)); t = Q.apply1(t, 1, 0, Q.GATES.H);
  ok(near6(Q.probs(t)[0], Math.cos(d * Math.PI / 360) ** 2) && near6(Q.norm(t), 1), `H·phase(${d}°)·H gives P(0) = cos²(φ/2), normalised`);
}
let gl = Q.apply1(Q.zero(1), 1, 0, Q.GATES.H); const gl2 = gl.map((a) => Q.mul(a, Q.expi(1.234)));
ok(Q.probs(gl).every((p, i) => near6(p, Q.probs(gl2)[i])), 'a global phase changes no probability');
let bell = Q.cnot(Q.apply1(Q.zero(2), 2, 0, Q.GATES.H), 2, 0, 1);
ok(near6(Q.probs(bell)[0], 0.5) && near6(Q.probs(bell)[3], 0.5) && near6(Q.probs(bell)[1] + Q.probs(bell)[2], 0), 'H then CNOT gives (|00⟩+|11⟩)/√2');
// no-signalling: Bob's own outcome odds are 50/50 whatever Alice does to her qubit first
for (const g of ['X', 'Z', 'H']) { const b2 = Q.apply1(bell, 2, 0, Q.GATES[g]); const pb1 = Q.probs(b2)[1] + Q.probs(b2)[3]; ok(near6(pb1, 0.5), `no-signalling: Alice applying ${g} leaves Bob at 50/50`); }
let gr = Q.oracle(Q.uniform(2), 2);
ok(near6(Q.mean(gr)[0], 0.25) && near6(gr[2][0], -0.5), 'Grover N=4: the oracle gives −1/2 and a mean of 1/4');
gr = Q.diffuse(gr);
ok(near6(gr[2][0], 1) && [0, 1, 3].every((k) => near6(gr[k][0], 0)), 'Grover N=4: diffusion gives +1 for the marked item and 0 elsewhere');
const I = load('grover.js').IEDemoI.model;
for (const N of [4, 8, 16, 64, 256]) {
  let s8 = Q.uniform(Math.log2(N)); const mk = N - 1;
  for (let k = 1; k <= 3; k++) { s8 = Q.diffuse(Q.oracle(s8, mk)); if (Math.log2(N) <= 3) ok(near6(Q.probs(s8)[mk], I.successAfter(N, k)), `Grover N=${N}, round ${k}: simulation matches sin²((2k+1)θ)`); }
  ok(Math.abs(I.bestRounds(N) - Math.PI / 4 * Math.sqrt(N)) < 1, `Grover N=${N}: best round count ≈ (π/4)√N`);
}
ok(I.successAfter(8, 3) < I.successAfter(8, 2), 'Grover overshoots: an extra round lowers the odds');
const G = load('phase.js').IEDemoG.model;
for (let d = 0; d <= 360; d += 30) {
  const ph = d * Math.PI / 180, q = G.quantum(ph);
  ok(near6(q.p0, Math.cos(ph / 2) ** 2) && near6(q.p0 + q.p1, 1), `demo G: P(0) = cos²(φ/2) at ${d}°`);
  let peak = 0; for (let t = 0; t < 2 * Math.PI; t += 0.001) peak = Math.max(peak, Math.abs(G.waveSum(t, ph)));
  ok(Math.abs(peak - G.wavePeak(ph)) < 1e-3, `demo G: the plotted sum peaks at 2|cos(φ/2)| at ${d}°`);
}
const H = load('circuit.js').IEDemoH;
const Hp = H.run(Q, H.PRESETS.hzh, 3, 0);
ok(near6(Q.probs(Hp)[1], 1), 'demo H preset H → Z → H ends in |1⟩');
const Hb = H.run(Q, H.PRESETS.bell, 2, 0);
ok(near6(Q.probs(Hb)[0], 0.5) && near6(Q.probs(Hb)[3], 0.5), 'demo H preset Bell pair');


// Phase 5: demo J (explorer.json) and demo L (enterprise.json)
const J = JSON.parse(fs.readFileSync(path.join(DIR, 'explorer.json'), 'utf8'));
const jit = (id) => J.items.find((x) => x.id === id);
const need = ['rsa', 'ecc', 'aes', 'sha', 'mlkem', 'mldsa', 'slhdsa', 'card', 'ble', 'fw', 'cloud'];
ok(need.every((id) => jit(id)), 'demo J covers RSA, ECC, AES, SHA, ML-KEM, ML-DSA, SLH-DSA, cards, BLE, firmware and cloud');
for (const it of J.items) {
  ok(J.fields.every(([k]) => typeof it[k] === 'string' && it[k].length > 15) && J.statuses[it.status], `demo J ${it.id}: every field filled, known status`);
  ok(/^\/invisible-engine\/m\d\d\.html#s\d\d$/.test(it.scene), `demo J ${it.id}: links to its scene`);
}
ok(['rsa', 'ecc'].every((id) => jit(id).status === 'shor') && /None is publicly known to exist/.test(J.statuses.shor), 'RSA and ECC fail only on a machine not known to exist');
ok(['aes', 'sha'].every((id) => jit(id).status === 'grover' && /Not broken/.test(jit(id).caveats)), 'AES and SHA-2 are weakened in an idealised count, not broken');
ok(['mlkem', 'mldsa', 'slhdsa'].every((id) => jit(id).status === 'pq') && /ordinary chips/.test(J.statuses.pq), 'the NIST algorithms are designed to resist and run on ordinary chips');
ok(/1,184/.test(jit('mlkem').caveats) && /1,088/.test(jit('mlkem').caveats) && /3,309/.test(jit('mldsa').caveats) && /7,856/.test(jit('slhdsa').caveats), 'sizes quoted from FIPS 203/204/205');
const jall = JSON.stringify(J).toLowerCase();
ok(!/quantum-proof|unbreakable|already broken|is broken today|tries all/.test(jall), 'demo J makes no false threat or safety claim');

const L = JSON.parse(fs.readFileSync(path.join(DIR, 'enterprise.json'), 'utf8'));
ok(L.scenarios.map((x) => x.id).join() === 'visitor,employee,travel,asset', 'demo L: visitor, employee, travel and asset scenarios');
for (const x of L.scenarios) {
  ok(x.controls.every((c) => c.who && c.who.length >= 2 && L.categories.some(([k]) => k === c.cat)), `demo L ${x.id}: every recommendation names who can implement it`);
  ok(x.limit.length > 20, `demo L ${x.id}: states where the company's authority stops`);
}
const lall = JSON.stringify(L).toLowerCase();
ok(!/(monitor|track|surveil)\w* (the )?(employees|staff|people)/.test(lall), 'demo L never recommends watching employees');
ok(/tags locate assets, never people/.test(lall) && /disabling a tracker can alert/.test(lall), 'demo L: assets not people; safety note');

console.log(fails ? `✗ ${fails} failed, ${passes} passed` : `✓ invisible-engine demos: ${passes} checks passed`);
process.exit(fails ? 1 : 0);
