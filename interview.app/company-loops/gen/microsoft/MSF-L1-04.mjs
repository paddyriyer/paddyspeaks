/* MSF-L1-04 — Lobby matchmaking: the most 1v1 pairs within a skill gap, longest waits first (Python).
   Simulated practice scenario. All data is generated from the seed; skills, waits, regions
   and gaps are hypothetical, and the matching rule is this exercise's, not any game's.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which enumerates EVERY matching of each region's
   players (small inputs only), keeps those with the most pairs and then the largest total
   wait of the matched players, and checks that exactly one set of matched players wins.
   (Waits are distinct, so it always does: the sets of players a matching can cover form a
   matroid, whose maximum-weight basis is unique when the weights are distinct.) The
   evaluator's reference sorts by skill and runs a linear DP with a sliding-window maximum,
   written independently.
   level: 1 Medium (one region; inclusive gap; maximise pairs, then the matched players' waits)
          2 Hard (+ max_gap 0, equal skills, chains where adjacent greedy picks the wrong pairs)
          3 Very Hard (+ several regions, each with its own gap; players never cross regions) */
export const kind = "python";
export const entry = "match_lobby";
export const signature = "def match_lobby(players: list[tuple[str, str, int, int]], max_gap: dict[str, int]) -> tuple[int, list[str]]:";
export const starter = `def match_lobby(players, max_gap):
    """players: (player_id, region, skill, wait_ms); max_gap: {region: largest allowed skill gap}.
    Return (number_of_pairs, sorted ids of the players left waiting)."""
    ...
`;

export const prelude = `
def _gen_players(n, seed, regions=('na',), spread=2000, gap=25):
    x, out = seed, []
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 8) % m
    for k in range(n):
        region = regions[rnd(len(regions))]
        out.append(('p%06d' % k, region, 1000 + rnd(spread), rnd(900) * n + k))   # distinct waits
    return out, {r: gap + 5 * i for i, r in enumerate(regions)}
`.trim() + "\n";

// Every matching of one region's players: the most pairs, then the largest total matched wait.
function bestSet(ps, gap) {
  const n = ps.length;
  const used = new Array(n).fill(false);      // decided: matched, or left in the lobby
  const matched = new Array(n).fill(false);
  let best = null;
  const keys = new Set();
  const visit = (i, pairs, wait) => {
    while (i < n && used[i]) i++;
    if (i === n) {
      if (!best || pairs > best.pairs || (pairs === best.pairs && wait > best.wait)) { best = { pairs, wait }; keys.clear(); }
      if (pairs === best.pairs && wait === best.wait) keys.add(matched.map((u) => (u ? 1 : 0)).join(""));
      return;
    }
    used[i] = true;
    visit(i + 1, pairs, wait);                  // i stays in the lobby
    for (let j = i + 1; j < n; j++) {           // or i plays j
      if (used[j] || Math.abs(ps[i][2] - ps[j][2]) > gap) continue;
      used[j] = matched[i] = matched[j] = true;
      visit(i + 1, pairs + 1, wait + ps[i][3] + ps[j][3]);
      used[j] = matched[i] = matched[j] = false;
    }
    used[i] = false;
  };
  visit(0, 0, 0);
  if (keys.size !== 1) throw new Error("MSF-L1-04: the best set of matched players is not unique");
  const key = [...keys][0];
  return { pairs: best.pairs, left: ps.filter((_, k) => key[k] === "0").map((p) => p[0]) };
}

export function oracle(players, maxGap) {
  const regions = new Map();
  for (const p of players) {
    if (!regions.has(p[1])) regions.set(p[1], []);
    regions.get(p[1]).push(p);
  }
  let pairs = 0;
  const left = [];
  for (const [reg, ps] of regions) {
    const b = bestSet(ps, maxGap[reg]);
    pairs += b.pairs;
    left.push(...b.left);
  }
  left.sort();
  return [pairs, left];
}

const pyOut = ([pairs, left]) => `(${pairs}, [${left.map((x) => `'${x}'`).join(", ")}])`;
const pyArgs = (players, gap) =>
  `([${players.map(([id, reg, s, w]) => `('${id}', '${reg}', ${s}, ${w})`).join(", ")}], {${Object.entries(gap).map(([k, v]) => `'${k}': ${v}`).join(", ")}})`;

const REGIONS = ["apac", "emea", "na", "sa"];
const TAGS = ["ash", "bolt", "crow", "dune", "echo", "fern", "gale", "haze", "iris", "jade", "kite", "lynx", "mint", "nova", "onyx", "pike", "quill", "rook", "sage", "tern"];

