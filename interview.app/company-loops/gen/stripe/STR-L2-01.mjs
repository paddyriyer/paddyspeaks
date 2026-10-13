/* STR-L2-01 — Best currency conversion within K conversions (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: a brute-force enumeration of every walk of at
   most K conversions, with BigInt arithmetic so integer flooring is exact. The
   evaluator's reference is a hop-limited dynamic programme written independently.
   level: 1 Medium (no fees) · 2 Hard (fees, competing quotes for one pair)
          · 3 Very Hard (+ a quote loop that gains value, and tight hop limits) */
export const kind = "python";
export const entry = "best_conversion";
export const signature = "def best_conversion(quotes: list[tuple[str, str, int, int]], source: str, target: str, amount: int, max_hops: int) -> int | None:";
export const starter = `def best_conversion(quotes, source, target, amount, max_hops):
    """quotes: (from_ccy, to_ccy, rate_micros, fee_bps).
    One conversion of x minor units yields
        x * rate_micros * (10000 - fee_bps) // 10_000_000_000
    Return the largest amount of target reachable with at most max_hops
    conversions, or None if target cannot be reached."""
    ...
`;

export const prelude = `
def _gen_quotes(n, m, seed):
    x, out = seed, []
    names = ['c%03d' % i for i in range(n)]
    for i in range(n - 1):                       # a spine so the target is reachable
        x = (1103515245 * x + 12345) % 2147483648
        out.append((names[i], names[i + 1], 950000 + (x >> 16) % 100001, (x >> 8) % 60))
    for _ in range(m - (n - 1)):
        x = (1103515245 * x + 12345) % 2147483648
        a = (x >> 16) % n
        x = (1103515245 * x + 12345) % 2147483648
        b = (x >> 16) % n
        x = (1103515245 * x + 12345) % 2147483648
        if a != b:
            out.append((names[a], names[b], 900000 + (x >> 16) % 200001, (x >> 4) % 120))
    return out
`.trim() + "\n";

const CCY = ["usd", "eur", "gbp", "jpy", "cad", "aud", "chf", "sek", "sgd", "inr", "mxn", "brl", "nok", "dkk", "pln", "hkd", "nzd", "czk"];
const DEN = 10_000_000_000n;

const convert = (x, rate, fee) => (x * BigInt(rate) * BigInt(10000 - fee)) / DEN; // BigInt division floors for non-negatives

// Brute force: every walk (currencies may repeat) of at most maxHops conversions.
export function oracle(quotes, source, target, amount, maxHops) {
  const out = new Map();
  for (const q of quotes) {
    if (!out.has(q[0])) out.set(q[0], []);
    out.get(q[0]).push(q);
  }
  let best = null;
  const walk = (node, amt, hops) => {
    if (node === target && (best === null || amt > best)) best = amt;
    if (hops === maxHops) return;
    for (const [, to, rate, fee] of out.get(node) || []) walk(to, convert(amt, rate, fee), hops + 1);
  };
  walk(source, BigInt(amount), 0);
  return best;
}

const pyOut = (v) => (v === null ? "None" : String(v));
const pyArgs = (quotes, s, t, amount, k) =>
  `([${quotes.map(([a, b, rate, fee]) => `('${a}', '${b}', ${rate}, ${fee})`).join(", ")}], '${s}', '${t}', ${amount}, ${k})`;

