/* GDM-L1-02 — Confidence bands per organism and release (SQL).
   Simulated practice scenario. All data is generated from the seed: accessions are
   synthetic (an X and five digits, not a real catalogue format) and every confidence
   value is hypothetical. The bands are this exercise's rule; check current docs.

   Contract: generate(r, level) -> { vars, setup, tables, expected, diagnostics }.
   The oracle below walks the generated residues in JavaScript; the evaluator's
   reference SQL is written independently and must return the same rows.
   level: 1 Medium (one release, values exactly on every band edge, a prediction
          mostly in the lowest band) · 2 Hard (+ a second release with an accession
          predicted in both, a withdrawn prediction, a prediction with exactly half
          its residues in the lowest band) · 3 Very Hard (+ residues with no score,
          residue rows delivered twice, and a prediction that is "mostly very low"
          only if unscored or duplicated rows are counted) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const ORGANISMS = ["Homo sapiens", "Mus musculus", "Escherichia coli", "Saccharomyces cerevisiae", "Arabidopsis thaliana", "Danio rerio"];
const RELEASES = [["v3", "v4"], ["2025-06", "2026-02"], ["r5", "r6"]];

const band = (v, strict) => {                 // v in hundredths; strict: edges go to the band below
  if (strict ? v > 9000 : v >= 9000) return 0;
  if (strict ? v > 7000 : v >= 7000) return 1;
  if (strict ? v > 5000 : v >= 5000) return 2;
  return 3;
};
const pct1 = (a, b) => Math.floor((2000 * a + b) / (2 * b)) / 10;   // ROUND(100 a / b, 1)
const fmt = (v) => (v === null ? null : (v / 100).toFixed(2));

export function generate(r, level) {
  const releases = r.pick(RELEASES).slice(0, level === 1 ? 1 : 2);
  const organisms = r.sample(ORGANISMS, level === 1 ? r.int(2, 3) : 3);
  const preds = [];                           // {id, acc, org, rel, withdrawn, res: [[idx, v|null]], dup: [[idx, v]]}
  let pid = r.int(100, 700);
  const accs = new Set();
  const newAcc = () => { let a; do a = "X" + String(r.int(10000, 99999)); while (accs.has(a)); accs.add(a); return a; };

  const profileValue = (profile) => {
    const x = r.next();
    if (profile === "high") return x < 0.7 ? r.int(9000, 9900) : x < 0.9 ? r.int(7000, 8999) : r.int(5000, 6999);
    if (profile === "low") return x < 0.65 ? r.int(2000, 4999) : x < 0.85 ? r.int(5000, 6999) : r.int(7000, 9500);
    return x < 0.3 ? r.int(9000, 9900) : x < 0.55 ? r.int(7000, 8999) : x < 0.8 ? r.int(5000, 6999) : r.int(2500, 4999);
  };
  const make = (org, rel, opts = {}) => {
    const n = opts.n ?? r.int(8, 16);
    const res = opts.values
      ? opts.values.map((v, i) => [i + 1, v])
      : Array.from({ length: n }, (_, i) => [i + 1, profileValue(opts.profile ?? r.pick(["high", "mixed", "mixed", "low"]))]);
    const p = { id: "pred-" + String(pid++).padStart(4, "0"), acc: opts.acc ?? newAcc(), org, rel, withdrawn: !!opts.withdrawn, res, dup: [] };
    preds.push(p);
    return p;
  };

  for (const rel of releases) {
    for (const org of organisms) {
      if (level >= 2 && rel === releases[0] && org === organisms[2]) continue;   // an organism new in the later release
      const k = r.int(2, 4);
      for (let i = 0; i < k; i++) make(org, rel);
    }
  }
  // Values exactly on every band edge, in one prediction.
  {
    const edge = [9000, 8999, 7000, 6999, 5000, 4999, r.int(9100, 9800), r.int(3000, 4500)];
    make(organisms[0], releases[0], { values: r.shuffle(edge) });
  }
  // A prediction mostly in the lowest band.
  make(organisms[1], releases[0], { values: r.shuffle([r.int(2000, 4999), r.int(2000, 4999), r.int(2000, 4999), 4999, r.int(7000, 9500), r.int(5000, 6999)]) });

  if (level >= 2) {
    // The same accession predicted in both releases: counted in each release.
    const acc = newAcc();
    make(organisms[0], releases[0], { acc, profile: "low", n: r.int(8, 12) });
    make(organisms[0], releases[1], { acc, profile: "high", n: r.int(8, 12) });
    // Withdrawn from the later release: excluded everywhere.
    make(organisms[1], releases[1], { withdrawn: true, profile: "low", n: r.int(6, 10) });
    // Exactly half in the lowest band: not "mostly".
    const h = r.int(3, 5);
    const vals = [];
    for (let i = 0; i < h; i++) vals.push(r.int(2000, 4999));
    for (let i = 0; i < h; i++) vals.push(r.int(5000, 9800));
    make(organisms[2], releases[1], { values: r.shuffle(vals) });
  }
  if (level === 3) {
    // Unscored residues (NULL) in several predictions; they are not residues for the shares.
    for (const p of r.sample(preds.filter((q) => !q.withdrawn), 3)) {
      for (const i of r.sample(p.res.map((_, k) => k), 2)) p.res[i][1] = null;
    }
    // Half very low among scored residues, but more than half if NULLs count as very low.
    const k = r.int(3, 4);
    const vals = [];
    for (let i = 0; i < k; i++) vals.push(r.int(2000, 4999));
    for (let i = 0; i < k; i++) vals.push(r.int(7000, 9800));
    vals.push(null, null);
    make(organisms[1], releases[1], { values: r.shuffle(vals) });
    // Residue rows delivered twice: one makes a prediction look mostly very low if counted twice.
    const vals2 = [];
    for (let i = 0; i < 4; i++) vals2.push(r.int(2000, 4999));
    for (let i = 0; i < 5; i++) vals2.push(r.int(5000, 9800));
    const p2 = make(organisms[0], releases[1], { values: r.shuffle(vals2) });
    for (const [idx, v] of p2.res) if (v !== null && v < 5000) p2.dup.push([idx, v]);
    const p3 = r.pick(preds.filter((q) => !q.withdrawn && q !== p2));
    for (const [idx, v] of r.sample(p3.res, 3)) p3.dup.push([idx, v]);
  }

  // ---- Oracle -------------------------------------------------------------------
  const compute = (o = {}) => {
    const groups = new Map();
    for (const p of preds) {
      if (p.withdrawn && !o.keepWithdrawn) continue;
      let rows = p.res.slice();
      if (o.keepDup) rows = rows.concat(p.dup);
      const counts = [0, 0, 0, 0];
      let scored = 0;
      for (const [, v] of rows) {
        if (v === null) {
          if (o.nullAsLow) { counts[3]++; scored++; }
          continue;
        }
        counts[band(v, o.strict)]++;
        scored++;
      }
      const key = p.rel + "|" + p.org;
      if (!groups.has(key)) groups.set(key, { preds: 0, res: 0, c: [0, 0, 0, 0], pctSum: [0, 0, 0, 0], mostly: 0 });
      const g = groups.get(key);
      g.preds++;
      g.res += scored;
      for (let b = 0; b < 4; b++) { g.c[b] += counts[b]; g.pctSum[b] += counts[b] / scored; }
      if (o.halfIsMostly ? 2 * counts[3] >= scored : 2 * counts[3] > scored) g.mostly++;
    }
    return [...groups.keys()]
      .sort((a, b) => {
        const [ra, oa] = a.split("|"), [rb, ob] = b.split("|");
        return ra !== rb ? (ra < rb ? -1 : 1) : oa < ob ? -1 : oa > ob ? 1 : 0;
      })
      .map((k) => {
        const [rel, org] = k.split("|");
        const g = groups.get(k);
        const pc = o.avgOfPreds
          ? g.pctSum.map((s) => Math.round((1000 * s) / g.preds) / 10)
          : g.c.map((c) => pct1(c, g.res));
        return [rel, org, g.preds, g.res, ...pc, g.mostly];
      });
  };
  const rows = compute();

  const diagnostics = [
    { message: "Values on a band edge went to the band below. This exercise's bands include their lower edge: 90.00 is very high, 70.00 confident, 50.00 low.", rows: compute({ strict: true }) },
    { message: "Percentages were averaged over predictions. They are residue-weighted: band residues over all scored residues of the organism and release.", rows: compute({ avgOfPreds: true }) },
    { message: "A prediction with exactly half its residues in the lowest band was counted as mostly very low. Mostly means strictly more than half.", rows: compute({ halfIsMostly: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "A withdrawn prediction was counted. Withdrawn predictions are excluded from every column.", rows: compute({ keepWithdrawn: true }) });
  if (level === 3) {
    diagnostics.push({ message: "Residues with no score were counted (as very low). Unscored residues are not residues for the shares or for 'mostly'.", rows: compute({ nullAsLow: true }) });
    diagnostics.push({ message: "Residue rows delivered twice were counted twice. Each (prediction, residue) counts once.", rows: compute({ keepDup: true }) });
  }

  // ---- Tables ---------------------------------------------------------------------
  const pCols = ["prediction_id", "accession", "organism", "release", "withdrawn"];
  const pRows = preds.map((p) => [p.id, p.acc, p.org, p.rel, p.withdrawn]);
  const rCols = ["prediction_id", "residue_index", "plddt"];
  const rRows = [];
  for (const p of preds) {
    const all = p.res.map(([i, v]) => [i, v]).concat(p.dup);
    all.sort((a, b) => a[0] - b[0]);
    for (const [i, v] of all) rRows.push([p.id, i, fmt(v)]);
  }
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE predictions (\n  prediction_id TEXT PRIMARY KEY,\n  accession TEXT NOT NULL,\n  organism TEXT NOT NULL,\n  release TEXT NOT NULL,\n  withdrawn BOOLEAN NOT NULL\n);\n" +
    "CREATE TABLE residue_confidence (\n  prediction_id TEXT NOT NULL REFERENCES predictions(prediction_id),\n  residue_index INT NOT NULL,\n  plddt NUMERIC(5,2)\n);\n" +
    insertSQL("predictions", pCols, pRows) + insertSQL("residue_confidence", rCols, rRows);

  return {
    vars: {
      predictions: preds.length,
      residue_rows: rRows.length,
      release_rule: releases.length === 1
        ? `Every prediction in this sample belongs to release ${releases[0]}.`
        : `The sample holds two releases, ${releases[0]} and ${releases[1]}; an accession can be predicted in both, and each release is reported on its own. A prediction marked withdrawn is excluded from every column.`,
      null_rule: level === 3
        ? "Some residues have no score (plddt is NULL): they are not counted as residues, in any band, or in the half used for mostly_very_low. Some residue rows were delivered twice with identical values: each (prediction_id, residue_index) counts once."
        : "Every residue in this sample has a score and appears once.",
    },
    setup,
    tables: [
      { name: "predictions", columns: pCols, rows: pRows },
      { name: "residue_confidence", columns: rCols, rows: rRows },
    ],
    expected: {
      columns: ["release", "organism", "predictions", "residues", "very_high_pct", "confident_pct", "low_pct", "very_low_pct", "mostly_very_low"],
      rows,
    },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
