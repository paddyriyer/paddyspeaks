/* LNK-L2-02 — Former colleagues: overlapping stints at the same company (Python).
   Simulated practice scenario. All data is generated from the seed; every member id,
   company and date is hypothetical. Each count is shown only to the member it is about.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: merge each member's positions at a company into
   one stint, then compare every pair of stints at that company. The evaluator's
   reference shrinks each stint to [start, end - min_days + 1] and counts
   intersecting intervals with two sorted arrays, written independently.
   level: 1 Medium (one position per member and company, all ended) · 2 Hard
          (+ promotions: several continuous positions per stint, current positions
          that run until today) · 3 Very Hard (+ members who opted out, stints
          shorter than min_days, an empty result) */
export const kind = "python";
export const entry = "former_colleagues";
export const signature = "def former_colleagues(positions: list[tuple[str, str, int, int | None]], min_days: int, today: int, opted_out: list[str] | None = None) -> dict[str, dict[str, int]]:";
export const starter = `def former_colleagues(positions, min_days, today, opted_out=None):
    """positions: (member, company, start_day, end_day) with inclusive day numbers;
    end_day is None for a position the member still holds (it runs until today).
    A member's positions at one company form one continuous stint.
    opted_out: members who turned this feature off, or None.
    Return {member: {company: n}}: for every member and every company they held a
    position at, the number of OTHER members whose stint at that company overlapped
    theirs by at least min_days days."""
    ...
`;

export const prelude = `
def _gen_careers(n, seed, current=True):
    x = seed
    out = []
    companies = ['co%02d' % i for i in range(12)]
    member = 0
    while len(out) < n:
        member += 1
        x = (1103515245 * x + 12345) % 2147483648
        day = (x >> 12) % 6000
        x = (1103515245 * x + 12345) % 2147483648
        jobs = 1 + (x >> 16) % 3
        used = set()
        for j in range(jobs):
            x = (1103515245 * x + 12345) % 2147483648
            r = (x >> 16) % 100
            company = companies[0] if r < 45 else companies[1 + r % 11]
            while company in used:
                company = companies[(companies.index(company) + 1) % 12]
            used.add(company)
            x = (1103515245 * x + 12345) % 2147483648
            length = 120 + (x >> 16) % 2400
            x = (1103515245 * x + 12345) % 2147483648
            parts = 1 + (x >> 16) % 3 if current else 1
            start, end = day, day + length - 1
            step = length // parts
            for p in range(parts):
                ps = start + p * step
                pe = end if p == parts - 1 else ps + step - 1
                if current and j == jobs - 1 and p == parts - 1 and (x >> 8) % 4 == 0:
                    pe = None
                out.append(('m%06d' % member, company, ps, pe))
            day = end + 1 + (x >> 4) % 200
    return out[:n]
`.trim() + "\n";

const COMPANIES = ["Alder Analytics", "Bluefin Bank", "Cedar Health", "Driftwood Games", "Elm Logistics",
  "Fernway Retail", "Granite Insurance", "Harbor Media"];

// Merge positions into stints, then compare every pair of stints at a company.
export function oracle(positions, minDays, today, optedOut) {
  const skip = new Set(optedOut || []);
  const stints = new Map();                 // member -> Map(company -> [start, end])
  for (const [m, c, s, e0] of positions) {
    if (skip.has(m)) continue;
    const e = e0 === null ? today : e0;
    if (!stints.has(m)) stints.set(m, new Map());
    const mine = stints.get(m);
    if (!mine.has(c)) mine.set(c, [s, e]);
    else { const st = mine.get(c); st[0] = Math.min(st[0], s); st[1] = Math.max(st[1], e); }
  }
  const out = {};
  for (const [m, mine] of stints) {
    out[m] = {};
    for (const [c, [s, e]] of mine) {
      let n = 0;
      for (const [m2, theirs] of stints) {
        if (m2 === m || !theirs.has(c)) continue;
        const [s2, e2] = theirs.get(c);
        if (Math.min(e, e2) - Math.max(s, s2) + 1 >= minDays) n++;
      }
      out[m][c] = n;
    }
  }
  return out;
}

const q = (s) => `'${s}'`;
function pyDict(o) {
  return "{" + Object.entries(o).map(([m, cs]) => `${q(m)}: {` + Object.entries(cs).map(([c, n]) => `${q(c)}: ${n}`).join(", ") + "}").join(", ") + "}";
}
const pyPos = ([m, c, s, e]) => `(${q(m)}, ${q(c)}, ${s}, ${e === null ? "None" : e})`;
const pyArgs = (pos, d, today, opt) => `([${pos.map(pyPos).join(", ")}], ${d}, ${today}, ${opt == null ? "None" : "[" + opt.map(q).join(", ") + "]"})`;

let memberNo = 0;
const mid = (r) => `mbr-${r.int(1, 9)}${String(++memberNo).padStart(3, "0")}`;

