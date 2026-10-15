/* GDM-L3-05 — Predictions behind the catalogue: per release and organism, the published
   predictions whose accession's sequence changed in the sequence catalogue after the snapshot
   the prediction was computed against, and how many days each has been out of date (SQL).
   Simulated practice scenario. Accessions (SYN…), organisms as labels, releases, versions and
   dates are generated from the seed and are hypothetical; the release, carry-over and fragment
   rules are this exercise's rules, not a description of any real database or catalogue.

   One row per (release_id, organism) with predictions in that release, ordered by both:
     accessions        distinct accessions listed in the release for the organism
     behind            of those, accessions whose catalogue sequence_version rose after the
                       computing release's catalogue_snapshot, on or before as_of
     behind_pct        100 * behind / accessions, ROUND 1
     avg_days_behind   mean of (as_of - first such change's effective_on), ROUND 1; NULL if none
     max_days_behind   max of the same; NULL if none
   The sequence a prediction was computed against: the latest entry_versions row with
   effective_on <= catalogue_snapshot of the release named in predicted_in (an as-of join).
   level: 1 Medium (two releases, nothing carried over; annotation-only entry versions, a change
                    on a snapshot day, between snapshot and release, on as_of and after as_of)
          2 Hard (+ three releases, carried-over predictions computed against an earlier
                  snapshot, accessions that first appear in a later release)
          3 Very Hard (+ fragments: several rows per accession in a release, and accessions whose
                       sequence changed more than once after the snapshot) */
import { insertSQL, pad2 } from "../../js/rng.js";

export const kind = "sql";

const BASE = Date.UTC(2025, 10, 3) / 1000;                      // 2025-11-03
const ORGANISMS = ["Arabidopsis thaliana", "Caenorhabditis elegans", "Danio rerio", "Escherichia coli", "Homo sapiens",
  "Mus musculus", "Oryza sativa", "Rattus norvegicus", "Saccharomyces cerevisiae"];

