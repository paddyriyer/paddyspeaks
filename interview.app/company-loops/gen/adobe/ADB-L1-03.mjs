/* ADB-L1-03 — Content credentials coverage of exported images, per app, month and format (SQL).
   Simulated practice scenario. All data is generated from the seed. Content credentials appear only as
   provenance metadata recorded against an export; whether it was attached is all this report measures.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (sql).
   expected comes from the JavaScript oracle below, written independently of the evaluator's SQL.
   level: 1 Medium (image formats only; one manifest event per export at most; an 'all' row per app and
            month; a minimum-exports floor, inclusive)
          2 Hard (+ format spellings that differ in case and 'jpg' for 'jpeg', several manifest events per
            export, exports in the last minute of a month)
          3 Very Hard (+ 'stripped' events: the latest non-failed event decides, so credentials embedded and
            then stripped do not count, and ones embedded again afterwards do) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const APPS = ["express", "illustrator", "lightroom", "photoshop"];
const IMAGE = ["jpeg", "png", "tiff", "webp"];
const SPELL = { jpeg: ["jpeg", "JPEG", "jpg", "JPG", "Jpeg"], png: ["png", "PNG"], tiff: ["tiff", "TIFF"], webp: ["webp", "WEBP"], pdf: ["pdf", "PDF"], mp4: ["mp4", "MP4"] };
const DAY = 86400;
const T0 = Date.UTC(2026, 8, 1);
const stamp = (abs) => new Date(T0 + abs * 1000).toISOString().replace("T", " ").slice(0, 19) + "+00";
const MONTHS = [{ key: "2026-09-01", off: 0, days: 30 }, { key: "2026-10-01", off: 30 * DAY, days: 31 }];
const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);

export function generate(r, level) {
  const floor = r.pick([3, 4, 5]);
  const apps = r.sample(APPS, level === 3 ? 3 : 2).sort();
  const exportsList = [];   // {app, abs, fmt, raw, events: [outcome]}
  let first = true;
  const spell = (f) => (level === 1 ? f : r.pick(SPELL[f]));

  const makeEvents = (has) => {
    if (level === 1) return has ? ["embedded"] : r.chance(0.4) ? ["failed"] : [];
    const ev = [];
    if (has) {
      const shape = r.int(0, level === 3 ? 4 : 2);
      if (shape === 0) ev.push("embedded");
      else if (shape === 1) ev.push("failed", "embedded");
      else if (shape === 2) ev.push("embedded", "embedded");
      else if (shape === 3) ev.push("embedded", "stripped", "embedded");
      else ev.push("embedded", "failed");
    } else {
      const shape = r.int(0, level === 3 ? 3 : 2);
      if (shape === 1) ev.push("failed");
      else if (shape === 2) ev.push("failed", "failed");
      else if (shape === 3) ev.push("embedded", "stripped");
    }
    return ev;
  };

  for (const app of apps) {
    const p = r.pick([0.35, 0.5, 0.65, 0.8]);
    for (const m of MONTHS) {
      const fmts = r.sample(IMAGE, r.int(2, 3));
      for (const f of fmts) {
        let n = r.pick([floor - 1, floor, floor + 1, floor + 2, 1]);
        if (first) { n = floor; first = false; }           // a row exactly at the floor
        for (let k = 0; k < n; k++) {
          let abs = m.off + r.int(0, (m.days - 1) * DAY);
          if (level >= 2 && m.off === 0 && k === 0 && r.chance(0.5)) abs = m.days * DAY - r.int(1, 59);  // last minute of September
          exportsList.push({ app, abs, fmt: f, raw: spell(f), events: makeEvents(r.chance(p)) });
        }
      }
      for (let k = r.int(1, 2); k > 0; k--) {
        const f = r.pick(["pdf", "mp4"]);
        exportsList.push({ app, abs: m.off + r.int(0, (m.days - 1) * DAY), fmt: f, raw: spell(f), events: makeEvents(r.chance(0.7)) });
      }
    }
  }
  // Hard+: make sure 'jpg' and an upper-case spelling both appear.
  if (level >= 2) {
    const jpegs = exportsList.filter((e) => e.fmt === "jpeg");
    if (jpegs.length) jpegs[0].raw = "jpg";
    if (jpegs.length > 1) jpegs[1].raw = "JPEG";
  }
  // Very Hard: one export embedded then stripped, one stripped and embedded again.
  if (level === 3) {
    const imgs = exportsList.filter((e) => IMAGE.includes(e.fmt));
    imgs[0].events = ["embedded", "stripped"];
    imgs[1].events = ["embedded", "stripped", "embedded"];
  }

  let eid = 300000 + r.int(0, 50000), mid = 900 + r.int(0, 500);
  const sorted = exportsList.slice().sort((x, y) => x.abs - y.abs || cmp(x.app, y.app));
  const mRows = [];
  for (const e of sorted) {
    e.id = (eid += r.int(1, 6));
    let t = e.abs;
    for (const o of e.events) { t += r.int(1, 90); mRows.push([mid += r.int(1, 4), e.id, stamp(t), o]); }
  }

  const monthKey = (abs) => stamp(abs).slice(0, 7) + "-01";
  const share = (n, d) => Math.floor((n * 20000 + d) / (2 * d)) / 10000;
  const carries = (e, o) => {
    if (o.anyEvent) return e.events.length > 0;
    if (o.ignoreStrip) return e.events.includes("embedded");
    const kept = e.events.filter((x) => x !== "failed");
    return kept.length > 0 && kept[kept.length - 1] === "embedded";
  };
  const solve = (o = {}) => {
    const per = new Map(), all = new Map();
    for (const e of exportsList) {
      let f = e.fmt;
      if (o.noJpgAlias && e.raw.toLowerCase() === "jpg") continue;     // 'jpg' not recognised as an image format
      if (!IMAGE.includes(f)) continue;
      const rowsHere = o.joinRows ? Math.max(1, e.events.length) : 1;
      const withHere = o.joinRows ? e.events.filter((x) => x === "embedded").length : carries(e, o) ? 1 : 0;
      const k = e.app + "|" + monthKey(e.abs) + "|" + f;
      const ka = e.app + "|" + monthKey(e.abs);
      for (const [map, key] of [[per, k], [all, ka]]) {
        if (!map.has(key)) map.set(key, { n: 0, w: 0 });
        map.get(key).n += rowsHere;
        map.get(key).w += withHere;
      }
    }
    const pass = (n) => (o.strict ? n > floor : n >= floor);
    const rows = [];
    for (const [k, s] of per) {
      const [app, month, f] = k.split("|");
      if (pass(s.n)) rows.push([app, month, f, s.n, s.w, share(s.w, s.n)]);
    }
    for (const [ka, s0] of all) {
      let s = s0;
      if (o.allFromPassing) {
        s = { n: 0, w: 0 };
        for (const [k, v] of per) if (k.startsWith(ka + "|") && pass(v.n)) { s.n += v.n; s.w += v.w; }
        if (!s.n) continue;
      }
      const [app, month] = ka.split("|");
      if (pass(s.n)) rows.push([app, month, "all", s.n, s.w, share(s.w, s.n)]);
    }
    return rows.sort((x, y) => cmp(x[0], y[0]) || cmp(x[1], y[1]) || cmp(x[2], y[2]));
  };
  const rows = solve();

  const diagnostics = [
    { message: "An export with only failed manifest events was counted as carrying credentials. Only an embedded event (not later stripped) counts.", rows: solve({ anyEvent: true }) },
    { message: "The floor was applied as 'more than'. A row with exactly min_exports image exports is kept.", rows: solve({ strict: true }) },
    { message: "The 'all' row was summed only over the format rows that passed the floor. It counts every image export of the app and month, then the floor applies to it on its own.", rows: solve({ allFromPassing: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Exports were counted once per manifest event (a plain join to manifests). Reduce manifests to one state per export before joining.", rows: solve({ joinRows: true }) });
    diagnostics.push({ message: "'jpg' exports were not counted as jpeg. Normalise formats: lower-case, and 'jpg' is 'jpeg'.", rows: solve({ noJpgAlias: true }) });
  }
  if (level === 3) diagnostics.push({ message: "Stripped events were ignored. The latest non-failed event decides: embedded then stripped means no credentials.", rows: solve({ ignoreStrip: true }) });

  const eCols = ["export_id", "app", "exported_ts", "format"];
  const eRows = sorted.map((e) => [e.id, e.app, stamp(e.abs), e.raw]);
  const mCols = ["manifest_id", "export_id", "event_ts", "outcome"];
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE exports (\n  export_id BIGINT PRIMARY KEY,\n  app TEXT NOT NULL,\n  exported_ts TIMESTAMPTZ NOT NULL,\n  format TEXT NOT NULL\n);\n" +
    "CREATE TABLE manifests (\n  manifest_id BIGINT PRIMARY KEY,\n  export_id BIGINT NOT NULL REFERENCES exports(export_id),\n  event_ts TIMESTAMPTZ NOT NULL,\n  outcome TEXT NOT NULL CHECK (outcome IN ('embedded', 'failed', 'stripped'))\n);\n" +
    insertSQL("exports", eCols, eRows) + insertSQL("manifests", mCols, mRows);

  return {
    vars: {
      min_exports: floor,
      exports: eRows.length,
      events: mRows.length,
      format_rule: level === 1
        ? "In this sample every `format` is already lower-case and `jpeg` is always spelled `jpeg`."
        : "Apps spell formats differently: compare them lower-cased, and treat `jpg` as `jpeg`. Report the normalised name.",
      event_rule: level === 3
        ? "An export can have several manifest events. `failed` events never change anything; otherwise the latest event by `(event_ts, manifest_id)` decides: `embedded` means the export carries credentials, `stripped` means a later step removed them."
        : level === 2
          ? "An export can have several manifest events (retries). It carries credentials if any of them is `embedded`; `failed` events never count. (This sample has no `stripped` events.)"
          : "Each export in this sample has at most one manifest event; it carries credentials if that event is `embedded`. `failed` events never count, and this sample has no `stripped` events.",
    },
    setup,
    tables: [
      { name: "exports", columns: eCols, rows: eRows },
      { name: "manifests", columns: mCols, rows: mRows },
    ],
    expected: { columns: ["app", "month", "format", "image_exports", "with_credentials", "coverage"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
