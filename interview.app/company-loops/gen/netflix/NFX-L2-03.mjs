/* NFX-L2-03 — Debug the daily Top-10 ranker (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template
   (exact view comparison by cross-multiplication).
   Planted bugs (see the evaluator notes): the latest delivery is chosen per day
   instead of per day and country; the preview filter compares with "previews";
   runtime hours use integer division; the list is ordered by hours instead of
   views; ranks are positions, so tied titles do not share a rank.
   level: 1 Medium (one country, one delivery, no previews)
          · 2 Hard (+ several countries, previews, restated deliveries)
          · 3 Very Hard (+ the global list, ties, several days, titles without a runtime, smaller k) */
export const kind = "debug";
export const entry = "top10";
export const signature = "def top10(rows: list[dict], titles: dict[str, dict], day: str, country: str | None = None, k: int = 10) -> list[tuple[int, str, float, float]]:";
export const starter = `def top10(rows, titles, day, country=None, k=10):
    # the latest delivery of the day's viewing
    latest = {}
    for r in rows:
        if r["day"] == day:
            latest[r["day"]] = max(latest.get(r["day"], 0), r["batch"])

    seconds = {}
    for r in rows:
        if r["day"] != day or r["kind"] == "previews":
            continue
        if country is not None and r["country"] != country:
            continue
        if r["batch"] != latest[r["day"]]:
            continue
        seconds[r["title"]] = seconds.get(r["title"], 0) + r["seconds"]

    ranked = []
    for title, secs in seconds.items():
        info = titles.get(title)
        if info is None or info.get("runtime_min") is None:
            continue
        hours = secs / 3600
        runtime_h = info["runtime_min"] // 60
        ranked.append((title, hours, hours / runtime_h))

    ranked.sort(key=lambda x: (-x[1], x[0]))
    out = []
    for i, (title, hours, views) in enumerate(ranked[:k]):
        out.append((i + 1, title, hours, views))
    return out
`;

export const prelude = `
def _gen_viewing(n, n_titles, seed):
    x, rows = seed, []
    countries = ['US', 'BR', 'IN', 'DE', 'JP', 'MX', 'FR', 'KR']
    days = ['2026-10-0%d' % d for d in range(1, 8)]
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        t = (x >> 8) % n_titles
        x = (1103515245 * x + 12345) % 2147483648
        ci, di = (x >> 8) % 8, (x >> 12) % 7
        batch = 1 + (x >> 20) % 2 if (ci + di) % 3 == 0 else 1
        rows.append({'day': days[di], 'country': countries[ci], 'title': 'tt%05d' % t,
                     'kind': 'preview' if (x >> 4) % 10 == 0 else 'play',
                     'seconds': 60 + (x >> 6) % 9000, 'batch': batch})
    return rows


def _gen_catalogue(n_titles):
    return {'tt%05d' % i: {'name': 'Title %d' % i,
                           'runtime_min': None if i % 211 == 0 else 70 + (i * 37) % 600}
            for i in range(n_titles)}
`.trim() + "\n";

