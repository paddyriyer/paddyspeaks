/* MET-L3-05 — Creator audience insights with a k-anonymity threshold and deletion (SQL).
   Simulated practice scenario. All accounts, reels, views and thresholds are generated
   from the seed and are hypothetical.

   One deterministic result set for one reporting week [start, end):
     per creator, one row per age band with at least one eligible viewer, holding the
     number of distinct eligible viewers whose age band IN EFFECT AT `end` is that band,
     plus one row with age_band 'all' holding the creator's distinct eligible viewers.
   Eligible view: in the half-open week, not a self-view, viewer not deleted, creator not
   deleted. Privacy rules: a band cell below k is published as NULL; if exactly one band
   cell of a creator is below k, the smallest remaining band cell (ties: first age_band)
   is also NULL (complementary suppression, so 'all' minus the others cannot reveal it);
   a creator whose 'all' is below k is left out entirely.
   level: 1 Medium (one band row per account, complementary suppression, deleted viewers,
                    week boundaries, self-views, repeat views)
          2 Hard (+ a deleted creator, a creator below k overall, a tie for the
                  complementary cell, two small cells with no complement)
          3 Very Hard (+ age-band history: birthdays before the week end, exactly at it,
                       and after it) */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const D = 86400, H = 3600, W = 7 * D;
const WEEKS = ["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"];   // Mondays
const BANDS = ["13-17", "18-24", "25-34", "35-44", "45-54", "55+"];
const POOL = 12;                                                    // eligible viewers per band