function day(base, i) {
  const d = new Date((base + i * 86400) * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
/* Round p/q (q > 0) to `dec` decimals, half away from zero, as PostgreSQL rounds numeric. */
function roundRat(p, q, dec) {
  const f = 10 ** dec, s = p < 0 ? -1 : 1, a = Math.abs(p);
  return (s * Math.floor((2 * a * f + q) / (2 * q))) / f;
}
/* Is p/q exactly halfway between two values at `dec` decimals? */
function isHalf(p, q, dec) {
  const t = 2 * Math.abs(p) * 10 ** dec;
  return t % q === 0 && (t / q) % 2 === 1;
}

function build(r, level) {
  const base = BASE + r.int(0, 4) * 7 * 86400;
  const nRel = level === 1 ? 2 : 3;

  // Releases: catalogue snapshot S[k], public release R[k] two to five weeks later.
  const S = [], R = [];
  S.push(r.int(0, 10));
  for (let k = 0; k < nRel; k++) {
    R.push(S[k] + r.int(14, 35));
    if (k + 1 < nRel) S.push(R[k] + r.int(40, 75));
  }
  const asOf = R[nRel - 1] + r.int(12, 45);
  const relId = R.map((d) => day(base, d).slice(0, 7).replace("-", "_"));

  // Accessions per organism.
  const orgs = r.sample(ORGANISMS, level === 1 ? r.int(2, 3) : level === 2 ? 3 : r.int(3, 4)).sort();
  const accs = [];
  let num = 1000 + r.int(0, 2000);
  for (const org of orgs) {
    const n = level === 1 ? r.int(4, 6) : r.int(5, 7);
    for (let i = 0; i < n; i++) {
      const late = level >= 2 && r.chance(0.15);
      accs.push({
        id: "SYN" + (num += r.int(3, 60)), org, late,
        first: late ? r.int(S[0] + 1, S[1] - 1) : r.int(-1500, -40),
        events: [], forced: false, carry: true, nFrag: 1,
      });
    }
  }

  // Forced edge cases, each on its own accession that has no other later events.
  const pool = r.shuffle(accs.filter((a) => !a.late));
  let p = 0;
  const take = () => { const a = pool[p++]; a.forced = true; a.carry = false; return a; };
  const kSnap = nRel - 1;                                                  // current in the last release only
  take().events.push({ day: S[kSnap], seq: true });                         // change on a snapshot day
  take().events.push({ day: asOf, seq: true });                             // change on as_of: 0 days
  take().events.push({ day: asOf + r.int(1, 30), seq: true });              // change after as_of
  take().events.push({ day: r.int(S[0] + 1, asOf), seq: false });           // annotation-only update
  const kGap = r.int(0, nRel - 1);
  take().events.push({ day: r.int(S[kGap] + 1, R[kGap] - 1), seq: true }); // between snapshot and release
  let carried = null;
  if (level >= 2) {                                                         // carried from release 1
    carried = take();
    carried.carry = "first";
    carried.events.push({ day: r.int(S[0] + 1, S[nRel - 1]), seq: true });
  }
  if (level === 3) {                                                        // two changes, and fragments
    const a = take();
    const d1 = r.int(S[nRel - 1] + 1, asOf - 10);
    a.events.push({ day: d1, seq: true }, { day: r.int(d1 + 1, asOf), seq: true });
    a.nFrag = 3;
  }

  // Random history for the rest: annotation updates and sequence changes.
  for (const a of accs) {
    if (!a.forced) {
      const used = new Set([a.first]);
      for (let k = r.int(0, 2); k > 0; k--) {
        const d = r.int(Math.max(a.first + 1, S[0] - 30), asOf + 40);
        if (used.has(d)) continue;
        used.add(d);
        a.events.push({ day: d, seq: r.chance(0.5) });
      }
    }
    if (level === 3 && a.nFrag === 1 && r.chance(0.2)) a.nFrag = r.int(2, 4);
    a.events.sort((x, y) => x.day - y.day);
    a.versions = [{ day: a.first, entry: 1, seq: 1 }];
    for (const e of a.events) {
      const last = a.versions[a.versions.length - 1];
      a.versions.push({ day: e.day, entry: last.entry + 1, seq: last.seq + (e.seq ? 1 : 0) });
    }
  }

  // Which release computed each accession's prediction in each release.
  for (const a of accs) {
    a.predIn = [];
    for (let k = 0; k < nRel; k++) {
      if (a.first > S[k]) { a.predIn.push(null); continue; }
      const prev = k > 0 ? a.predIn[k - 1] : null;
      if (a.carry === "first") a.predIn.push(0);
      else if (level >= 2 && a.carry && prev !== null && r.chance(0.35)) a.predIn.push(prev);
      else a.predIn.push(k);
    }
  }

  // The oracle. opts break one rule each, for diagnostics.
  const compute = (opts = {}) => {
    const rows = [];
    for (let k = 0; k < nRel; k++) {
      for (const org of orgs) {
        let n = 0, b = 0, sum = 0, mx = null;
        for (const a of accs) {
          if (a.org !== org || a.predIn[k] === null) continue;
          const P = a.predIn[k];
          const snap = opts.listingSnap ? S[k] : opts.releaseDate ? R[P] : S[P];
          let at = null;
          for (const v of a.versions) if (opts.strictSnap ? v.day < snap : v.day <= snap) at = v;
          const w = opts.fragmentsCounted ? a.nFrag : 1;
          n += w;
          const ch = a.versions.filter((v) => (opts.anyEntry ? v.entry > at.entry : v.seq > at.seq) &&
            (opts.futureCounted || (opts.asOfExclusive ? v.day < asOf : v.day <= asOf)));
          if (!ch.length) continue;
          const d = opts.lastChange ? Math.max(...ch.map((v) => v.day)) : Math.min(...ch.map((v) => v.day));
          b += w;
          sum += w * (asOf - d);
          mx = mx === null ? asOf - d : Math.max(mx, asOf - d);
        }
        if (!n) continue;
        if (opts.dropZero && !b) continue;
        rows.push([relId[k], org, n, b, roundRat(100 * b, n, 1), b ? roundRat(sum, b, 1) : null, b ? mx : null,
          { b, n, sum }]);
      }
    }
    return rows;
  };
  return { base, nRel, S, R, asOf, relId, orgs, accs, compute };
}

export function generate(r, level) {
  // Keep every rounded value away from an exact half, so equivalent formulas cannot round apart.
  let g = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    g = build(r, level);
    const raw = g.compute();
    if (!raw.some(([, , , , , , , x]) => isHalf(100 * x.b, x.n, 1) || (x.b && isHalf(x.sum, x.b, 1)))) break;
  }
  const { base, nRel, S, R, asOf, relId, accs, compute } = g;
  const strip = (rows) => rows.map((row) => row.slice(0, 7));
  const expected = strip(compute());

  const diagnostics = [
    { message: "A new entry version was treated as a sequence change. The catalogue raises entry_version for annotation-only updates too; a prediction is behind only when sequence_version rose.", rows: strip(compute({ anyEntry: true })) },
    { message: "The as-of lookup excluded the row effective on the snapshot date itself. A prediction was computed against the latest row with effective_on on or before catalogue_snapshot, so a change dated on the snapshot day is already in it.", rows: strip(compute({ strictSnap: true })) },
    { message: "The sequence was looked up as of released_on instead of catalogue_snapshot. A prediction was computed from the catalogue snapshot; a sequence that changed between the snapshot and the public release was already out of date on release day.", rows: strip(compute({ releaseDate: true })) },
    { message: "Catalogue rows dated after the report date were counted. The report is as of " + day(base, asOf) + "; a later row was not known then, and counting it makes the report change every time it is rerun.", rows: strip(compute({ futureCounted: true })) },
    { message: "A change effective on the report date itself was left out. Rows effective on or before " + day(base, asOf) + " count; such a prediction is behind by 0 days.", rows: strip(compute({ asOfExclusive: true })) },
    { message: "Release and organism groups with nothing behind were dropped. Every release and organism with predictions gets a row, with behind 0, behind_pct 0.0 and NULL days.", rows: strip(compute({ dropZero: true })) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Carried-over predictions were checked against the snapshot of the release that lists them. predicted_in names the release whose run computed the prediction; its catalogue_snapshot fixes the sequence the prediction used.", rows: strip(compute({ listingSnap: true })) });
  }
  if (level === 3) {
    diagnostics.push(
      { message: "Fragment rows were counted as separate predictions. A long sequence is listed as several fragment rows of one accession; count accessions, not rows.", rows: strip(compute({ fragmentsCounted: true })) },
      { message: "Days behind were counted from the latest sequence change. A prediction became out of date at the first change after its snapshot; later changes do not reset the clock.", rows: strip(compute({ lastChange: true })) },
    );
  }

  // Tables.
  const relCols = ["release_id", "released_on", "catalogue_snapshot"];
  const relRows = relId.map((id, k) => [id, day(base, R[k]), day(base, S[k])]);
  const accCols = ["accession", "organism"];
  const sorted = accs.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
  const accRows = sorted.map((a) => [a.id, a.org]);
  const verCols = ["accession", "entry_version", "sequence_version", "effective_on"];
  const verRows = [];
  for (const a of sorted) for (const v of a.versions) verRows.push([a.id, v.entry, v.seq, day(base, v.day)]);
  const predCols = ["release_id", "entry_id", "accession", "fragment", "predicted_in"];
  const predRows = [];
  for (let k = 0; k < nRel; k++) {
    for (const a of sorted) {
      if (a.predIn[k] === null) continue;
      for (let f = 1; f <= a.nFrag; f++) predRows.push([relId[k], `${a.id}-F${f}`, a.id, f, relId[a.predIn[k]]]);
    }
  }

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE releases (\n  release_id TEXT PRIMARY KEY,\n  released_on DATE NOT NULL,\n  catalogue_snapshot DATE NOT NULL CHECK (catalogue_snapshot < released_on)\n);\n" +
    "CREATE TABLE accessions (\n  accession TEXT PRIMARY KEY,\n  organism TEXT NOT NULL\n);\n" +
    "CREATE TABLE entry_versions (\n  accession TEXT NOT NULL REFERENCES accessions (accession),\n  entry_version INT NOT NULL,\n  sequence_version INT NOT NULL,\n  effective_on DATE NOT NULL,\n  PRIMARY KEY (accession, entry_version),\n  UNIQUE (accession, effective_on)\n);\n" +
    "CREATE TABLE predictions (\n  release_id TEXT NOT NULL REFERENCES releases (release_id),\n  entry_id TEXT NOT NULL,\n  accession TEXT NOT NULL REFERENCES accessions (accession),\n  fragment INT NOT NULL CHECK (fragment >= 1),\n  predicted_in TEXT NOT NULL REFERENCES releases (release_id),\n  PRIMARY KEY (release_id, entry_id)\n);\n" +
    insertSQL("releases", relCols, relRows) + insertSQL("accessions", accCols, accRows) +
    insertSQL("entry_versions", verCols, verRows) + insertSQL("predictions", predCols, predRows);

  return {
    vars: {
      as_of: day(base, asOf),
      release_count: nRel,
      prediction_rows: predRows.length,
      catalogue_rows: verRows.length,
      carry_rule: level === 1
        ? "In this sample every release recomputed all of its predictions, so `predicted_in` always equals `release_id`."
        : "A release recomputes some predictions and carries the others over unchanged from an earlier release; a carried-over row names, in `predicted_in`, the earlier release whose run computed it.",
      fragment_rule: level === 3
        ? "Long sequences are predicted as several overlapping fragments (this exercise's rule), so one accession can have several rows in a release, with `fragment` 1, 2, 3 …; all of them share one `predicted_in`. Count accessions, not rows."
        : "Every accession has exactly one row in each release that lists it (`fragment` is always 1).",
    },
    setup,
    tables: [
      { name: "releases", columns: relCols, rows: relRows },
      { name: "accessions", columns: accCols, rows: accRows },
      { name: "entry_versions", columns: verCols, rows: verRows },
      { name: "predictions", columns: predCols, rows: predRows },
    ],
    expected: {
      columns: ["release_id", "organism", "accessions", "behind", "behind_pct", "avg_days_behind", "max_days_behind"],
      rows: expected,
    },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