// The specification, implemented independently of the Python reference.
export function oracle(rows, titles, day, country, k) {
  const latest = new Map();                              // country -> highest batch that day
  for (const r of rows) if (r.day === day) latest.set(r.country, Math.max(latest.get(r.country) ?? 0, r.batch));
  const secs = new Map();
  for (const r of rows) {
    if (r.day !== day || r.kind !== "play") continue;
    if (country !== null && r.country !== country) continue;
    if (r.batch !== latest.get(r.country)) continue;
    secs.set(r.title, (secs.get(r.title) || 0) + r.seconds);
  }
  const list = [];
  for (const [t, s] of secs) {
    const info = titles[t];
    if (!info || info.runtime_min === null) continue;
    list.push({ t, s, rt: info.runtime_min });
  }
  // views = s / (rt * 60); compare exactly: a before b when s_a * rt_b > s_b * rt_a
  const cmp = (a, b) => (b.s * a.rt - a.s * b.rt) || (a.t < b.t ? -1 : a.t > b.t ? 1 : 0);
  list.sort(cmp);
  return list.slice(0, k).map((x) => {
    const rank = 1 + list.filter((y) => y.s * x.rt > x.s * y.rt).length;
    return [rank, x.t, x.s / 3600, x.s / (x.rt * 60)];
  });
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([key, x]) => `'${key}': ${py(x)}`).join(", ") + "}";
}
const pyArgs = (c) => `(${py(c.rows)}, ${py(c.titles)}, '${c.day}', ${c.country === null ? "None" : `'${c.country}'`}, ${c.k})`;
const pyOut = (out) => "[" + out.map(([rk, t, h, v]) => `(${rk}, '${t}', ${h}, ${v})`).join(", ") + "]";
const run = (c) => oracle(c.rows, c.titles, c.day, c.country, c.k);

const COUNTRIES = ["US", "BR", "IN", "DE", "JP", "MX", "GB", "KR"];
const NAMES = ["The Long Tide", "Glass Orchard", "Night Shift Kitchen", "Paper Comets", "North of Nowhere",
  "Salt and Ember", "The Quiet Heist", "Lanterns", "Second Summer", "Iron Meadow", "Blue Hour", "Wild Signal"];

function catalogue(r, level, ids) {
  const titles = {};
  ids.forEach((t, i) => {
    let rt = r.pick([75, 88, 90, 104, 112, 135, 300, 342, 410, 486, 520]);
    if (level === 3 && i === ids.length - 1) rt = null;            // a live special with no runtime
    titles[t] = { name: NAMES[i % NAMES.length], runtime_min: rt };
  });
  return titles;
}

function sampleCase(r, level, day) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const ids = r.sample([...new Set(Array.from({ length: 60 }, (_, i) => "tt" + String(10000 + i * r.int(7, 13))))], r.int(6, 9));
    const titles = catalogue(r, level, ids);
    const missing = level === 3 ? "tt99999" : null;              // viewing for a title not in the catalogue
    const countries = level === 1 ? r.sample(COUNTRIES, 1) : r.sample(COUNTRIES, 3);
    const days = level === 3 ? [day, "2026-10-0" + r.int(1, 3)] : [day];
    const rows = [];
    for (const d of days) for (const c of countries) {
      const batches = level >= 2 && r.chance(0.5) ? 2 : 1;
      for (let b = 1; b <= batches; b++) {
        for (const t of r.sample(ids.concat(missing ? [missing] : []), r.int(3, 6))) {
          const s = 60 * r.int(20, 900);
          rows.push({ day: d, country: c, title: t, kind: "play", seconds: s, batch: b });
          if (level >= 2 && r.chance(0.25)) rows.push({ day: d, country: c, title: t, kind: "preview", seconds: 30 * r.int(1, 6), batch: b });
        }
      }
    }
    if (level === 3) {                                            // two titles tied on views
      const [a, b] = r.sample(ids.slice(0, -1), 2);
      titles[b].runtime_min = titles[a].runtime_min;
      for (const row of rows.filter((x) => x.title === b)) rows.splice(rows.indexOf(row), 1);
      for (const row of rows.filter((x) => x.title === a)) rows.push({ ...row, title: b });
    }
    const c = {
      rows: r.shuffle(rows), titles, day,
      country: level === 3 && r.chance(0.6) ? null : r.pick(countries),
      k: level === 3 ? r.int(3, 5) : 10,
    };
    if (run(c).length >= 3) return c;
  }
  throw new Error("NFX-L2-03: could not build a sample with a list");
}

