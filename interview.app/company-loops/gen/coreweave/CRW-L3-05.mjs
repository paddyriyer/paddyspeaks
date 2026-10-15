/* CRW-L3-05 — Delivered versus committed: GPUs ready against a contract's ramp schedule (SQL).
   Simulated practice scenario. Contracts, ramps, nodes, GPU types and every number are
   generated from the seed and are hypothetical; nothing here describes a real customer,
   contract or data centre.

   One row per (contract, calendar month) with at least one contract day inside the report
   window. Contract days are start_date..end_date inclusive, clipped to the window.
   For each contract day d (a UTC calendar date):
     committed(d)  the amendment in force on d is the contract's highest amendment_no with
                   signed_on <= d; the commitment is that amendment's latest ramp step with
                   effective_date <= d (each amendment restates the whole ramp, starting at
                   start_date);
     ready(d)      GPUs (nodes.gpus) on the contract's nodes of the contract's GPU type that
                   were ready at 00:00 UTC on d: ready_at <= d 00:00 and (released_at IS NULL
                   or released_at > d 00:00).
   Per month: committed_gpu_days = SUM committed, ready_gpu_days = SUM ready,
              shortfall_gpu_days = SUM max(committed - ready, 0)  (per day, never netted),
              short_days = number of days with ready < committed.
   level: 1 Medium (one schedule per contract; terms that start or end inside the window;
                    nodes ready or released exactly at midnight; nodes never ready; nodes
                    still running (released_at NULL); over-delivery on some days)
          2 Hard (+ amendments signed inside the window that change later steps and drop
                  old ones, one taking effect on its signing day; a node of another GPU
                  type assigned to a contract)
          3 Very Hard (+ amendments whose steps are back-dated before their signing day,
                       which do not change days before signing; several amendments per
                       contract; nodes with 4 GPUs as well as 8) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const D = 86400;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const TYPES = ["gpu_a", "gpu_b", "gpu_c", "gpu_d"];
const REGIONS = ["region_north", "region_south", "region_east", "region_west", "region_central"];

export function generate(r, level) {
  const year = 2026, m0 = r.pick([2, 3, 4, 5, 6]);                       // window starts March..July
  const W0 = Date.UTC(year, m0, 1) / 1000;
  const W = (Date.UTC(year, m0 + 3, 1) / 1000 - W0) / D;                 // days in the three-month window
  const dayStr = (d) => new Date((W0 + d * D) * 1000).toISOString().slice(0, 10);
  const stamp = (sec) => {
    const d = Math.floor(sec / D);
    return ts(dayStr(d), sec - d * D);
  };
  const NOW = (W + 3) * D;                                                 // the report runs three days after the window

  // ---- Contracts and their terms (day indices relative to the window's first day).
  const nC = level === 1 ? 3 : level === 2 ? 4 : r.int(4, 5);
  const terms = [];
  {
    const s0 = r.int(5, 40);
    terms.push({ start: s0, end: s0 + r.int(150, 400) });                 // starts inside the window
    const s1 = -r.int(40, 200);
    terms.push({ start: s1, end: r.int(40, W - 10) });                    // ends inside the window
    while (terms.length < nC) {
      const s = r.int(-120, 45);
      terms.push({ start: s, end: Math.max(s + r.int(120, 400), r.int(70, 120)) });
    }
  }
  const order = r.shuffle(terms.map((t, i) => i));
  let cid = 100 + r.int(0, 500);
  const contracts = order.map((i) => {
    cid += r.int(1, 40);
    return { id: "ctr_" + cid, type: r.pick(TYPES), region: r.pick(REGIONS), ...terms[i] };
  });
  contracts.sort((a, b) => (a.id < b.id ? -1 : 1));
  const span = (c) => [Math.max(c.start, 0), Math.min(c.end, W - 1)];

  // ---- Amendment 0: the original ramp, restated from start_date.
  const commitIn = (steps, d) => {
    let v = null;
    for (const s of steps) if (s.eff <= d) v = s.c;
    return v;
  };
  for (const c of contracts) {
    const steps = [{ eff: c.start, c: 8 * r.int(2, 5) }];
    let at = c.start, v = steps[0].c;
    const k = r.int(1, 3);
    for (let i = 0; i < k; i++) {
      at += r.int(20, 55);
      if (at > c.end - 10) break;
      v += 8 * r.int(1, 4);
      steps.push({ eff: at, c: v });
    }
    c.amends = [{ no: 0, signed: c.start - r.int(7, 45), steps }];
  }

  // ---- Later amendments (Hard and Very Hard).
  if (level >= 2) {
    const cand = contracts.filter((c) => { const [lo, hi] = span(c); return hi - lo >= 30; });
    const forced = cand.reduce((a, b) => { const la = span(a)[1] - span(a)[0], lb = span(b)[1] - span(b)[0]; return lb > la ? b : a; });
    let backForced = false, sameDayForced = false;
    for (const c of cand) {
      if (c !== forced && !r.chance(0.4)) continue;
      const [lo, hi] = span(c);
      const n = level === 3 && r.chance(0.5) ? 2 : 1;
      let sMin = lo + 10;
      for (let j = 0; j < n && sMin <= hi - 8; j++) {
        const s = r.int(sMin, Math.min(hi - 8, sMin + (n === 2 && j === 0 ? 25 : 60)));
        const prev = c.amends[c.amends.length - 1].steps;
        let e;
        if (level === 3 && (!backForced || r.chance(0.5))) {
          e = s - r.int(3, Math.min(15, s - c.start - 1));               // back-dated before signing
          backForced = true;
        } else if (!sameDayForced || r.chance(0.3)) {
          e = s;                                                          // takes effect on its signing day
          sameDayForced = true;
        } else e = s + r.int(1, 7);
        const old = commitIn(prev, e);
        let v = old + 8 * r.pick([-2, -1, 1, 2, 3]);
        if (v < 8) v = old + 8;
        const steps = prev.filter((st) => st.eff < e).map((st) => ({ ...st }));
        steps.push({ eff: e, c: v });
        if (r.chance(0.6) && e + 15 < c.end) steps.push({ eff: e + r.int(15, Math.min(40, c.end - e)), c: v + 8 * r.int(1, 3) });
        c.amends.push({ no: c.amends.length, signed: s, steps });
        sMin = s + 4;
      }
    }
  }

  // The oracle's commitment rules; opts break one rule each, for diagnostics.
  const commitOn = (c, d, opts = {}) => {
    let a;
    if (opts.latestAll) a = c.amends[c.amends.length - 1];
    else if (opts.firstOnly) a = c.amends[0];
    else if (opts.mixed) {
      let best = null;
      for (const am of c.amends) for (const s of am.steps) if (s.eff <= d && (!best || s.eff >= best.eff)) best = s;
      return best ? best.c : 0;
    } else {
      const inForce = c.amends.filter((am) => (opts.signedStrict ? am.signed < d : am.signed <= d));
      a = inForce[inForce.length - 1];
    }
    if (!a) return 0;
    return commitIn(a.steps, d) ?? 0;
  };

  // ---- Nodes: delivered toward the schedule in force, late, early, failed and replaced.
  const nodes = [];
  const gpusFor = () => (level === 3 && r.chance(0.3) ? 4 : 8);
  const add = (c, ready, release, extra = {}) => {
    const n = { c, type: c.type, gpus: gpusFor(), ready, release, ...extra };
    nodes.push(n);
    return n;
  };
  for (const c of contracts) {
    const live = [];
    let prevT = 0;
    for (let d = c.start; d <= c.end; d++) {
      const t = commitOn(c, d);
      if (t === prevT) continue;
      if (t > prevT) {
        let need = t - prevT;
        while (need > 0) {
          const delay = r.chance(0.18) ? r.int(10, 30) : r.int(-3, 7);
          const n = add(c, (d + delay) * D + r.int(0, D - 1), Infinity);
          if (n.gpus > need) n.gpus = need;
          need -= n.gpus;
          live.push(n);
        }
      } else {
        let drop = prevT - t;
        const open = live.filter((n) => n.release === Infinity).sort((a, b) => b.ready - a.ready);
        for (const n of open) {
          if (drop <= 0) break;
          const at = (d + r.int(0, 3)) * D + r.int(0, D - 1);
          if (n.ready >= at) { n.never = at - r.int(1, 6) * 3600; n.release = n.never; n.ready = null; }
          else n.release = at;
          drop -= n.gpus;
        }
      }
      prevT = t;
    }
    // Failures, each followed by a replacement a few days later.
    for (const n of live.slice()) {
      if (n.ready === null || !r.chance(0.22)) continue;
      const f = n.ready + r.int(1, 50) * D + r.int(0, D - 1);
      if (f >= n.release) continue;
      const until = n.release;
      n.release = f;
      const rep = f + r.int(1, 5) * D + r.int(0, D - 1);
      if (rep < until) live.push(add(c, rep, until));
    }
    // A short over-delivery, and a node that was requested but never became ready.
    if (r.chance(0.5)) {
      const x = r.int(c.start, c.end - 12);
      const at = x * D + r.int(0, D - 1);
      live.push(add(c, at, at + r.int(2, 10) * D + r.int(0, D - 1)));
    }
    if (r.chance(0.4)) {
      const x = r.int(Math.max(c.start, -20), Math.min(c.end, W + 2));
      add(c, null, x * D + r.int(0, D - 1));
    }
    // End of term: nodes are released around the end date (sometimes a little early).
    for (const n of live) {
      if (n.release !== Infinity) continue;
      n.release = (c.end + 1 + r.int(-2, 2)) * D + r.int(0, D - 1);
      if (n.release <= n.ready) n.release = n.ready + r.int(1, 3) * D;
    }
  }

  // ---- Forced edge cases inside the window.
  const inWin = contracts.filter((c) => { const [lo, hi] = span(c); return hi - lo >= 6; });
  const cA = r.pick(inWin);
  {
    const [lo, hi] = span(cA);
    const x = r.int(lo + 1, hi - 1);
    add(cA, x * D, (x + r.int(3, 15)) * D + r.int(1, D - 1));             // ready exactly at 00:00: counts that day
  }
  {
    const others = inWin.filter((c) => c !== cA);
    const cB = others.length ? r.pick(others) : cA;
    const [lo, hi] = span(cB);
    const y = r.int(lo + 1, hi - 1);
    add(cB, (y - r.int(2, 10)) * D + r.int(0, D - 1), y * D);             // released exactly at 00:00: not that day
  }
  {
    const c = r.pick(inWin);
    const [lo, hi] = span(c);
    add(c, null, r.int(lo, hi) * D + r.int(0, D - 1));                     // requested, cancelled, never ready
  }
  if (level >= 2) {
    const c = r.pick(inWin);
    const [lo, hi] = span(c);
    const x = r.int(lo, hi - 3);
    add(c, x * D + r.int(0, D - 1), (x + r.int(3, 20)) * D + r.int(0, D - 1), { type: r.pick(TYPES.filter((t) => t !== c.type)) });
  }

  // Report time: anything not yet ready is still provisioning; anything not yet released is running.
  for (const n of nodes) {
    if (n.ready !== null && n.ready > NOW) { n.never = NOW - r.int(1, 20) * 3600; n.ready = null; n.release = null; }
    else if (n.release !== null && n.release > NOW) n.release = null;
    if (n.ready !== null) n.req = n.ready - r.int(1, 36) * 3600 - r.int(0, 3599);
    else n.req = (n.release ?? n.never) - r.int(1, 30) * 3600 - r.int(0, 3599);
  }
  nodes.sort((a, b) => a.req - b.req);
  let nid = 1000 + r.int(0, 4000);
  for (const n of nodes) n.id = "nd_" + nid++;

  // ---- The oracle.
  const compute = (opts = {}) => {
    const out = [];
    for (const c of contracts) {
      let [lo, hi] = span(c);
      if (opts.ignoreTerm) { lo = 0; hi = W - 1; }
      const months = new Map();
      for (let d = lo; d <= hi; d++) {
        const com = commitOn(c, d, opts);
        const S = d * D;
        let rd = 0;
        for (const n of nodes) {
          if (n.c !== c || n.ready === null) continue;
          if (!opts.anyType && n.type !== c.type) continue;
          let on;
          if (opts.strict) on = n.ready < S && (n.release === null || n.release >= S);
          else if (opts.anyTime) on = n.ready < S + D && (n.release === null || n.release > S);
          else on = n.ready <= S && (n.release === null || n.release > S);
          if (on) rd += opts.eight ? 8 : n.gpus;
        }
        const key = dayStr(d).slice(0, 7);
        if (!months.has(key)) months.set(key, { com: 0, rd: 0, short: 0, days: 0 });
        const m = months.get(key);
        m.com += com; m.rd += rd;
        m.short += Math.max(com - rd, 0);
        if (rd < com) m.days++;
      }
      for (const [key, m] of [...months].sort()) {
        out.push([c.id, key, m.com, m.rd, opts.net ? Math.max(m.com - m.rd, 0) : m.short, m.days]);
      }
    }
    return out;
  };
  const expected = compute();

  const diagnostics = [
    { message: "Shortfall was netted over the month. A day with more GPUs ready than committed does not make up for a day with fewer: take max(committed − ready, 0) for each day, then sum.", rows: compute({ net: true }) },
    { message: "A midnight boundary went the wrong way. A node ready at exactly 00:00 counts on that day (ready_at <= the day's midnight), and a node released at exactly 00:00 does not (released_at > the day's midnight).", rows: compute({ strict: true }) },
    { message: "Nodes were counted if they were ready at any time during the day. This exercise measures each day at 00:00 UTC: a node that becomes ready at 14:00 counts from the next day.", rows: compute({ anyTime: true }) },
    { message: "Days outside the contract's term were counted. Only start_date through end_date (inclusive) are contract days; after end_date nothing is committed, even though the last ramp step would otherwise carry on.", rows: compute({ ignoreTerm: true }) },
    { message: "Nodes of another GPU type were counted. Only nodes of the contract's gpu_type deliver against its commitment.", rows: compute({ anyType: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "Amendments were ignored: every day used amendment 0. From its signed_on date, a later amendment replaces the whole ramp.", rows: compute({ firstOnly: true }) },
      { message: "Ramp steps from different amendments were mixed. The commitment comes from the steps of the one amendment in force that day; a step that a later amendment dropped no longer applies.", rows: compute({ mixed: true }) },
      { message: "An amendment was applied only from the day after it was signed. It is in force from signed_on itself (signed_on <= the day).", rows: compute({ signedStrict: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push(
      { message: "The latest amendment was applied to every day of the term. An amendment changes the commitment only from its signed_on date; days before it keep the amendment in force then, even when the new ramp's steps carry earlier effective dates.", rows: compute({ latestAll: true }) },
      { message: "Every node was counted as 8 GPUs. Nodes carry their own GPU count in nodes.gpus; sum it instead of counting nodes.", rows: compute({ eight: true }) },
    );
  }

  // ---- Tables.
  const day = (d) => dayStr(d);
  const cCols = ["contract_id", "gpu_type", "region", "start_date", "end_date"];
  const cRows = contracts.map((c) => [c.id, c.type, c.region, day(c.start), day(c.end)]);
  const aCols = ["contract_id", "amendment_no", "signed_on"];
  const aRows = contracts.flatMap((c) => c.amends.map((a) => [c.id, a.no, day(a.signed)]));
  const sCols = ["contract_id", "amendment_no", "effective_date", "committed_gpus"];
  const sRows = contracts.flatMap((c) => c.amends.flatMap((a) => a.steps.map((s) => [c.id, a.no, day(s.eff), s.c])));
  const nCols = ["node_id", "contract_id", "gpu_type", "gpus", "requested_at", "ready_at", "released_at"];
  const nRows = nodes.map((n) => [n.id, n.c.id, n.type, n.gpus, stamp(n.req), n.ready === null ? null : stamp(n.ready), n.release === null ? null : stamp(n.release)]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE contracts (\n  contract_id TEXT PRIMARY KEY,\n  gpu_type TEXT NOT NULL,\n  region TEXT NOT NULL,\n  start_date DATE NOT NULL,\n  end_date DATE NOT NULL\n);\n" +
    "CREATE TABLE contract_amendments (\n  contract_id TEXT NOT NULL REFERENCES contracts (contract_id),\n  amendment_no INT NOT NULL,\n  signed_on DATE NOT NULL,\n  PRIMARY KEY (contract_id, amendment_no)\n);\n" +
    "CREATE TABLE ramp_steps (\n  contract_id TEXT NOT NULL,\n  amendment_no INT NOT NULL,\n  effective_date DATE NOT NULL,\n  committed_gpus INT NOT NULL CHECK (committed_gpus > 0),\n  PRIMARY KEY (contract_id, amendment_no, effective_date),\n  FOREIGN KEY (contract_id, amendment_no) REFERENCES contract_amendments (contract_id, amendment_no)\n);\n" +
    "CREATE TABLE nodes (\n  node_id TEXT PRIMARY KEY,\n  contract_id TEXT NOT NULL REFERENCES contracts (contract_id),\n  gpu_type TEXT NOT NULL,\n  gpus INT NOT NULL,\n  requested_at TIMESTAMPTZ NOT NULL,\n  ready_at TIMESTAMPTZ,\n  released_at TIMESTAMPTZ\n);\n" +
    insertSQL("contracts", cCols, cRows) + insertSQL("contract_amendments", aCols, aRows) +
    insertSQL("ramp_steps", sCols, sRows) + insertSQL("nodes", nCols, nRows);

  const amended = contracts.filter((c) => c.amends.length > 1).length;
  return {
    vars: {
      from_date: day(0),
      to_date: day(W - 1),
      window_label: `${MONTHS[m0]} to ${MONTHS[m0 + 2]} ${year}`,
      contracts: contracts.length,
      node_rows: nRows.length,
      step_rows: sRows.length,
      amend_note: level === 1
        ? "In this sample every contract still has only its original amendment 0."
        : `In this sample ${amended === 1 ? "one contract has" : amended + " contracts have"} later amendments.`,
    },
    setup,
    tables: [
      { name: "contracts", columns: cCols, rows: cRows },
      { name: "contract_amendments", columns: aCols, rows: aRows },
      { name: "ramp_steps", columns: sCols, rows: sRows },
      { name: "nodes", columns: nCols, rows: nRows },
    ],
    expected: { columns: ["contract_id", "month", "committed_gpu_days", "ready_gpu_days", "shortfall_gpu_days", "short_days"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
