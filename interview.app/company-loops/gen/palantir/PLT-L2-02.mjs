/* PLT-L2-02 — Downtime rolled up an asset hierarchy (Python, trees).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which walks the queried asset's subtree for
   every query (fine for small inputs). The evaluator's reference makes one
   bottom-up pass over the whole hierarchy, so each checks the other.
   level: 1 Medium (every event is unplanned downtime on a known asset) · 2 Hard
          (+ planned work and retired assets are excluded) · 3 Very Hard (+ the
          worst direct child of each queried asset, for drill-down) */
export const kind = "python";
export const entry = "rollup_downtime";
export const signature = "def rollup_downtime(assets: list[tuple[str, str | None]], events: list[tuple[str, int, str]], queries: list[str], drill: bool = False) -> list:";
export const starter = `def rollup_downtime(assets, events, queries, drill=False):
    """assets: (asset_id, parent_id) pairs, parent None for a site, in any order.
    events: (asset_id, minutes, kind) downtime records.
    Return, for each queried asset, the unplanned downtime minutes recorded on
    the asset and everything below it, or -1 for an unknown asset."""
    ...
`;

export const prelude = `
def _gen_plant(seed, sites, lines, machines, parts, n_events, n_queries, planned=False, drill=False):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8

    assets, tiers = [], ([], [], [], [])
    for s in range(sites):
        sid = 'S%d' % (s + 1)
        assets.append((sid, None))
        tiers[0].append(sid)
        for l in range(lines):
            lid = '%s-L%02d' % (sid, l + 1)
            assets.append((lid, sid))
            tiers[1].append(lid)
            for m in range(machines):
                mid = '%s-M%02d' % (lid, m + 1)
                assets.append((mid, lid))
                tiers[2].append(mid)
                for c in range(parts):
                    cid = '%s-C%02d' % (mid, c + 1)
                    assets.append((cid, mid))
                    tiers[3].append(cid)
                    if nxt() % 8 == 0:
                        assets.append((cid + '-A', cid))
                        assets.append((cid + '-A1', cid + '-A'))
                        tiers[3].append(cid + '-A1')
    for i in range(len(assets) - 1, 0, -1):
        j = nxt() % (i + 1)
        assets[i], assets[j] = assets[j], assets[i]
    events = []
    for _ in range(n_events):
        r = nxt()
        tier = tiers[3] if r % 10 < 7 else tiers[2] if r % 10 < 9 else tiers[1]
        a = tier[nxt() % len(tier)]
        if planned and r % 23 == 0:
            a = 'X-RETIRED-%d' % (r % 500)
        kind = 'planned' if planned and r % 5 == 0 else 'unplanned'
        events.append((a, 1 + nxt() % 240, kind))
    queries = []
    for _ in range(n_queries):
        r = nxt() % 20
        tier = tiers[0] if r < 3 else tiers[1] if r < 10 else tiers[2] if r < 16 else tiers[3]
        queries.append(tier[nxt() % len(tier)] if r != 19 else 'S9-L99')
    return assets, events, queries, drill
`.trim() + "\n";

// Walk each queried subtree from scratch. Small inputs only.
export function oracle(assets, events, queries, drill) {
  const kids = new Map(), known = new Set();
  for (const [a, p] of assets) {
    known.add(a);
    if (p !== null) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(a); }
  }
  const own = new Map();
  for (const [a, m, k] of events) if (k === "unplanned" && known.has(a)) own.set(a, (own.get(a) || 0) + m);
  const sub = (x) => {
    let s = 0;
    const st = [x];
    while (st.length) { const y = st.pop(); s += own.get(y) || 0; st.push(...(kids.get(y) || [])); }
    return s;
  };
  return queries.map((q) => {
    if (!known.has(q)) return drill ? [-1, null] : -1;
    const t = sub(q);
    if (!drill) return t;
    let best = null;
    for (const c of kids.get(q) || []) {
      const v = sub(c);
      if (v > 0 && (best === null || v > best[0] || (v === best[0] && c < best[1]))) best = [v, c];
    }
    return [t, best ? best[1] : null];
  });
}