export function generate(r, level) {
  let pid = 0;
  const ids = r.shuffle(TAGS);
  const names = new Set();
  const name = () => { let s; do s = ids[pid++ % ids.length] + "_" + String(r.int(10, 99)); while (names.has(s)); names.add(s); return s; };
  const waits = new Set();
  const wait = () => { let w; do w = r.int(1000, 240000); while (waits.has(w)); waits.add(w); return w; };
  const home = r.pick(REGIONS);

  const randomCase = () => {
    pid = 0;
    const regs = level === 3 ? r.sample(REGIONS, 2).sort() : [home];
    const gap = {};
    for (const g of regs) gap[g] = level === 1 ? r.pick([20, 30, 50]) : r.pick([0, 15, 25, 40]);
    const ps = [];
    const n = level === 1 ? r.int(6, 8) : r.int(8, 11);
    for (let k = 0; k < n; k++) {
      const reg = r.pick(regs);
      const base = 1400 + r.int(0, 6) * (gap[reg] || 10);
      ps.push([name(), reg, level >= 2 && r.chance(0.2) && ps.length ? ps[ps.length - 1][2] : base + r.int(0, gap[reg] || 3), wait()]);
    }
    return { ps: r.shuffle(ps), gap };
  };
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase();
    samples.push({ args: pyArgs(c.ps, c.gap), expect: pyOut(oracle(c.ps, c.gap)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const R = home;
  const D = r.pick([20, 25, 40]);
  const S = 1500 + r.int(0, 300);
  const P = (skill, reg = R) => [name(), reg, skill, wait()];
  pid = 0;
  const edges = [];
  const add = (label, ps, gap) => edges.push([label, ps, gap]);
  add("a gap of exactly max_gap is allowed", [P(S), P(S + D)], { [R]: D });
  add("a gap of max_gap + 1 is not", [P(S), P(S + D + 1)], { [R]: D });
  add("no players: no pairs", [], { [R]: D });
  add("one player waits alone", [P(S)], { [R]: D });
  {
    // The longest waiter's closest opponent is the wrong one: pairing them strands both ends.
    const a = P(S), b = P(S + D), c = P(S + D + 1), d = P(S + 2 * D + 1);
    const top = Math.max(a[3], b[3], c[3], d[3]);
    c[3] = top + 1;
    waits.add(top + 1);
    add("pairing the longest waiter with their closest opponent loses a pair", r.shuffle([a, b, c, d]), { [R]: D });
  }
  {
    // Three in a chain: one pair either way; the shorter waiter of the two ends stays.
    const a = P(S), b = P(S + D), c = P(S + 2 * D);
    if (r.chance(0.5)) { const t = a[3]; a[3] = c[3]; c[3] = t; }
    add("one pair either way: the shorter-waiting end player stays", r.shuffle([a, b, c]), { [R]: D });
  }
  if (level >= 2) {
    {
      // A chain of five: the player left is the shortest waiter among the ends and the middle.
      const ps = [0, 1, 2, 3, 4].map((k) => P(S + k * D));
      const ws = ps.map((p) => p[3]).sort((x, y) => x - y);
      const low = r.pick([0, 2]);                     // the first or the middle player waits least
      const order = [1, 3, 4, 0, 2].map((k) => (k === low ? null : k)).filter((k) => k !== null);
      ps[low][3] = ws[0];
      order.forEach((k, i) => { ps[k][3] = ws[i + 1]; });
      add("a chain of five: pairing from the lowest skill leaves the wrong player", r.shuffle(ps), { [R]: D });
    }
    add("max_gap 0: only equal skills pair", r.shuffle([P(S), P(S), P(S + 1), P(S + 1), P(S + 1)]), { [R]: 0 });
    add("equal skills, one too many: the shortest waiter stays", r.shuffle([P(S), P(S), P(S)]), { [R]: D });
  }
  if (level === 3) {
    const [R1, R2] = r.sample(REGIONS, 2).sort();
    add("players in different regions never pair", [P(S, R1), P(S, R2)], { [R1]: D, [R2]: D });
    add("each region uses its own gap", r.shuffle([P(S, R1), P(S + D + 5, R1), P(S, R2), P(S + D + 5, R2)]), { [R1]: D, [R2]: D + 5 });
  }
  for (const [label, ps, gap] of edges) tests.push({ name: label, args: pyArgs(ps, gap), expect: pyOut(oracle(ps, gap)) });

  // Timing: 150 000 players, so about 2 000 opponents are inside each player's gap.
  const regs = level === 3 ? "('apac', 'emea', 'na')" : "('na',)";
  tests.push({
    name: "150,001 players in the lobby, thousands within each player's gap (sort + one pass, not pair search)",
    args: `_gen_players(150001, ${r.int(1, 1_000_000)}, ${regs}, 2000, 25)`,
    limit_s: 8,
  });

  return {
    vars: {
      region_rule: level === 3
        ? "Players are queued per region: two players can be paired only if they are in the same region, and each region has its own `max_gap[region]`."
        : "In this lobby snapshot every player is in one region, but `max_gap` is a dict keyed by region so the code must work for several.",
    },
    samples,
    tests,
  };
}