export function generate(r, level) {
  const day = "2026-10-0" + r.int(4, 7);
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const c = sampleCase(r, level, day);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [A, B, C, D] = r.sample(["tt20410", "tt20977", "tt31002", "tt45518", "tt58230", "tt61119"], 4).sort();
  const [X, Y] = r.sample(COUNTRIES, 2);
  const h = (n) => 3600 * n;                                       // whole hours keep the checks readable
  const row = (title, seconds, extra = {}) => ({ day, country: X, title, kind: "play", seconds, batch: 1, ...extra });
  const cat = (rts) => Object.fromEntries(Object.entries(rts).map(([t, rt], i) => [t, { name: NAMES[i], runtime_min: rt }]));
  const m = r.int(2, 4);
  const edges = [
    ["a restatement in one country does not hide another country's viewing",
      { rows: [row(A, h(4 * m)), row(B, h(2 * m), { country: Y }), row(B, h(3 * m), { country: Y, batch: 2 })], titles: cat({ [A]: 120, [B]: 120 }), country: X }],
    ["a restated delivery replaces the earlier one entirely",
      { rows: [row(A, h(9 * m)), row(B, h(2 * m)), row(B, h(3 * m), { batch: 2 })], titles: cat({ [A]: 120, [B]: 120 }), country: X }],
    ["home-page previews are not viewing",
      { rows: [row(A, h(2 * m)), row(B, h(m)), row(B, h(5 * m), { kind: "preview" })], titles: cat({ [A]: 60, [B]: 60 }), country: X }],
    ["views divide by the runtime in hours, including the minutes",
      { rows: [row(A, h(3 * m))], titles: cat({ [A]: 90 }), country: X }],
    ["views decide the order, not hours",
      { rows: [row(A, h(5 * m)), row(B, h(9 * m))], titles: cat({ [A]: 60, [B]: 180 }), country: X }],
    ["titles with equal views share a rank",
      { rows: [row(A, h(10 * m)), row(B, h(6 * m)), row(C, h(6 * m)), row(D, h(2 * m))], titles: cat({ [A]: 120, [B]: 120, [C]: 120, [D]: 120 }), country: X }],
    ["a tie at the cut keeps the lower title id",
      { rows: [row(A, h(8 * m)), row(C, h(4 * m)), row(B, h(4 * m))], titles: cat({ [A]: 120, [B]: 120, [C]: 120 }), country: X, k: 2 }],
    ["the global list adds up every country",
      { rows: [row(A, h(3 * m)), row(B, h(2 * m)), row(B, h(2 * m), { country: Y })], titles: cat({ [A]: 60, [B]: 60 }), country: null }],
    ["a title missing from the catalogue or without a runtime is left out",
      { rows: [row(A, h(2 * m)), row(B, h(9 * m)), row(C, h(7 * m))], titles: cat({ [A]: 120, [C]: null }), country: X }],
    ["viewing on other days is ignored",
      { rows: [row(A, h(2 * m)), row(B, h(9 * m), { day: "2026-10-01" }), row(A, h(9 * m), { day: "2026-10-02" })], titles: cat({ [A]: 120, [B]: 120 }), country: X }],
  ];
  for (const [name, c] of edges) {
    c.day = day;
    c.k = c.k || 10;
    tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });
  }

  const n = 200000;
  const seed = r.int(1, 1_000_000);
  tests.push({
    name: `${n.toLocaleString("en-US")} viewing rows in time`,
    args: `(_gen_viewing(${n}, 3000, ${seed}), _gen_catalogue(3000), '2026-10-04', ${level === 3 ? "None" : "'BR'"}, 10)`,
    limit_s: 8,
  });

  return {
    vars: {
      scope_rule: level === 1
        ? "This day's data covers one country with one delivery; the checks also include several countries and restated deliveries."
        : level === 2
          ? "This day's data covers several countries, home-page previews and restated deliveries."
          : "This data covers several days and countries, previews, restated deliveries, titles missing from the catalogue or without a runtime, ties on views, and global lists (`country=None`) with a short `k`.",
    },
    samples,
    tests,
  };
}