const pyStr = (s) => (s === null ? "None" : `'${s}'`);
const pyArgs = (c) =>
  `([${c.assets.map(([a, p]) => `(${pyStr(a)}, ${pyStr(p)})`).join(", ")}], ` +
  `[${c.events.map(([a, m, k]) => `(${pyStr(a)}, ${m}, ${pyStr(k)})`).join(", ")}], ` +
  `[${c.queries.map(pyStr).join(", ")}], ${c.drill ? "True" : "False"})`;
const pyOut = (xs) => "[" + xs.map((x) => (Array.isArray(x) ? `(${x[0]}, ${pyStr(x[1])})` : String(x))).join(", ") + "]";
const run = (c) => oracle(c.assets, c.events, c.queries, c.drill);

// A small plant: sites -> lines -> machines -> components, some with a sub-assembly.
function plant(r, sites, prefix) {
  const assets = [], tiers = [[], [], [], []];
  for (let s = 1; s <= sites; s++) {
    const sid = `${prefix}${s}`;
    assets.push([sid, null]); tiers[0].push(sid);
    for (let l = 1; l <= r.int(1, 2); l++) {
      const lid = `${sid}-L${l}`;
      assets.push([lid, sid]); tiers[1].push(lid);
      for (let m = 1; m <= r.int(1, 3); m++) {
        const mid = `${lid}-M${m}`;
        assets.push([mid, lid]); tiers[2].push(mid);
        for (let c = 1; c <= r.int(0, 3); c++) {
          const cid = `${mid}-C${c}`;
          assets.push([cid, mid]); tiers[3].push(cid);
          if (r.chance(0.2)) { assets.push([`${cid}-A`, cid]); tiers[3].push(`${cid}-A`); }
        }
      }
    }
  }
  return { assets: r.shuffle(assets), tiers };
}

function randomCase(r, level, prefix) {
  const { assets, tiers } = plant(r, r.int(1, 2), prefix);
  const events = [];
  for (let i = 0; i < r.int(8, 14); i++) {
    const roll = r.next();
    const tier = roll < 0.55 ? tiers[3].length ? tiers[3] : tiers[2] : roll < 0.85 ? tiers[2] : roll < 0.95 ? tiers[1] : tiers[0];
    let a = r.pick(tier);
    if (level >= 2 && r.chance(0.1)) a = `${prefix}9-L9-M9`;                    // a retired asset
    const kind = level >= 2 && r.chance(0.2) ? "planned" : "unplanned";
    events.push([a, r.int(1, 12) * 5, kind]);
  }
  const queries = [...r.sample(tiers[0], 1), ...r.sample(tiers[1], Math.min(2, tiers[1].length)), ...r.sample(tiers[2], 2), r.pick(assets)[0]];
  if (r.chance(0.5)) queries.push(`${prefix}7`);
  return { assets, events, queries: r.shuffle(queries), drill: level === 3 };
}

