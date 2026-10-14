/* LNK-L1-05 — Salary insight medians as reports arrive (Python).
   Simulated practice scenario. All data is generated from the seed; titles, cities and
   salaries are hypothetical. The output is a group median, shown only once enough reports
   exist, never an individual's report.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: after every event, sort the affected group's salaries
   and take the middle (brute force). The evaluator's reference keeps two heaps per group,
   so each checks the other.
   level: 1 Medium (adds only; a median once a group has k reports)
          2 Hard (+ title and city compared trimmed and case-insensitively; reports outside
            the plausible band are rejected)
          3 Very Hard (+ members remove their reports; removing a rejected or already removed
            report changes nothing) */
export const kind = "python";
export const entry = "salary_medians";
export const signature = "def salary_medians(events: list[tuple], k: int, lo: int | None = None, hi: int | None = None) -> list[int | None]:";
export const starter = `def salary_medians(events, k, lo=None, hi=None):
    """events: ("add", title, city, salary) or ("remove", i).
    After each event, return the median salary of the affected (title, city) group,
    or None while the group has fewer than k reports."""
    ...
`;

export const prelude = `
def _gen_reports(n, groups, removes, seed):
    titles = ["Data Engineer", "Software Engineer", "Product Manager", "Data Scientist", "Designer"]
    cities = ["Austin", "Berlin", "Dublin", "Toronto", "Bengaluru", "Sydney"]
    x, out, adds = seed, [], []
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        if adds and (x >> 8) % 1000 < removes:
            x = (1103515245 * x + 12345) % 2147483648
            out.append(("remove", adds[(x >> 8) % len(adds)]))
            continue
        x = (1103515245 * x + 12345) % 2147483648
        g = (x >> 8) % groups
        g = 0 if (x >> 4) % 4 else g            # most reports land in one large group
        x = (1103515245 * x + 12345) % 2147483648
        adds.append(i)
        out.append(("add", titles[g % 5], cities[g % 6], 40000 + (x >> 8) % 160000))
    return out
`.trim() + "\n";

// Brute force: keep each group's live reports and sort after every event. Small inputs only.
export function oracle(events, k, lo, hi, normalise) {
  const norm = (s) => (normalise ? s.trim().toLowerCase() : s);
  const keyOf = (e) => norm(e[1]) + "\u0000" + norm(e[2]);
  const groups = new Map();       // key -> Map(addIndex -> salary)
  const out = [];
  events.forEach((e, idx) => {
    let key;
    if (e[0] === "add") {
      key = keyOf(e);
      const v = e[3];
      if ((lo === null || v >= lo) && (hi === null || v <= hi)) {
        if (!groups.has(key)) groups.set(key, new Map());
        groups.get(key).set(idx, v);
      }
    } else {
      key = keyOf(events[e[1]]);
      if (groups.has(key)) groups.get(key).delete(e[1]);
    }
    const xs = [...(groups.get(key) || new Map()).values()].sort((a, b) => a - b);
    const m = xs.length;
    if (m < k) out.push(null);
    else out.push(m % 2 ? xs[(m - 1) / 2] : Math.floor((xs[m / 2 - 1] + xs[m / 2] + 1) / 2));
  });
  return out;
}

const TITLES = ["Data Engineer", "Software Engineer", "Product Manager", "Data Scientist", "UX Designer", "Recruiter"];
const CITIES = ["Austin", "Berlin", "Dublin", "Toronto", "Bengaluru", "Sydney", "Sao Paulo", "Singapore"];
const pyStr = (s) => JSON.stringify(s);
const pyEv = (e) => (e[0] === "add" ? `("add", ${pyStr(e[1])}, ${pyStr(e[2])}, ${e[3]})` : `("remove", ${e[1]})`);
const pyArgs = (c) => `([${c.ev.map(pyEv).join(", ")}], ${c.k}, ${c.lo === null ? "None" : c.lo}, ${c.hi === null ? "None" : c.hi})`;
const pyOut = (xs) => "[" + xs.map((x) => (x === null ? "None" : String(x))).join(", ") + "]";