function smallCase(r, level) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const n = level === 1 ? 5 : level === 2 ? r.int(6, 7) : r.int(7, 8);
    const ccy = r.sample(CCY, n);
    const value = {};
    for (const c of ccy) value[c] = r.int(400_000, 2_500_000);
    const quotes = [];
    const m = level === 1 ? r.int(8, 10) : level === 2 ? r.int(11, 14) : r.int(13, 16);
    for (let i = 0; i < m; i++) {
      const a = r.pick(ccy);
      let b = r.pick(ccy);
      if (a === b) continue;
      const spread = r.int(0, 250);
      const rate = Math.floor((value[a] * 1_000_000 / value[b]) * (10000 - spread) / 10000);
      const fee = level === 1 ? 0 : r.pick([0, 10, 25, 40, 80, 150]);
      quotes.push([a, b, rate, fee]);
      if (level >= 2 && r.chance(0.25)) {   // a second provider quoting the same pair
        quotes.push([a, b, Math.floor(rate * (1 + r.int(-30, 30) / 10000)), r.pick([0, 15, 60, 200])]);
      }
    }
    if (level === 3) {                       // a quote loop that gains value
      const [a, b] = r.sample(ccy, 2);
      const up = Math.floor(value[a] * 1_000_000 / value[b] * 1.02);
      quotes.push([a, b, up, 0], [b, a, Math.floor(value[b] * 1_000_000 / value[a]), 0]);
    }
    const source = ccy[0];
    const target = ccy[n - 1];
    const amount = level === 1 ? r.int(1_000, 500_000) : r.int(50, 2_000_000);
    const k = level === 1 ? r.int(2, 3) : level === 2 ? r.int(2, 4) : r.int(3, 5);
    const shuffled = r.shuffle(quotes);
    const got = oracle(shuffled, source, target, amount, k);
    if (got !== null && got > 0n) return { quotes: shuffled, source, target, amount, k, got };
  }
  throw new Error("STR-L2-01: could not build a reachable sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = smallCase(r, level);
    samples.push({ args: pyArgs(c.quotes, c.source, c.target, c.amount, c.k), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [s, a, b, t] = r.sample(CCY, 4);
  const amt = r.pick([10_000, 25_000, 100_000]);
  const edges = [
    // listed in chain order so an in-place relaxation sneaks in a third hop
    ["the best route allowed uses exactly max_hops; a better longer route is not allowed",
      [[s, a, 1_000_000, 0], [a, b, 1_100_000, 0], [b, t, 1_100_000, 0], [a, t, 1_050_000, 0], [s, t, 1_000_000, 0]], s, t, amt, 2],
    ["the target is only reachable with one more hop than allowed", [[s, a, 1_000_000, 0], [a, b, 1_000_000, 0], [b, t, 1_000_000, 0]], s, t, amt, 2],
    ["max_hops = 0 and a different target: unreachable", [[s, t, 1_000_000, 0]], s, t, amt, 0],
    ["source equals target: no conversion needed", [[s, a, 990_000, 0], [a, s, 990_000, 0]], s, s, amt, 3],
    ["a conversion that floors to 0 still reaches the target (0, not None)", [[s, t, 500_000, 0]], s, t, 1, 1],
    ["floor after every conversion, not once at the end", [[s, a, 500_000, 0], [a, t, 3_000_000, 0]], s, t, 3, 2],
  ];
  if (level >= 2) {
    edges.push(["competing quotes: the better rate wins despite a higher fee", [[s, t, 900_000, 0], [s, t, 950_000, 300]], s, t, amt, 1]);
    edges.push(["fees apply on every hop", [[s, a, 1_000_000, 50], [a, t, 1_000_000, 50], [s, t, 990_000, 0]], s, t, 1_000_000, 2]);
  }
  if (level === 3) {
    const loop = [[s, a, 1_100_000, 0], [a, s, 1_000_000, 0], [s, t, 1_000_000, 0]];
    edges.push(["a value-gaining loop is used while hops remain", loop, s, t, amt, 3]);
    edges.push(["the same loop with max_hops = 2 cannot complete a lap", loop, s, t, amt, 2]);
  }
  for (const [name, q, src, tgt, am, k] of edges) tests.push({ name, args: pyArgs(q, src, tgt, am, k), expect: pyOut(oracle(q, src, tgt, am, k)) });

  // Timing: a few hundred currencies, tens of thousands of quotes. O(K·E) is instant;
  // enumerating routes is exponential. Compared with the reference at check time.
  const n = level === 1 ? 200 : level === 2 ? 300 : 400;
  const m = level === 1 ? 12000 : level === 2 ? 15000 : 24000;
  const k = level === 1 ? 5 : level === 2 ? 5 : 6;
  const seed = r.int(1, 1_000_000);
  tests.push({
    name: `${n} currencies, ${m.toLocaleString("en-US")} quotes, max_hops ${k} (O(K·E))`,
    args: `(_gen_quotes(${n}, ${m}, ${seed}), 'c000', 'c${String(n - 1).padStart(3, "0")}', 1000000000, ${k})`,
    limit_s: 8,
  });

  return {
    vars: {
      fee_rule: level === 1
        ? "In this replay every quote has `fee_bps = 0`, but keep the fee in the formula."
        : "Quotes carry a fee in basis points, and several providers may quote the same pair with different rates and fees.",
      hop_rule: level === 3
        ? "A route may revisit a currency (each visit is another conversion). Some quote loops gain value, so the hop limit is what keeps the answer finite."
        : "A route may revisit a currency; each conversion counts toward `max_hops`.",
    },
    samples,
    tests,
  };
}
