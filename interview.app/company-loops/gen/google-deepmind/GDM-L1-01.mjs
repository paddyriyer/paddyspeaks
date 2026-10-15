/* GDM-L1-01 — Watermark detection outcomes per content type, detector version and
   week (SQL).
   Simulated practice scenario. All data is generated from the seed; files are
   identified by a synthetic hash only (no content is kept), and every outcome,
   confidence level, detector version and count is hypothetical.

   Contract: generate(r, level) -> { vars, setup, tables, expected, diagnostics }.
   The oracle below walks the generated checks in JavaScript; the evaluator's
   reference SQL is written independently and must return the same rows.
   level: 1 Medium (one week, two detector versions, repeated checks of a file, low
          confidence results) · 2 Hard (+ a second week, a file re-checked across the
          week boundary, error checks that must not replace a result, a file with only
          errors) · 3 Very Hard (+ two checks of a file at the same second, broken by
          check id; checks one second either side of the week boundary; a pre-release
          detector version with only low-confidence results, so its share is NULL) */
import { insertSQL, pad2 } from "../../js/rng.js";

export const kind = "sql";

const TYPES = ["image", "video", "audio", "text"];
const VERSIONS = [["det-1.4", "det-2.0"], ["det-2.1", "det-2.2"], ["det-3.0", "det-3.1"], ["det-1.9", "det-2.3"]];
const OUTCOMES = ["watermarked", "partial", "not_watermarked"];
const BASE = Date.UTC(2026, 8, 7);            // Monday 2026-09-07 00:00 UTC
const WEEK = 7 * 86400;