export function generate(r, level) {
  const normalise = level >= 2;
  const lo = level >= 2 ? r.pick([20000, 30000, 35000]) : null;
  const hi = level >= 2 ? r.pick([400000, 450000, 500000]) : null;
  const run = (c) => oracle(c.ev, c.k, c.lo, c.hi, normalise);
  const variant = (s) => (normalise ? r.pick([s, s, s.toLowerCase(), s.toUpperCase(), " " + s, s + " "]) : s);

  const randomCase = () => {
    for (let attempt = 0; attempt < 80; attempt++) {
      const titles = r.sample(TITLES, 2), cities = r.sample(CITIES, 2);
      const ev = [];
      const adds = [];
      const n = r.int(12, 18);
      for (let i = 0; i < n; i++) {
        if (level === 3 && adds.length && r.chance(0.2)) { ev.push(["remove", r.pick(adds)]); continue; }
        let v = r.int(60, 220) * 1000 + r.pick([0, 0, 0, 500, 1]);
        if (level >= 2 && r.chance(0.12)) v = r.pick([lo - r.int(1, 10000), hi + r.int(1, 50000)]);
        adds.push(ev.length);
        ev.push(["add", variant(r.pick(titles)), variant(r.chance(0.75) ? cities[0] : cities[1]), v]);
      }
      const c = { ev, k: r.int(2, 4), lo, hi };
      if (run(c).filter((x) => x !== null).length >= 3) return c;
    }
    throw new Error("LNK-L1-05: could not build a sample with medians");
  };
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase();
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [T, U] = r.sample(TITLES, 2);
  const [C, D] = r.sample(CITIES, 2);
  const base = r.int(80, 150) * 1000;
  const add = (t, c, v) => ["add", t, c, v];
  const edges = [
    ["nothing is shown before the k-th report", { ev: [add(T, C, base), add(T, C, base + 9000), add(T, C, base + 3000)], k: 3 }],
    ["k = 1 shows every report's group at once", { ev: [add(T, C, base), add(U, C, base + 1000), add(T, C, base + 2000)], k: 1 }],
    ["an even count rounds the mean of the middle two half up", { ev: [add(T, C, base), add(T, C, base + 1), add(T, C, base + 3), add(T, C, base + 2)], k: 2 }],
    ["equal salaries", { ev: [add(T, C, base), add(T, C, base), add(T, C, base), add(T, C, base + 5000)], k: 2 }],
    ["the same title in another city is another group", { ev: [add(T, C, base), add(T, D, base + 40000), add(T, C, base + 2000), add(T, D, base + 50000)], k: 2 }],
    ["reports arriving in descending order", { ev: [6, 5, 4, 3, 2, 1].map((i) => add(U, D, base + i * 1000)), k: 2 }],
  ];
  if (level >= 2) {
    edges.push(["title and city match trimmed and case-insensitively",
      { ev: [add(T, C, base), add(" " + T.toUpperCase(), C.toLowerCase() + " ", base + 4000), add(T.toLowerCase(), " " + C, base + 1000)], k: 2 }]);
    edges.push(["exactly the band's limits are accepted", { ev: [add(T, C, lo), add(T, C, hi), add(T, C, base)], k: 3 }]);
    edges.push(["outside the band is rejected and changes nothing",
      { ev: [add(T, C, base), add(T, C, base + 2000), add(T, C, lo - 1), add(T, C, hi + 1), add(T, C, base + 1000)], k: 3 }]);
    edges.push(["a rejected report in a new group shows nothing", { ev: [add(U, D, hi + 1)], k: 1 }]);
  }
  if (level === 3) {
    edges.push(["a removal can take a group back below k", { ev: [add(T, C, base), add(T, C, base + 2000), ["remove", 0], add(T, C, base + 1000)], k: 2 }]);
    edges.push(["removing the median moves it", { ev: [add(T, C, base), add(T, C, base + 1000), add(T, C, base + 2000), ["remove", 1], add(T, C, base + 5000)], k: 2 }]);
    edges.push(["removing a rejected report changes nothing", { ev: [add(T, C, base), add(T, C, hi + 1), add(T, C, base + 3000), ["remove", 1]], k: 2 }]);
    edges.push(["removing the same report twice", { ev: [add(T, C, base), add(T, C, base + 1000), add(T, C, base + 4000), ["remove", 2], ["remove", 2]], k: 2 }]);
    edges.push(["remove one of two equal salaries", { ev: [add(T, C, base), add(T, C, base), add(T, C, base + 8000), ["remove", 0], ["remove", 1]], k: 1 }]);
    edges.push(["empty a group, then fill it again", { ev: [add(U, D, base), ["remove", 0], add(U, D, base + 6000), add(U, D, base + 2000)], k: 1 }]);
  }
  for (const [name, c] of edges) {
    c.lo = lo; c.hi = hi;
    tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });
  }

  // Timing: compared with the reference at check time. Re-sorting a group of ~100 000
  // salaries for every report is quadratic; two heaps per group are O(log n) per event.
  const n = 120000, seed = r.int(1, 1_000_000);
  const k = r.int(5, 50);
  tests.push({
    name: `${n.toLocaleString("en-US")} events in time`,
    args: `(_gen_reports(${n}, 12, ${level === 3 ? 100 : 0}, ${seed}), ${k}, ${lo === null ? "None" : lo}, ${hi === null ? "None" : hi})`,
    limit_s: 8,
  });

  return {
    vars: {
      key_rule: normalise
        ? "Title and city are compared after trimming surrounding spaces and ignoring case."
        : "Title and city are compared exactly as written.",
      band_rule: level >= 2
        ? `A report with a salary below \`lo\` or above \`hi\` (here ${lo} and ${hi}; both limits are accepted) is rejected: it is never part of any group, and that event's answer is the group's current median, or None.`
        : "`lo` and `hi` are None: every report is accepted.",
      remove_rule: level === 3
        ? "`(\"remove\", i)` withdraws the report added by `events[i]` (always an earlier `add` event); the answer is that report's group's median after the removal. Removing a report that was rejected or has already been removed changes nothing."
        : "There are no `remove` events in this exercise.",
    },
    samples,
    tests,
  };
}
