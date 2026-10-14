/* MET-L2-01 — Ad slots in a feed with spacing, caps and advertiser alternation (Python, DP).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: an exhaustive search over every set of slots of a
   small feed. It knows nothing about prefix maxima or top-two tricks, so it checks the
   dynamic programme the evaluator's reference uses.
   level: 1 Medium (spacing only) · 2 Hard (+ a cap on the number of ads) ·
          3 Very Hard (+ consecutive ads must come from different advertisers) */
export const kind = "python";
export const entry = "best_ad_load";
export const signature = "def best_ad_load(values: list[int], gap: int, max_ads: int | None = None, advertisers: list[str] | None = None) -> int:";
export const starter = `def best_ad_load(values, gap, max_ads=None, advertisers=None):
    """values[i]: net value of showing the candidate ad in feed slot i (may be negative).
    Any two chosen slots need at least \`gap\` organic stories between them.
    Return the largest total value; choosing no ads gives 0."""
    ...
`;

export const prelude = `
def _gen_values(n, seed, lo=-300, hi=1000):
    x, out = seed, []
    for _ in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        out.append(lo + (x >> 12) % (hi - lo + 1))
    return out


def _gen_advertisers(n, n_adv, seed):
    x, out = seed, []
    for _ in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        out.append('adv%d' % ((x >> 16) % n_adv))
    return out
`.trim() + "\n";

// Exhaustive search over every valid selection (small feeds only).
export function oracle(values, gap, maxAds, advertisers) {
  const n = values.length;
  let best = 0;                                   // no ads at all
  const rec = (i, count, lastAdv, total) => {
    if (total > best && count > 0) best = total;
    if (maxAds != null && count >= maxAds) return;
    for (let s = i; s < n; s++) {
      if (advertisers && count > 0 && advertisers[s] === lastAdv) continue;
      rec(s + gap + 1, count + 1, advertisers ? advertisers[s] : null, total + values[s]);
    }
  };
  rec(0, 0, null, 0);
  return best;
}

const pyStrs = (xs) => "[" + xs.map((x) => `'${x}'`).join(", ") + "]";
const pyArgs = (c) =>
  `([${c.values.join(", ")}], ${c.gap}, ${c.maxAds == null ? "None" : c.maxAds}, ${c.adv ? pyStrs(c.adv) : "None"})`;
const run = (c) => oracle(c.values, c.gap, c.maxAds, c.adv);

const ADV = ["shoes", "games", "travel", "coffee", "books", "bikes", "music", "plants"];

function randomCase(r, level, advNames) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const n = level === 1 ? r.int(8, 13) : level === 2 ? r.int(10, 14) : r.int(11, 15);
    const lo = level === 1 ? -40 : -60;
    const values = Array.from({ length: n }, () => r.int(lo, 120));
    const gap = r.int(1, 3);
    const maxAds = level === 1 ? null : r.int(2, 3);
    const adv = level === 3 ? Array.from({ length: n }, () => r.pick(advNames)) : null;
    const c = { values, gap, maxAds, adv };
    if (run(c) > 0) return c;
  }
  throw new Error("MET-L2-01: could not build a positive sample");
}

export function generate(r, level) {
  const advNames = r.sample(ADV, 3);
  const [A, B, C] = advNames;
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level, advNames);
    samples.push({ args: pyArgs(c), expect: String(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const g = r.int(2, 4);
  const hi = r.int(80, 150);
  const spaced = (k) => { const v = Array(g + 2 + k).fill(-5); v[0] = hi; v[g + 1 + k] = hi; return v; };
  const edges = [
    ["no ads at all when every candidate loses value", { values: [-3, -1, -7, -2], gap: 1 }],
    ["an empty feed", { values: [], gap: 2 }],
    ["two ads exactly gap + 1 slots apart are allowed", { values: spaced(0), gap: g }],
    ["two ads only gap slots apart are not", { values: spaced(-1), gap: g }],
    ["taking the single best slot first is not optimal", { values: [50, 60, 50, 4, 60, 50], gap: 1 }],
    ["gap 0 allows adjacent ads", { values: [7, -2, 9, 3, 0, 4], gap: 0 }],
  ];
  if (level >= 2) {
    edges.push(["max_ads = 0 places nothing", { values: [40, 10, 30], gap: 0, maxAds: 0 }]);
    edges.push(["the cap binds: the best two are not the two largest singles", { values: [90, 100, 90, -10, 20, 95], gap: 1, maxAds: 2 }]);
    edges.push(["a cap larger than the spacing allows changes nothing", { values: [30, 31, 32, 33, 34, 35, 36], gap: 2, maxAds: 9 }]);
  }
  if (level === 3) {
    const w = r.int(20, 60);
    edges.push(["the same advertiser cannot be shown twice in a row", { values: [w, 5, w], gap: 0, maxAds: 3, adv: [A, A, A] }]);
    edges.push(["an advertiser may return after a different one", { values: [w, w - 3, w], gap: 0, maxAds: 3, adv: [A, B, A] }]);
    edges.push(["a slightly negative ad can be worth it as a separator", { values: [w, -1, w], gap: 0, maxAds: 3, adv: [A, B, A] }]);
    edges.push(["but not when the cap leaves no room for it", { values: [w, -1, w], gap: 0, maxAds: 2, adv: [A, B, A] }]);
    edges.push(["the best earlier ad has the same advertiser; the second best does not",
      { values: [w, w - 10, 3, w + 5], gap: 1, maxAds: 2, adv: [A, B, C, A] }]);
    edges.push(["alternation and spacing together", { values: [12, 30, 25, 30, 8, 30, 25], gap: 1, maxAds: 4, adv: [B, A, C, A, B, A, C] }]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: String(run(c)) });

  // Timing: compared with the reference at check time.
  const seed = r.int(1, 1_000_000);
  if (level === 1) {
    tests.push({ name: "300,000 slots in time (O(n))", args: `(_gen_values(300000, ${seed}), ${r.int(2, 6)})`, limit_s: 8 });
  } else {
    const n = 20000, k = level === 2 ? 80 : 60;
    const advArg = level === 3 ? `_gen_advertisers(${n}, 500, ${seed + 1})` : "None";
    tests.push({ name: `${n.toLocaleString("en-US")} slots, up to ${k} ads, in time (O(n · max_ads))`, args: `(_gen_values(${n}, ${seed}), ${r.int(2, 5)}, ${k}, ${advArg})`, limit_s: 8 });
  }

  return {
    vars: {
      cap_rule: level === 1
        ? "In this exercise `max_ads` is None: the spacing is the only limit on how many ads appear."
        : "At most `max_ads` ads may be placed in the session.",
      advertiser_rule: level === 3
        ? "`advertisers[i]` names the advertiser of the candidate ad for slot i. Two ads with no other ad between them must come from different advertisers; an advertiser may appear again after another advertiser's ad."
        : "`advertisers` is None: any advertiser may follow any other.",
    },
    samples,
    tests,
  };
}