function stamp(sec) {                         // seconds after BASE -> "YYYY-MM-DD HH:MM:SS+00"
  const d = new Date(BASE + sec * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}+00`;
}
function weekOf(sec) {
  const d = new Date(BASE + Math.floor(sec / WEEK) * WEEK * 1000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
function share(a, b) {                        // ROUND(a / b, 3), half away from zero; NULL when b = 0
  if (b === 0) return null;
  return Math.floor((2000 * a + b) / (2 * b)) / 1000;
}

export function generate(r, level) {
  const types = r.sample(TYPES, level === 1 ? 3 : 4);
  const versions = r.pick(VERSIONS);
  const weeks = level === 1 ? 1 : 2;
  const checks = [];                          // {file, type, ver, t, outcome, conf}
  const files = [];
  const usedHashes = new Set();
  const newHash = () => {
    let h;
    do h = "f" + r.int(0x100000, 0xffffff).toString(16); while (usedHashes.has(h));
    usedHashes.add(h);
    return h;
  };
  const conf = () => { const x = r.next(); return x < 0.22 ? "low" : x < 0.55 ? "medium" : "high"; };
  const add = (file, type, ver, t, outcome, c) => checks.push({ file, type, ver, t, outcome, conf: outcome === "error" ? null : c });
  const span = weeks * WEEK;
  const tiedPair = [];                        // indexes of the two checks at the same second (Very Hard)

  for (const type of types) {
    const n = level === 1 ? r.int(3, 5) : r.int(4, 6);
    for (let i = 0; i < n; i++) {
      const file = newHash();
      files.push(file);
      for (const ver of versions) {
        if (ver === versions[1] && r.chance(0.35)) continue;          // not every file is checked by both versions
        const k = r.chance(0.5) ? 1 : r.int(2, 3);                     // repeated checks of one file
        for (let j = 0; j < k; j++) add(file, type, ver, r.int(600, span - 600), r.pick(OUTCOMES), conf());
      }
    }
  }
  // A file checked again later with a different, low-confidence result: the latest stands.
  {
    const type = types[0], file = newHash();
    const t0 = r.int(3600, WEEK - 3 * 86400);
    add(file, type, versions[0], t0, "watermarked", "high");
    add(file, type, versions[0], t0 + r.int(3600, 86400), r.pick(["partial", "not_watermarked"]), "low");
    add(file, type, versions[1], t0 + r.int(60, 3000), "watermarked", "high");
  }
  if (level >= 2) {
    // Errors after a valid result do not replace it; a file with only errors has no result.
    const withResult = checks.filter((c) => c.outcome !== "error");
    for (let k = 0; k < 2; k++) {
      const c = r.pick(withResult);
      const last = Math.max(...checks.filter((x) => x.file === c.file && x.ver === c.ver).map((x) => x.t));
      add(c.file, c.type, c.ver, Math.min(span - 1, last + r.int(60, 7200)), "error", null);
    }
    const lonely = newHash();
    add(lonely, types[1], versions[0], r.int(600, span - 600), "error", null);
    add(lonely, types[1], versions[0], r.int(600, span - 600), "error", null);
    // Re-checked across the week boundary: counted once, in the week of its latest check.
    const cross = newHash();
    const tw = r.pick(types);
    add(cross, tw, versions[0], r.int(86400, WEEK - 86400), "partial", "high");
    add(cross, tw, versions[0], WEEK + r.int(3600, 3 * 86400), "watermarked", r.pick(["high", "medium"]));
  }
  if (level === 3) {
    // Two checks of one file at the same second: the greater check id wins.
    const tie = newHash();
    const tt = types[2];
    const t1 = r.int(WEEK + 3600, span - 7200);
    add(tie, tt, versions[1], t1 - r.int(600, 3000), "watermarked", "high");
    add(tie, tt, versions[1], t1, "not_watermarked", "high");
    tiedPair.push(checks.length - 1);
    add(tie, tt, versions[1], t1, "partial", "medium");
    tiedPair.push(checks.length - 1);
    // One second either side of the week boundary.
    const edge = newHash();
    add(edge, types[3], versions[0], WEEK - 1, "watermarked", "high");
    const edge2 = newHash();
    add(edge2, types[3], versions[0], WEEK - r.int(3600, 7200), "not_watermarked", "high");
    add(edge2, types[3], versions[0], WEEK, "partial", "high");
    // A pre-release detector version tried on two files, both with low confidence.
    const pre = versions[1] + "-rc";
    for (let k = 0; k < 2; k++) add(newHash(), types[k], pre, r.int(WEEK, span - 600), r.pick(OUTCOMES), "low");
  }

  // Check ids are unique but not in time order. The two checks at the same second get
  // ids in a known order: the later-added one (partial, medium) gets the greater id.
  const rank = r.shuffle(checks.map((_, i) => i));
  if (tiedPair.length === 2) {
    const [a, b] = [rank.indexOf(tiedPair[0]), rank.indexOf(tiedPair[1])];
    rank[Math.min(a, b)] = tiedPair[0];
    rank[Math.max(a, b)] = tiedPair[1];
  }
  let cur = r.int(10000, 60000);
  for (const ci of rank) { cur += r.int(1, 9); checks[ci].id = "chk-" + String(cur).padStart(6, "0"); }

  // ---- Oracle -------------------------------------------------------------------
  const later = (a, b, o) => (a.t !== b.t ? a.t > b.t : o.tieLow ? a.id < b.id : a.id > b.id);
  const compute = (o = {}) => {
    const results = [];
    if (o.countChecks) {
      for (const c of checks) if (c.outcome !== "error") results.push(c);
    } else {
      const best = new Map();
      for (const c of checks) {
        if (c.outcome === "error" && !o.keepErrors) continue;
        const key = o.acrossVersions ? c.file : c.file + "|" + c.ver;
        const cur2 = best.get(key);
        let take;
        if (!cur2) take = true;
        else if (o.idLatest) take = c.id > cur2.id;
        else if (o.earliest) take = c.t !== cur2.t ? c.t < cur2.t : c.id > cur2.id;
        else take = later(c, cur2, o);
        if (take) best.set(key, c);
      }
      for (const c of best.values()) if (c.outcome !== "error") results.push(c);
    }
    const groups = new Map();
    for (const c of results) {
      const key = [weekOf(c.t), c.type, c.ver].join("|");
      if (!groups.has(key)) groups.set(key, { files: 0, w: 0, p: 0, n: 0, low: 0 });
      const g = groups.get(key);
      g.files++;
      const low = c.conf === "low" && !o.lowInOutcome;
      if (c.conf === "low") g.low++;
      if (low) continue;
      if (c.outcome === "watermarked") g.w++;
      else if (c.outcome === "partial") g.p++;
      else g.n++;
    }
    return [...groups.keys()].sort().map((k) => {
      const [wk, type, ver] = k.split("|");
      const g = groups.get(k);
      const confident = o.lowInOutcome ? g.files : g.files - g.low;
      return [wk, type, ver, g.files, g.w, g.p, g.n, g.low, share(g.w + g.p, confident)];
    });
  };
  const rows = compute();

  const diagnostics = [
    { message: "Every check was counted. A file checked several times by one detector version counts once, with its latest result.", rows: compute({ countChecks: true }) },
    { message: "The earliest check was used. A file's result for a detector version is its latest check.", rows: compute({ earliest: true }) },
    { message: "Low-confidence results were counted in the outcome columns and the share. They are shown apart, only in low_confidence.", rows: compute({ lowInOutcome: true }) },
    { message: "Checks were collapsed per file across detector versions. A file checked by two versions has a result for each version.", rows: compute({ acrossVersions: true }) },
    { message: "The latest check was taken as the greatest check_id. Check ids are not in time order; checked_at decides, and the id only breaks a tie.", rows: compute({ idLatest: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "An error check replaced the file's earlier result. Errors carry no result: the latest check that is not an error decides.", rows: compute({ keepErrors: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Two checks at the same second were broken by the smaller check_id. The greater check_id wins a tie.", rows: compute({ tieLow: true }) });
  }

  // ---- Tables ---------------------------------------------------------------------
  const cols = ["check_id", "file_hash", "content_type", "detector_version", "checked_at", "outcome", "confidence"];
  const tableRows = checks
    .slice()
    .sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1))
    .map((c) => [c.id, c.file, c.type, c.ver, stamp(c.t), c.outcome, c.conf]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE detection_checks (\n  check_id TEXT PRIMARY KEY,\n  file_hash TEXT NOT NULL,\n  content_type TEXT NOT NULL,\n  detector_version TEXT NOT NULL,\n  checked_at TIMESTAMPTZ NOT NULL,\n  outcome TEXT NOT NULL CHECK (outcome IN ('watermarked','partial','not_watermarked','error')),\n  confidence TEXT CHECK (confidence IN ('high','medium','low'))\n);\n" +
    insertSQL("detection_checks", cols, tableRows);

  return {
    vars: {
      checks: checks.length,
      week_rule: weeks === 1 ? "All checks in this sample fall in one week." : "The sample covers two weeks.",
      error_rule: level === 1
        ? "In this sample no check ended in an error."
        : "A check can end with outcome error (the file could not be read) and no confidence; an error carries no result and never replaces an earlier one, and a file with only error checks for a version has no result for it.",
      tie_rule: level === 3
        ? "Two checks of the same file and version can share a checked_at to the second; the one with the greater check_id is the later."
        : "No two checks of the same file and version share a checked_at.",
    },
    setup,
    tables: [{ name: "detection_checks", columns: cols, rows: tableRows }],
    expected: {
      columns: ["week_start", "content_type", "detector_version", "files", "watermarked", "partial", "not_watermarked", "low_confidence", "watermarked_share"],
      rows,
    },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