function smallCase(r, level, minDays, today) {
  const nm = level === 1 ? r.int(5, 7) : r.int(7, 10);
  const cos = r.sample(COMPANIES, level === 1 ? 2 : 3);
  const members = Array.from({ length: nm }, () => mid(r));
  const pos = [];
  for (const m of members) {
    const mine = r.sample(cos, r.chance(0.35) ? 2 : 1);
    for (const c of mine) {
      let len = r.int(Math.max(1, minDays - 40), minDays * 4);
      if (level === 3 && r.chance(0.2)) len = r.int(1, minDays - 1);          // too short to qualify
      const start = r.int(0, today - len);
      const end = start + len - 1;
      if (level === 1) { pos.push([m, c, start, end]); continue; }
      const parts = len >= 6 && r.chance(0.4) ? r.int(2, 3) : 1;              // promotions
      const cuts = [start];
      for (let p = 1; p < parts; p++) cuts.push(start + Math.floor((len * p) / parts));
      cuts.forEach((ps, p) => {
        const pe = p === parts - 1 ? end : cuts[p + 1] - 1;
        pos.push([m, c, ps, p === parts - 1 && r.chance(0.25) ? null : pe]);
      });
    }
  }
  const opted = level === 3 ? r.sample(members, r.int(1, 2)) : null;
  if (opted && r.chance(0.4)) opted.push(mid(r));                               // someone with no positions
  return { pos: r.shuffle(pos), opted };
}

export function generate(r, level) {
  memberNo = 0;
  const D = r.pick([60, 90, 120]);
  const today = r.pick([1800, 2000, 2400]);
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = smallCase(r, level, D, today);
    samples.push({ args: pyArgs(c.pos, D, today, c.opted), expect: pyDict(oracle(c.pos, D, today, c.opted)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [X, Y] = r.sample(COMPANIES, 2);
  const [A, B, C] = [mid(r), mid(r), mid(r)];
  const s0 = r.int(100, 300);
  const h = D - 10;                         // each promotion alone overlaps less than D, together more
  const edges = [
    ["an overlap of exactly min_days counts", [[A, X, s0, s0 + 399], [B, X, s0 + 400 - D, s0 + 900]], null],
    ["an overlap of min_days - 1 does not", [[A, X, s0, s0 + 399], [B, X, s0 + 401 - D, s0 + 900]], null],
    ["start and end days are inclusive", [[A, X, s0, s0 + D - 1], [B, X, s0, s0 + D - 1]], null],
    ["the same dates at different companies are not an overlap", [[A, X, s0, s0 + 500], [B, Y, s0, s0 + 500]], null],
    ["a stint inside a longer one counts; one shorter than min_days never does",
      [[A, X, s0, s0 + 1000], [B, X, s0 + 300, s0 + 300 + D - 1], [C, X, s0 + 600, s0 + 600 + D - 2]], null],
    ["colleagues at two companies are counted at each",
      [[A, X, s0, s0 + 500], [B, X, s0 + 100, s0 + 600], [A, Y, s0 + 700, s0 + 1200], [B, Y, s0 + 650, s0 + 1300]], null],
    ["a member alone at a company gets 0 for it", [[A, X, s0, s0 + 500], [A, Y, s0 + 501, s0 + 900], [B, X, s0, s0 + 300]], null],
    ["no positions: an empty result", [], null],
  ];
  if (level >= 2) {
    edges.push(["two promotions together overlap enough; neither does alone",
      [[A, X, s0, s0 + h - 1], [A, X, s0 + h, s0 + 2 * h - 1], [B, X, s0, s0 + 2 * h - 1]], null]);
    edges.push(["a colleague with two positions is one colleague",
      [[A, X, s0, s0 + 3 * D], [C, X, s0, s0 + D + 4], [C, X, s0 + D + 5, s0 + 3 * D]], null]);
    edges.push(["a current position runs until today",
      [[A, X, today - D + 1, null], [B, X, s0, today], [C, X, today - D + 2, null]], null]);
  }
  if (level === 3) {
    edges.push(["an opted-out member is neither counted nor listed",
      [[A, X, s0, s0 + 500], [B, X, s0, s0 + 500], [C, X, s0, s0 + 500]], [B]]);
    edges.push(["opting out someone with no positions changes nothing",
      [[A, X, s0, s0 + 500], [B, X, s0, s0 + 500]], [mid(r)]]);
    edges.push(["everyone opted out: an empty result", [[A, X, s0, s0 + 500], [B, X, s0, s0 + 500]], [A, B]]);
  }
  for (const [name, pos, opt] of edges) tests.push({ name, args: pyArgs(pos, D, today, opt), expect: pyDict(oracle(pos, D, today, opt)) });

  // Timing: 60 000–80 000 positions, nearly half of them at one company, each stint
  // months to years long. Sorting the shrunken intervals is O(n log n); comparing
  // pairs, even with a sweep that stops at the first later start, is quadratic in
  // the stints that are open at the same time.
  const n = level === 1 ? 60000 : 80000;
  const seed = r.int(1, 1_000_000);
  tests.push({
    name: `${n.toLocaleString("en-US")} positions, one company with nearly half of them`,
    args: level === 1
      ? `(_gen_careers(${n}, ${seed}, False), ${D}, 13000, None)`
      : level === 2
        ? `(_gen_careers(${n}, ${seed}), ${D}, 13000, None)`
        : `(_gen_careers(${n}, ${seed}), ${D}, 13000, ['m000003', 'm000010', 'm000011'])`,
    limit_s: 8,
  });

  return {
    vars: {
      min_days: D,
      position_rule: level === 1
        ? "In this replay each member has at most one position per company, and every position has ended."
        : "A member may hold several positions at one company (promotions). They are continuous, so together they form one stint from the earliest start to the latest end, and the member counts once. A position with `end_day` `None` is still held and runs until `today`.",
      privacy_rule: level === 3
        ? "Members in `opted_out` turned this feature off: ignore their positions completely, so they are neither counted for anyone nor listed in the result."
        : "In this replay `opted_out` is `None`; your function must still accept the argument.",
    },
    samples,
    tests,
  };
}