export function generate(r, level) {
  const startDay = r.pick(WEEKS);
  const baseMs = Date.parse(startDay + "T00:00:00Z");
  const stamp = (sec) => new Date(baseMs + sec * 1000).toISOString().slice(0, 19).replace("T", " ") + "+00";
  const k = level === 1 ? r.pick([3, 4]) : level === 2 ? r.pick([4, 5]) : r.pick([4, 5, 6]);

  const used = new Set();
  const newId = (prefix, digits) => {
    for (;;) {
      const id = prefix + String(r.int(0, 10 ** digits - 1)).padStart(digits, "0");
      if (!used.has(id)) { used.add(id); return id; }
    }
  };

  // Accounts: a pool of eligible viewers per band (band = the band in effect at `end`).
  const accounts = [];                                              // {id, type, deleted}
  const hist = new Map();                                           // id -> [{band, from}]
  const addAccount = (type, band) => {
    const id = type === "creator" ? newId("cr_", 4) : newId("u", 5);
    accounts.push({ id, type, deleted: null });
    hist.set(id, [{ band, from: -r.int(200, 900) * D + r.int(0, D - 1) }]);
    return id;
  };
  const pool = {};
  for (const b of BANDS) pool[b] = Array.from({ length: POOL }, () => addAccount("personal", b));

  // Creators and their audience targets (distinct eligible viewers per band).
  const small = () => r.int(1, k - 1);
  const big = () => r.int(k, k + 3);
  const targetsFor = (type) => {
    const bs = r.shuffle(BANDS);
    const t = {};
    if (type === "A") {                                             // exactly one small cell
      t[bs[0]] = small();
      for (let i = 1; i <= r.int(2, 3); i++) t[bs[i]] = big();
    } else if (type === "B") {                                      // two small cells: no complement
      t[bs[0]] = small(); t[bs[1]] = small();
      for (let i = 2; i <= r.int(2, 3); i++) t[bs[i]] = big();
    } else if (type === "C") {                                      // all published, one exactly k
      t[bs[0]] = k;
      for (let i = 1; i <= r.int(1, 2); i++) t[bs[i]] = big();
    } else if (type === "D") {                                      // below k overall
      const a = r.int(1, k - 2);
      t[bs[0]] = a;
      if (r.chance(0.5)) t[bs[1]] = r.int(1, k - 1 - a);
    } else {                                                        // "E": complement tie
      const c = r.int(k, k + 2);
      t[bs[0]] = small(); t[bs[1]] = c; t[bs[2]] = c;
      if (r.chance(0.5)) t[bs[3]] = c + r.int(1, 3);
    }
    return t;
  };
  const types = level === 1 ? r.shuffle(["A", "C", r.pick(["A", "B"])])
    : level === 2 ? r.shuffle(["E", "B", "D", "C"])
    : r.shuffle(["E", "A", "B", "D", "C"]);
  const creators = types.map((type) => ({ id: addAccount("creator", r.pick(BANDS.slice(1))), type, deleted: false, targets: targetsFor(type) }));
  if (level >= 2) creators.push({ id: addAccount("creator", r.pick(BANDS.slice(1))), type: "C", deleted: true, targets: targetsFor("C") });

  // Reels and views.
  const reels = [], views = [];
  const reelsOf = new Map();
  for (const c of creators) {
    const mine = [];
    for (let i = 0; i < r.int(2, 3); i++) {
      const reel = { id: newId("rl_", 6), creator: c.id, posted: -r.int(1, 12) * D - r.int(0, D - 1) };
      reels.push(reel); mine.push(reel);
    }
    reelsOf.set(c.id, mine);
  }
  const view = (c, viewer, t) => views.push({ reel: r.pick(reelsOf.get(c.id)).id, viewer, t, watch: r.int(400, 45000) });
  const inWeek = () => r.int(0, W - 1);
  const chosenAll = [];                                             // [creator, viewer, band]
  creators.forEach((c, ci) => {
    const chosenHere = new Set();
    let first = null;
    for (const [b, n] of Object.entries(c.targets)) {
      for (const v of r.sample(pool[b], n)) {
        chosenHere.add(v);
        chosenAll.push([c, v, b]);
        if (first === null) { first = v; view(c, v, 0); continue; }   // only view exactly at start
        for (let m = r.int(1, 3); m > 0; m--) view(c, v, inWeek());  // repeat views
        if (r.chance(0.15)) view(c, v, -r.int(1, 5 * D));           // plus one before the week
      }
    }
    const outsiders = BANDS.flatMap((b) => pool[b]).filter((v) => !chosenHere.has(v));
    const [atEnd, before, after] = r.sample(outsiders, 3);
    view(c, atEnd, W);                                              // exactly at end: excluded
    view(c, before, -r.int(60, 3 * D));                              // before the week
    view(c, after, W + r.int(60, 2 * D));                            // after the week
    for (let m = r.int(1, 2); m > 0; m--) view(c, c.id, inWeek());  // self-views
    if (ci === 0 || r.chance(0.5)) view(c, r.pick(outsiders), -1);   // one second before the start
  });

  // Deleted viewers: their views (all from before the deletion) leave the report.
  const nDeleted = level === 1 ? r.int(2, 3) : r.int(3, 4);
  for (let i = 0; i < nDeleted; i++) {
    const id = addAccount("personal", r.pick(BANDS));
    let last = 0;
    for (const c of r.sample(creators, r.int(1, 2))) {
      const t = inWeek();
      view(c, id, t);
      last = Math.max(last, t);
    }
    accounts.find((a) => a.id === id).deleted = last + r.int(H, 4 * D);
  }
  for (const c of creators) if (c.deleted) accounts.find((a) => a.id === c.id).deleted = r.int(D, W + 2 * D);

  // Age-band history (Very Hard): birthdays before the end, exactly at it, and after it.
  if (level === 3) {
    const idx = (b) => BANDS.indexOf(b);
    const touched = new Set();
    const setChangeBefore = (v, b, from) => {                      // older band, then b from `from`
      hist.set(v, [{ band: BANDS[idx(b) - 1], from: -r.int(300, 900) * D }, { band: b, from }]);
      touched.add(v);
    };
    const setChangeAfter = (v, b) => {                              // b, then the next band after the week
      hist.get(v).push({ band: BANDS[idx(b) + 1], from: W + r.int(1, 20 * D) });
      touched.add(v);
    };
    const live = chosenAll.filter(([c]) => !c.deleted);
    const atEndPick = r.pick(live.filter(([, , b]) => idx(b) > 0));
    setChangeBefore(atEndPick[1], atEndPick[2], W);                 // takes effect exactly at `end`
    const afterPick = r.pick(live.filter(([c, v, b]) => idx(b) < BANDS.length - 1 && !touched.has(v) && c.targets[b] >= k));
    if (afterPick) setChangeAfter(afterPick[1], afterPick[2]);
    for (const b of BANDS) {
      for (const v of pool[b]) {
        if (touched.has(v)) continue;
        const roll = r.next();
        if (roll < 0.2 && idx(b) > 0) setChangeBefore(v, b, r.int(-60 * D, W - 1));
        else if (roll < 0.4 && idx(b) < BANDS.length - 1) setChangeAfter(v, b);
      }
    }
  }

  // Ids and rows.
  views.sort((a, b) => a.t - b.t || (a.viewer < b.viewer ? -1 : a.viewer > b.viewer ? 1 : 0));
  let vid = 100000 + r.int(0, 800000);
  views.forEach((v) => (v.id = vid++));
  const creatorOf = new Map(reels.map((x) => [x.id, x.creator]));
  const deletedAt = new Map(accounts.filter((a) => a.deleted !== null).map((a) => [a.id, a.deleted]));

  // The oracle, from the tables alone. opts break one rule each, for diagnostics.
  const compute = (opts = {}) => {
    const inWin = (t) => (opts.endInclusive ? t <= W : t < W) && (opts.startExclusive ? t > 0 : t >= 0);
    const bandAtEnd = (id) => {
      const rows = hist.get(id).slice().sort((a, b) => a.from - b.from);
      if (opts.currentBand) return rows[rows.length - 1].band;
      const ok = rows.filter((x) => (opts.strictBand ? x.from < W : x.from <= W));
      return ok.length ? ok[ok.length - 1].band : null;
    };
    const publish = (n) => (opts.strictK ? n > k : n >= k);
    const per = new Map();                                          // creator -> Map(viewer -> views)
    for (const v of views) {
      const c = creatorOf.get(v.reel);
      if (!inWin(v.t)) continue;
      if (v.viewer === c && !opts.selfViews) continue;
      if (deletedAt.has(v.viewer) && !opts.keepDeleted) continue;
      if (deletedAt.has(c) && !opts.keepDeletedCreator) continue;
      if (!per.has(c)) per.set(c, new Map());
      const m = per.get(c);
      m.set(v.viewer, (m.get(v.viewer) || 0) + 1);
    }
    const out = [];
    for (const [c, m] of per) {
      const cells = new Map();
      let total = 0;
      for (const [viewer, n] of m) {
        const b = bandAtEnd(viewer);
        const add = opts.countViews ? n : 1;
        cells.set(b, (cells.get(b) || 0) + add);
        total += add;
      }
      if (!publish(total) && !opts.keepTiny) continue;
      const bands = [...cells.keys()].sort();
      const hidden = new Set(bands.filter((b) => !publish(cells.get(b))));
      if (hidden.size === 1 && !opts.noComplement) {
        const rest = bands.filter((b) => !hidden.has(b))
          .sort((a, b) => cells.get(a) - cells.get(b) || (opts.tieLast ? (a < b ? 1 : -1) : (a < b ? -1 : 1)));
        if (rest.length) hidden.add(rest[0]);
      }
      for (const b of bands) out.push([c, b, hidden.has(b) ? null : cells.get(b)]);
      out.push([c, "all", total]);
    }
    return out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  };
  const rows = compute();

  const diagnostics = [
    { message: "Views were counted instead of viewers. A viewer who watched several reels, or one reel several times, is one distinct viewer: COUNT(DISTINCT viewer_id) per creator and band.", rows: compute({ countViews: true }) },
    { message: "Self-views were counted. A creator watching their own reel is not part of their audience.", rows: compute({ selfViews: true }) },
    { message: "Views by deleted accounts were counted. Deletion propagates to every derived number: all of a deleted account's views leave the report, including those from before the deletion, even though the raw log has not been purged yet.", rows: compute({ keepDeleted: true }) },
    { message: "The threshold is inclusive: a cell with exactly k viewers is published. Suppress only counts below k.", rows: compute({ strictK: true }) },
    { message: "The week is half-open: a view exactly at the end time belongs to the next week.", rows: compute({ endInclusive: true }) },
    { message: "The week starts inclusively: a view exactly at the start time belongs to this week.", rows: compute({ startExclusive: true }) },
    { message: "Complementary suppression is missing. When exactly one band cell is suppressed, 'all' minus the published cells reveals it, so the smallest other band cell must be suppressed too.", rows: compute({ noComplement: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "A deleted creator was reported. Deletion removes the creator's insights as well as their audience's.", rows: compute({ keepDeletedCreator: true }) },
      { message: "A creator below k overall was reported. When the 'all' row would be below k, leave the creator out entirely: the total itself identifies too few people.", rows: compute({ keepTiny: true }) },
      { message: "The complementary cell was chosen with the wrong tie-break. Among equal smallest cells, suppress the first age_band in order.", rows: compute({ tieLast: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push(
      { message: "The current age band was used. A birthday after the week moved some viewers since; use the band in effect at the end time (the latest valid_from at or before it).", rows: compute({ currentBand: true }) },
      { message: "A band that takes effect exactly at the end time was ignored. In effect at T means valid_from ≤ T.", rows: compute({ strictBand: true }) },
    );
  }

  const aCols = ["account_id", "account_type", "deleted_at"];
  const hCols = ["account_id", "age_band", "valid_from"];
  const rCols = ["reel_id", "creator_id", "posted_at"];
  const vCols = ["view_id", "reel_id", "viewer_id", "viewed_at", "watch_ms"];
  const sortedAccounts = accounts.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
  const aRows = sortedAccounts.map((a) => [a.id, a.type, a.deleted === null ? null : stamp(a.deleted)]);
  const hRows = sortedAccounts.flatMap((a) => hist.get(a.id).slice().sort((x, y) => x.from - y.from).map((x) => [a.id, x.band, stamp(x.from)]));
  const rRows = reels.slice().sort((a, b) => (a.id < b.id ? -1 : 1)).map((x) => [x.id, x.creator, stamp(x.posted)]);
  const vRows = views.map((v) => [v.id, v.reel, v.viewer, stamp(v.t), v.watch]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE accounts (\n  account_id TEXT PRIMARY KEY,\n  account_type TEXT NOT NULL CHECK (account_type IN ('personal','creator')),\n  deleted_at TIMESTAMPTZ\n);\n" +
    "CREATE TABLE age_band_history (\n  account_id TEXT NOT NULL REFERENCES accounts (account_id),\n  age_band TEXT NOT NULL,\n  valid_from TIMESTAMPTZ NOT NULL,\n  PRIMARY KEY (account_id, valid_from)\n);\n" +
    "CREATE TABLE reels (\n  reel_id TEXT PRIMARY KEY,\n  creator_id TEXT NOT NULL REFERENCES accounts (account_id),\n  posted_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE reel_views (\n  view_id BIGINT PRIMARY KEY,\n  reel_id TEXT NOT NULL REFERENCES reels (reel_id),\n  viewer_id TEXT NOT NULL REFERENCES accounts (account_id),\n  viewed_at TIMESTAMPTZ NOT NULL,\n  watch_ms INTEGER NOT NULL\n);\n" +
    insertSQL("accounts", aCols, aRows) + insertSQL("age_band_history", hCols, hRows) +
    insertSQL("reels", rCols, rRows) + insertSQL("reel_views", vCols, vRows);

  return {
    vars: {
      start: stamp(0),
      end: stamp(W),
      k,
      views: vRows.length,
      accounts: aRows.length,
      band_note: level === 3
        ? "Bands change on birthdays: an account can have several rows, and a row can take effect during the week, exactly at its end, or after it."
        : "In this extract every account has exactly one band row.",
    },
    setup,
    tables: [
      { name: "accounts", columns: aCols, rows: aRows },
      { name: "age_band_history", columns: hCols, rows: hRows },
      { name: "reels", columns: rCols, rows: rRows },
      { name: "reel_views", columns: vCols, rows: vRows },
    ],
    expected: { columns: ["creator_id", "age_band", "viewers"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}