export function generate(r, level) {
  const prefix = r.pick(["S", "P", "W", "F"]);
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level, prefix);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const drill = level === 3;
  const S = `${prefix}1`, T = `${prefix}2`;
  const L = `${S}-L1`, L2 = `${S}-L2`, M = `${L}-M1`, M2 = `${L}-M2`, C = `${M}-C1`, C2 = `${M}-C2`;
  const base = [[S, null], [L, S], [L2, S], [M, L], [M2, L], [C, M], [C2, M]];
  const u = (a, m) => [a, m, "unplanned"];
  const k = r.int(2, 9) * 5;
  const edges = [
    ["a component counts only its own downtime", { assets: base, events: [u(C, k), u(C2, 2 * k), u(M, 15)], queries: [C, C2] }],
    ["a site adds up everything below it, and its own records",
      { assets: base, events: [u(C, k), u(M2, 20), u(L2, 35), u(S, 60)], queries: [S, L, L2, M] }],
    ["children listed before their parents", { assets: [...base].reverse(), events: [u(C2, k), u(M, 10)], queries: [S, M, C2] }],
    ["an asset with no downtime anywhere below it", { assets: base, events: [u(C, k)], queries: [M2, L2, C2] }],
    ["an unknown asset returns the sentinel", { assets: base, events: [u(C, k)], queries: [`${prefix}9`, C, `${C}-Z`] }],
    ["two sites never share downtime",
      { assets: [...base, [T, null], [`${T}-L1`, T]], events: [u(C, k), u(`${T}-L1`, 40)], queries: [S, T, `${T}-L1`] }],
    ["repeated records on one asset are all counted", { assets: base, events: [u(C, k), u(C, k), u(C, 5)], queries: [C, M, S] }],
    ["the same asset queried twice", { assets: base, events: [u(C2, k)], queries: [L, L, C2] }],
  ];
  if (level >= 2) {
    edges.push(["planned work is not downtime", { assets: base, events: [u(C, k), [C, 90, "planned"], [M2, 30, "planned"]], queries: [C, M2, S] }]);
    edges.push(["records for a retired asset are ignored", { assets: base, events: [u(C, k), u(`${M}-C9`, 45), [`${prefix}8`, 20, "unplanned"]], queries: [M, S] }]);
    edges.push(["an asset whose only records are planned", { assets: base, events: [[C2, 120, "planned"], u(C, k)], queries: [C2, M] }]);
  }
  if (level === 3) {
    const tie = [[S, null], [L, S], [`${L}-M9`, L], [`${L}-M10`, L], [`${L}-M3`, L]];
    edges.push(["equal worst children: the id that sorts first as a string wins",
      { assets: tie, events: [u(`${L}-M9`, k), u(`${L}-M10`, k), u(`${L}-M3`, k - 5)], queries: [L, S] }]);
    edges.push(["no drill-down when no child has downtime", { assets: base, events: [u(M, k), u(L2, 15)], queries: [M, L2, C] }]);
    edges.push(["the worst child is judged by everything below it, not its own records",
      { assets: base, events: [u(M2, 50), u(C, 30), u(C2, 30), u(M, 5)], queries: [L, M] }]);
    edges.push(["a child with only planned work is not the worst child",
      { assets: base, events: [[L2, 500, "planned"], u(C, k)], queries: [S] }]);
  }
  for (const [name, c] of edges) {
    c.drill = drill;
    tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });
  }

  // Timing: compared with the reference at check time. Most queries name a site, a
  // line or a machine, so walking each queried subtree visits most of the plant.
  const seed = r.int(1, 1_000_000);
  const lines = r.pick([14, 16, 18]);
  tests.push({
    name: `a plant of about ${(6 * lines * 25 * 24 * 1.25 / 1000).toFixed(0)},000 assets, 150,000 records and 100,000 queries in time`,
    args: `_gen_plant(${seed}, 6, ${lines}, 25, 24, 150000, 100000, ${level >= 2 ? "True" : "False"}, ${drill ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      event_rule: level === 1
        ? "In this exercise every record is unplanned downtime on an asset in the hierarchy."
        : "`kind` is `'unplanned'` or `'planned'`. Planned work (scheduled maintenance) is not downtime and is ignored. A record that names an asset not in `assets` (a retired asset) is ignored too.",
      drill_rule: level === 3
        ? "With `drill=True`, return a tuple `(minutes, worst_child)` per query instead: `worst_child` is the direct child with the most unplanned downtime in its own subtree, ties going to the child id that sorts first as a string, or None if no direct child has any downtime. An unknown asset gives `(-1, None)`."
        : "Here `drill` is False: return one integer per query.",
    },
    samples,
    tests,
  };
}
