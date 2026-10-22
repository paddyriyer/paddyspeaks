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

console.log(fails ? `✗ ${fails} failed, ${passes} passed` : `✓ invisible-engine demos: ${passes} checks passed`);
process.exit(fails ? 1 : 0);
