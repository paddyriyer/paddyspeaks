/* MDB-L3-05 — Chunk ownership by hour, reconstructed from split and migration events (SQL).
   Simulated practice scenario. All data, names, thresholds and times are generated from the
   seed and are hypothetical; the threshold rule is this exercise's own.

   One row per hour in [window_start, window_end), describing the layout of one sharded
   collection at the END of the hour: every event with occurred_at strictly before the next
   hour's start is applied (an event exactly on a boundary belongs to the next hour).
     - a chunk exists from its create / split / merge row until a later row uses it as
       source_chunk_id; its owner is the shard_id of its latest create / split / merge /
       move_commit row (move_start and move_abort never change the owner);
     - active shards: added_at strictly before the end of the hour; an active shard with no
       chunks counts with 0;
     - total_chunks (each chunk once), max_chunks / min_chunks over active shards,
       imbalance = max - min, most_loaded_shard (ties to the smallest shard_id),
       needs_balancing = imbalance >= the threshold for the hour's total_chunks.
   level: 1 Medium (create, split, committed moves; a shard added before the window that stays
                    empty for the first hours; a move exactly on an hour boundary; a quiet hour)
          2 Hard (+ move_start / move_abort rows, a second collection in the export, a shard
                  added mid-window, threshold tiers by total chunks)
          3 Very Hard (+ merges: several rows for one new chunk, a shard added exactly on an
                       hour boundary, three-way splits) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const H = 3600;
const BASE = Date.UTC(2026, 8, 21) / 1000;                      // 2026-09-21 00:00 UTC
const SHARDS = ["shard_aster", "shard_birch", "shard_cedar", "shard_delta", "shard_ember", "shard_fjord", "shard_garnet"];
const NSS = ["shop.orders", "fleet.readings", "media.assets", "games.sessions", "crm.contacts", "iot.events", "travel.bookings"];

function stamp(sec) {
  const day = new Date((BASE + sec) * 1000).toISOString().slice(0, 10);
  return ts(day, ((sec % 86400) + 86400) % 86400);
}

export function generate(r, level) {
  const W0 = r.pick([7, 8, 9, 10, 11]) * H;
  const nH = level === 1 ? 5 : level === 2 ? r.int(6, 7) : r.int(7, 8);
  const W1 = W0 + nH * H;
  const S0 = W0 - r.int(1, 3) * H - r.int(0, 50) * 60;            // the collection was sharded

  // Shards: the initial ones plus one added later.
  const nInit = level === 1 ? 3 : level === 2 ? r.int(3, 4) : 4;
  const names = r.sample(SHARDS, nInit + 1);
  const late = names[nInit];
  const shards = names.slice(0, nInit).map((id) => ({ id, added: S0 - r.int(5, 60) * 86400 - r.int(0, 86399) }));
  let lateAdded, lateEligible;
  if (level === 1) {
    lateAdded = W0 - r.int(20, 90) * 60;                            // before the window, empty at first
    lateEligible = W0 + r.int(1, 2) * H + r.int(5, 40) * 60;
  } else if (level === 2) {
    lateAdded = W0 + r.int(1, nH - 3) * H + r.int(5, 50) * 60;        // mid-window
    lateEligible = lateAdded + r.int(15, 45) * 60;
  } else {
    lateAdded = W0 + r.int(1, nH - 3) * H;                          // exactly on an hour boundary
    lateEligible = lateAdded + r.int(30, 70) * 60;
  }
  shards.push({ id: late, added: lateAdded });
  shards.sort((a, b) => (a.id < b.id ? -1 : 1));

  const [ns, otherNs] = r.sample(NSS, 2);
  let cid = 1000 + r.int(0, 8000);
  const newChunk = () => "ck_" + cid++;

  // Event slots on a 7-minute grid (so one slot's migration finishes before the next starts).
  const quiet = r.int(0, nH - 1);                                   // an hour with no events in it
  let kb = r.int(1, nH - 1);
  while (kb === quiet || kb === quiet + 1) kb = r.int(1, nH - 1);
  const B = W0 + kb * H;                                            // a move committed exactly at B
  const p = level === 1 ? 0.32 : level === 2 ? 0.36 : 0.4;
  const slots = [];
  for (let t = S0 + 5 * 60; t < W1 + 40 * 60; t += 7 * 60) {
    const at = t + r.int(0, 59);
    if (Math.abs(at - B) <= 360) continue;
    if (at >= W0 + quiet * H - 360 && at < W0 + (quiet + 1) * H) continue;   // a migration started just before would end inside it
    if (r.chance(p)) slots.push({ at, forced: false });
  }
  slots.push({ at: B, forced: true });
  slots.sort((a, b) => a.at - b.at);

  const events = [];
  let seq = 0;
  const emit = (e) => events.push({ ...e, seq: seq++ });

  // Per-collection simulated state.
  const mkState = (name, primary) => ({ ns: name, primary, owner: new Map() });
  const main = mkState(ns, shards.find((s) => s.id !== late).id);
  const other = mkState(otherNs, r.pick(shards.filter((s) => s.id !== late)).id);
  const initShards = shards.filter((s) => s.id !== late).map((s) => s.id);

  const create = (st, at, n) => {
    for (let i = 0; i < n; i++) {
      const c = newChunk();
      const sh = r.chance(0.5) ? st.primary : r.pick(initShards);
      st.owner.set(c, sh);
      emit({ ns: st.ns, kind: "create", chunk: c, src: null, from: null, shard: sh, at });
    }
  };
  create(main, S0, level === 1 ? r.int(5, 6) : level === 2 ? r.int(7, 9) : r.int(9, 11));
  if (level >= 2) create(other, S0 + r.int(1, 4) * 60, r.int(3, 5));

  const activeAt = (t) => shards.filter((s) => (s.id === late ? t >= lateEligible : s.added <= t)).map((s) => s.id);
  const counts = (st, ids) => {
    const m = new Map(ids.map((id) => [id, 0]));
    for (const sh of st.owner.values()) m.set(sh, (m.get(sh) || 0) + 1);
    return m;
  };

  const doSplit = (st, at) => {
    const chunks = [...st.owner.keys()];
    const hot = chunks.filter((c) => st.owner.get(c) === st.primary);
    const c = hot.length && r.chance(0.6) ? r.pick(hot) : r.pick(chunks);
    const sh = st.owner.get(c);
    st.owner.delete(c);
    const k = level === 3 && r.chance(0.3) ? 3 : 2;
    for (let i = 0; i < k; i++) {
      const n = newChunk();
      st.owner.set(n, sh);
      emit({ ns: st.ns, kind: "split", chunk: n, src: c, from: null, shard: sh, at });
    }
  };
  const doMerge = (st, at) => {
    const by = new Map();
    for (const [c, sh] of st.owner) by.set(sh, [...(by.get(sh) || []), c]);
    const cands = [...by.entries()].filter(([, cs]) => cs.length >= 2);
    if (!cands.length) return false;
    const [sh, cs] = r.pick(cands);
    const k = cs.length >= 3 && r.chance(0.3) ? 3 : 2;
    const srcs = r.sample(cs, k);
    const n = newChunk();
    for (const c of srcs) {
      st.owner.delete(c);
      emit({ ns: st.ns, kind: "merge", chunk: n, src: c, from: null, shard: sh, at });
    }
    st.owner.set(n, sh);
    return true;
  };
  const doMove = (st, at, forced, abort = false) => {
    const act = activeAt(at);
    const cnt = counts(st, act);
    let from, to;
    if (!forced && r.chance(0.15)) {
      from = st.owner.get(r.pick([...st.owner.keys()]));
      to = r.pick(act.filter((s) => s !== from));
    } else {
      const max = Math.max(...cnt.values()), min = Math.min(...cnt.values());
      from = r.pick(act.filter((s) => cnt.get(s) === max));
      to = r.pick(act.filter((s) => s !== from && (cnt.get(s) === min || max === min)));
    }
    if (!from || !to) return false;
    const c = r.pick([...st.owner.keys()].filter((x) => st.owner.get(x) === from));
    if (level === 1) {
      emit({ ns: st.ns, kind: "move_commit", chunk: c, src: null, from, shard: to, at });
      st.owner.set(c, to);
      return true;
    }
    const start = forced ? at - r.int(20, 50) : at;
    const end = forced ? at : at + r.int(30, 300);
    emit({ ns: st.ns, kind: "move_start", chunk: c, src: null, from, shard: to, at: start });
    if (abort || (!forced && r.chance(0.3))) {
      emit({ ns: st.ns, kind: "move_abort", chunk: c, src: null, from, shard: to, at: end });
    } else {
      emit({ ns: st.ns, kind: "move_commit", chunk: c, src: null, from, shard: to, at: end });
      st.owner.set(c, to);
    }
    return true;
  };

  // Hard and up: one migration of the main collection inside the window is certainly abandoned.
  let abortSlot = null;
  if (level >= 2) {
    const free = slots.filter((s) => !s.forced && s.at >= W0 && s.at < W1 - 600);
    abortSlot = r.pick(free.length ? free : slots.filter((s) => !s.forced));
  }
  for (const s of slots) {
    if (s.forced) { doMove(main, s.at, true); continue; }
    if (s === abortSlot) { doMove(main, s.at, false, true); continue; }
    const st = level >= 2 && r.chance(0.25) ? other : main;
    const roll = r.next();
    if (level === 3 && roll < 0.15 && doMerge(st, s.at)) continue;
    if (roll < 0.45) doSplit(st, s.at);
    else doMove(st, s.at, false);
  }

  events.sort((a, b) => a.at - b.at || a.seq - b.seq);
  let eid = 70000 + r.int(0, 20000);
  for (const e of events) e.id = eid++;

  // Threshold tiers (this exercise's rule).
  let t1, t2, t3, tierA, tierB;

  // The oracle. opts break one rule each, for diagnostics.
  const hourRows = (opts = {}) => {
    const out = [];
    for (let k = 0; k < nH; k++) {
      const hs = W0 + k * H, he = hs + H;
      const before = (t) => (opts.inclusive ? t <= he : t < he);
      if (opts.onlyEventHours && !events.some((e) => e.ns === ns && e.at >= hs && e.at < he)) continue;
      const alive = new Set(), owner = new Map(), mult = new Map();
      for (const e of events) {
        if (!before(e.at)) break;
        if (e.ns !== ns && !opts.allNs) continue;
        const key = e.ns + "|" + e.chunk;
        if (e.kind === "create" || e.kind === "split" || e.kind === "merge") {
          if (e.src && !(e.kind === "split" && opts.keepParent) && !(e.kind === "merge" && opts.keepMergeSrc)) alive.delete(e.ns + "|" + e.src);
          alive.add(key);
          owner.set(key, e.shard);
          mult.set(key, (mult.get(key) || 0) + 1);
        } else if (e.kind === "move_commit" || opts.anyMove) {
          owner.set(key, e.shard);
        }
      }
      let act = shards.filter((s) => opts.allShards || before(s.added)).map((s) => s.id);
      const cnt = new Map(act.map((id) => [id, 0]));
      for (const c of alive) {
        const sh = owner.get(c);
        cnt.set(sh, (cnt.get(sh) || 0) + (opts.countRows ? mult.get(c) : 1));
      }
      if (opts.dropEmpty) act = act.filter((id) => cnt.get(id) > 0);
      const vals = act.map((id) => cnt.get(id));
      const total = vals.reduce((a, b) => a + b, 0);
      const max = Math.max(...vals), min = Math.min(...vals);
      const tops = act.filter((id) => cnt.get(id) === max).sort();
      const top = opts.tieLast ? tops[tops.length - 1] : tops[0];
      const thr = total < tierA ? t1 : total < tierB ? t2 : t3;
      const imb = max - min;
      out.push([stamp(hs), act.length, total, max, min, imb, top, opts.gt ? imb > thr : imb >= thr]);
    }
    return out;
  };

  if (level === 1) {
    t1 = t2 = t3 = r.pick([3, 4]);
    tierA = tierB = 0;
  } else {
    [t1, t2, t3] = r.pick([[2, 3, 4], [3, 4, 5], [2, 4, 6]]);
    tierA = tierB = 0;
    const totals = [...new Set(hourRows().map((x) => x[2]))].sort((a, b) => a - b);
    tierA = totals[Math.floor(totals.length / 2)] || totals[0];
    tierB = tierA + r.int(3, 6);
  }
  const expected = hourRows();

  const diagnostics = [
    { message: "A shard with no chunks was left out, so min_chunks and the imbalance are wrong while a newly added shard is still empty. Start from the active shards and LEFT JOIN the chunk counts: an empty active shard counts with 0, and it is exactly the shard the balancer is filling.", rows: hourRows({ dropEmpty: true }) },
    { message: "An event exactly on an hour boundary was applied to the hour that ends there. The layout at the end of an hour applies events strictly before the next hour starts; an event at exactly hh:00:00 belongs to the next hour.", rows: hourRows({ inclusive: true }) },
    { message: "Split chunks were still counted after the split. A split replaces its source chunk: every chunk named as source_chunk_id stops existing at that event, otherwise total_chunks only ever grows.", rows: hourRows({ keepParent: true }) },
    { message: "Hours without events are missing. The report needs one row per hour of the window; a quiet hour carries the layout forward. Generate the hours (generate_series) instead of grouping the events by hour.", rows: hourRows({ onlyEventHours: true }) },
    { message: "Ties for most_loaded_shard went to the wrong shard. When several active shards hold the most chunks, the smallest shard_id wins.", rows: hourRows({ tieLast: true }) },
    { message: "needs_balancing used a strict comparison. The rule is imbalance at least the threshold (>=).", rows: hourRows({ gt: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "move_start or move_abort rows changed the owner. A migration moves a chunk only when it commits; an abandoned migration leaves the chunk where it was. Take the owner from create, split, merge and move_commit rows only.", rows: hourRows({ anyMove: true }) },
      { message: "Chunks of other collections were counted. The changelog export holds every sharded collection in the cluster; filter on ns before counting.", rows: hourRows({ allNs: true }) },
      { message: "A shard was counted before it was added. Active shards are those with added_at strictly before the end of the hour; earlier it was not part of the cluster and cannot be the least-loaded shard.", rows: hourRows({ allShards: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push(
      { message: "A merged chunk was counted once per merge row. A merge writes one row per source chunk, all with the same new chunk_id: count distinct chunk_id.", rows: hourRows({ countRows: true }) },
      { message: "The source chunks of a merge were still counted. Every chunk named as source_chunk_id by a merge stops existing, just as with a split.", rows: hourRows({ keepMergeSrc: true }) },
    );
  }

  const eCols = ["event_id", "ns", "kind", "chunk_id", "source_chunk_id", "from_shard_id", "shard_id", "occurred_at"];
  const eRows = events.map((e) => [e.id, e.ns, e.kind, e.chunk, e.src, e.from, e.shard, stamp(e.at)]);
  const sCols = ["shard_id", "added_at"];
  const sRows = shards.map((s) => [s.id, stamp(s.added)]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE shards (\n  shard_id TEXT PRIMARY KEY,\n  added_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE chunk_events (\n  event_id BIGINT PRIMARY KEY,\n  ns TEXT NOT NULL,\n  kind TEXT NOT NULL CHECK (kind IN ('create','split','merge','move_start','move_commit','move_abort')),\n  chunk_id TEXT NOT NULL,\n  source_chunk_id TEXT,\n  from_shard_id TEXT REFERENCES shards (shard_id),\n  shard_id TEXT NOT NULL REFERENCES shards (shard_id),\n  occurred_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("shards", sCols, sRows) + insertSQL("chunk_events", eCols, eRows);

  const kinds1 = "Event kinds: `create` (a chunk made when the collection was sharded, on `shard_id`); `split` (one row per new chunk: `source_chunk_id` is the chunk that was split, which ceases to exist, and `shard_id` is the shard that owned it); `move_commit` (a migration of `chunk_id` from `from_shard_id` to `shard_id`, effective at occurred_at).";
  const kinds2 = " A migration also writes `move_start` when it begins and, if it is abandoned, `move_abort` instead of `move_commit`; neither of those changes the owner.";
  const kinds3 = " `merge` combines chunks on one shard: one row per source chunk, all with the same new `chunk_id`, occurred_at and `shard_id`; every source chunk ceases to exist.";
  const lateNote = level === 1
    ? "`" + late + "` was added shortly before the window."
    : level === 2 ? "`" + late + "` was added during the window." : "`" + late + "` was added during the window, exactly on an hour boundary.";
  return {
    vars: {
      ns: "`" + ns + "`",
      window_start: stamp(W0),
      window_end: stamp(W1),
      hours: nH,
      shard_list: shards.map((s) => "`" + s.id + "`").join(", "),
      late_note: lateNote,
      events: eRows.length,
      kinds_rule: kinds1 + (level >= 2 ? kinds2 : "") + (level === 3 ? kinds3 : ""),
      threshold_rule: level === 1
        ? `needs_balancing is true when the imbalance is at least ${t3}.`
        : `needs_balancing is true when the imbalance is at least the hour's threshold, which depends on total_chunks: ${t1} below ${tierA} chunks, ${t2} from ${tierA} to ${tierB - 1}, and ${t3} from ${tierB} chunks up.`,
      ns_rule: level === 1
        ? "The export holds only this collection's events."
        : "The export holds the changelog for every sharded collection in the cluster; count only " + "`" + ns + "`" + ".",
      ns_raw: ns,
      t1, t2, t3, tier_a: tierA, tier_b: tierB,
    },
    setup,
    tables: [
      { name: "shards", columns: sCols, rows: sRows },
      { name: "chunk_events", columns: eCols, rows: eRows },
    ],
    expected: { columns: ["hour_start", "active_shards", "total_chunks", "max_chunks", "min_chunks", "imbalance", "most_loaded_shard", "needs_balancing"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
