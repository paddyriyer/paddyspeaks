/* ADB-L3-05 — Agreements waiting on a signer: the current pending signer and hours waited,
   delegations followed (SQL).
   Simulated practice scenario. All data, identifiers and times are generated from the seed
   and are hypothetical. Only agreement metadata and events appear: no document contents,
   no field values, no names or email addresses.

   As of one instant T, one row per signer slot an open sequential agreement is waiting on:
     agreement_id, current_step   the lowest step with an unsigned signer slot;
     assigned_to                  the participant named in the slot;
     pending_with                 the slot's holder at T after following every delegation at or before T;
     hours_waiting                hours from the moment the agreement reached the current step
                                  (the last signature at a lower step, or sent_at) to T, 2 decimals.
   level: 1 Medium (sequential and parallel agreements, drafts, a status column written after T,
                    signatures and cancellations exactly at T, single delegations before and after T,
                    declines)
          2 Hard (+ expiry incl. exactly at T, cc rows and cc-only steps, delegation chains of two
                  hops incl. a second hop after T, a decline after T)
          3 Very Hard (+ steps naming several signers, one of them already signed; step numbers
                       with gaps) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const MIN = 60;
const BASE = Date.UTC(2026, 8, 7) / 1000;                       // 2026-09-07 00:00 UTC

function stamp(sec) {
  const day = new Date((BASE + sec) * 1000).toISOString().slice(0, 10);
  return ts(day, ((sec % 86400) + 86400) % 86400);
}

export function generate(r, level) {
  const T = 6 * 86400 + r.pick([9, 11, 14, 16]) * 3600 + r.pick([0, 20, 45]) * MIN;
  const E = T + 14 * 86400 + r.pick([0, 6]) * 3600;               // when the extract was taken
  let pid = 100 + r.int(0, 500);
  const newP = () => "p_" + (pid += r.int(1, 9));

  /* A relative timeline (minutes after sending) for one agreement. */
  function build(spec) {
    const parts = [], ev = [], slots = [], start = [];
    let c = 0, end = 0;
    const push = (rel, p, action, to = null) => { ev.push({ rel, pid: p, action, to }); end = Math.max(end, rel); };
    spec.steps.forEach((st, si) => {
      const ids = [];
      for (let j = 0; j < st.signers; j++) { const p = newP(); parts.push({ pid: p, step: st.no, role: "signer" }); ids.push(p); }
      for (let j = 0; j < st.cc; j++) parts.push({ pid: newP(), step: st.no, role: "cc" });
      start.push(c);
      if (spec.stop && si > spec.stop.at) return;
      if (st.signers === 0) return;
      let done = c;
      ids.forEach((p, j) => {
        const s = { si, j, assigned: p, c, hops: [], sign: null, decline: null };
        let t = c, holder = p;
        const k = spec.hops(si, j);
        for (let h = 0; h < k; h++) {
          t += r.int(5, 900);
          const to = newP();
          push(t, holder, "delegated", to);
          s.hops.push(t);
          holder = to;
        }
        const first = s.hops.length ? s.hops[0] : null;
        const stall = spec.stop && si === spec.stop.at && j >= spec.stop.signed;
        if (!stall) { t += r.int(10, 2400); push(t, holder, "signed"); s.sign = t; done = Math.max(done, t); }
        else if (spec.stop.decline && j === spec.stop.signed) { t += r.int(10, 2400); push(t, holder, "declined"); s.decline = t; }
        const firstAct = first ?? s.sign ?? s.decline ?? c + 3000;
        if (firstAct - c >= 2 && r.chance(0.5)) push(c + r.int(1, firstAct - c - 1), p, "viewed");
        const last = s.hops.length ? s.hops[s.hops.length - 1] : c;
        const until = s.sign ?? s.decline ?? last + 3000;
        if (until - last >= 2 && r.chance(0.4)) push(last + r.int(1, until - last - 1), holder, "reminded");
        slots.push(s);
      });
      c = done;
    });
    return { order: spec.order, parts, ev, slots, start, end };
  }

  const one = (n) => Array.from({ length: n }, (_, i) => ({ no: i + 1, signers: 1, cc: 0 }));
  const noHops = () => 0;
  const agreements = [];
  /* Place a timeline so that relative minute `anchor` is the as-of time T. */
  function place(tl, anchor, extra = {}) {
    if (extra.draft) {
      agreements.push({ order: tl.order, sent: null, expires: null, cancelled: null, status: "draft", parts: tl.parts, ev: [] });
      return;
    }
    const sent = T - anchor * MIN;
    const abs = (rel) => sent + rel * MIN;
    const cancelAbs = extra.cancel != null ? abs(extra.cancel) : null;
    const expires = extra.expires != null ? abs(extra.expires) : null;
    const ev = tl.ev.map((e) => ({ ...e, t: abs(e.rel) }))
      .filter((e) => (cancelAbs === null || e.t < cancelAbs) && (expires === null || e.t < expires) && e.t <= E);
    const cancelled = cancelAbs !== null && cancelAbs <= E ? cancelAbs : null;
    const signers = tl.parts.filter((p) => p.role === "signer").length;
    const status = cancelled !== null ? "cancelled"
      : ev.some((e) => e.action === "declined") ? "declined"
      : ev.filter((e) => e.action === "signed").length === signers ? "completed"
      : expires !== null && expires <= E ? "expired" : "in_progress";
    agreements.push({ order: tl.order, sent, expires, cancelled, status, parts: tl.parts, ev });
  }

  /* ---- Forced cases (every level). ---- */
  {   // waiting on step 1 since it was sent
    const tl = build({ order: "sequential", steps: one(r.int(2, 3)), hops: noHops, stop: { at: 0, signed: 0 } });
    place(tl, r.int(60, 3000));
  }
  {   // step 1 signed exactly at T: step 2 is current with 0 hours waited; completed later
    const tl = build({ order: "sequential", steps: one(r.int(2, 3)), hops: noHops, stop: null });
    place(tl, tl.start[1]);
  }
  {   // delegated before T, signed by the delegate after T
    const n = r.int(2, 3), at = r.int(0, n - 1);
    const tl = build({ order: "sequential", steps: one(n), hops: (si) => (si === at ? 1 : 0), stop: null });
    const s = tl.slots.find((x) => x.si === at);
    place(tl, s.hops[0] + Math.max(1, Math.floor((s.sign - s.hops[0]) / 2)));
  }
  {   // delegation after T: still pending with the assigned signer
    const n = r.int(2, 3), at = r.int(0, n - 1);
    const tl = build({ order: "sequential", steps: one(n), hops: (si) => (si === at ? 1 : 0), stop: { at, signed: 0 } });
    const s = tl.slots.find((x) => x.si === at);
    place(tl, s.c + Math.max(1, Math.floor((s.hops[0] - s.c) / 2)));
  }
  {   // cancelled exactly at T
    const tl = build({ order: "sequential", steps: one(2), hops: noHops, stop: { at: r.int(0, 1), signed: 0 } });
    const a = tl.start[tl.slots[tl.slots.length - 1].si] + r.int(30, 600);
    place(tl, a, { cancel: a });
  }
  {   // parallel agreement waiting at T: out of scope
    const tl = build({ order: "parallel", steps: [{ no: 1, signers: r.int(2, 3), cc: 0 }], hops: noHops, stop: { at: 0, signed: 1 } });
    place(tl, tl.slots[0].sign + r.int(30, 600));
  }
  place(build({ order: "sequential", steps: one(2), hops: noHops, stop: { at: 0, signed: 0 } }), 0, { draft: true });
  {   // sent after T
    const tl = build({ order: "sequential", steps: one(2), hops: noHops, stop: { at: 0, signed: 0 } });
    place(tl, -r.int(60, 2000));
  }
  {   // completed before T
    const tl = build({ order: "sequential", steps: one(2), hops: noHops, stop: null });
    place(tl, tl.end + r.int(10, 1440));
  }
  {   // declined before T
    const tl = build({ order: "sequential", steps: one(r.int(2, 3)), hops: noHops, stop: { at: 1, signed: 0, decline: true } });
    place(tl, tl.slots.find((x) => x.decline !== null).decline + r.int(1, 900));
  }

  /* ---- Hard. ---- */
  if (level >= 2) {
    {   // expires exactly at T
      const tl = build({ order: "sequential", steps: one(2), hops: noHops, stop: { at: r.int(0, 1), signed: 0 } });
      const a = tl.start[tl.slots[tl.slots.length - 1].si] + r.int(60, 2000);
      place(tl, a, { expires: a });
    }
    {   // a cc-only step right before the current signer step, and a cc next to a signer
      const steps = [{ no: 1, signers: 1, cc: r.int(0, 1) }, { no: 2, signers: 0, cc: 1 }, { no: 3, signers: 1, cc: 0 }];
      const tl = build({ order: "sequential", steps, hops: noHops, stop: { at: 2, signed: 0 } });
      place(tl, tl.start[2] + r.int(30, 2000), { expires: tl.start[2] + r.int(4000, 9000) });
    }
    {   // a cc at step 1 ahead of the first signer
      const steps = [{ no: 1, signers: 0, cc: 1 }, { no: 2, signers: 1, cc: 0 }, { no: 3, signers: 1, cc: 0 }];
      const tl = build({ order: "sequential", steps, hops: noHops, stop: { at: 1, signed: 0 } });
      place(tl, r.int(60, 2000));
    }
    {   // a chain of two delegations before T
      const tl = build({ order: "sequential", steps: one(2), hops: (si) => (si === 1 ? 2 : 0), stop: { at: 1, signed: 0 } });
      const s = tl.slots.find((x) => x.si === 1);
      place(tl, s.hops[1] + r.int(1, 600));
    }
    {   // second hop of a chain after T
      const tl = build({ order: "sequential", steps: one(r.int(2, 3)), hops: (si) => (si === 0 ? 2 : 0), stop: { at: 0, signed: 0 } });
      const s = tl.slots[0];
      place(tl, s.hops[0] + Math.max(1, Math.floor((s.hops[1] - s.hops[0]) / 2)));
    }
    {   // declined after T: still open at T
      const tl = build({ order: "sequential", steps: one(2), hops: noHops, stop: { at: 1, signed: 0, decline: true } });
      const s = tl.slots.find((x) => x.decline !== null);
      place(tl, s.c + Math.max(1, Math.floor((s.decline - s.c) / 2)));
    }
  }

  /* ---- Very Hard. ---- */
  if (level === 3) {
    {   // two signers at the current step, one already signed (and one delegated)
      const steps = [{ no: 1, signers: 1, cc: 0 }, { no: 2, signers: 2, cc: 0 }, { no: 3, signers: 1, cc: 0 }];
      const tl = build({ order: "sequential", steps, hops: (si, j) => (si === 1 && j === 1 ? 1 : 0), stop: { at: 1, signed: 1 } });
      const s0 = tl.slots.find((x) => x.si === 1 && x.j === 0), s1 = tl.slots.find((x) => x.si === 1 && x.j === 1);
      place(tl, Math.max(s0.sign, s1.hops[0]) + r.int(1, 900));
    }
    {   // two signers both pending, after a gap in the step numbers
      const gap = r.pick([[1, 3], [2, 5], [10, 20]]);
      const steps = [{ no: gap[0], signers: 1, cc: 0 }, { no: gap[1], signers: 2, cc: 0 }];
      const tl = build({ order: "sequential", steps, hops: noHops, stop: { at: 1, signed: 0 } });
      place(tl, tl.start[1] + r.int(30, 2000));
    }
    {   // step numbers with gaps: the previous signer step is not current_step - 1
      const steps = [{ no: 1, signers: 1, cc: 0 }, { no: 2, signers: 2, cc: 0 }, { no: 4, signers: 1, cc: 0 }];
      const tl = build({ order: "sequential", steps, hops: (si) => (si === 2 ? 1 : 0), stop: { at: 2, signed: 0 } });
      const s = tl.slots.find((x) => x.si === 2);
      place(tl, s.hops[0] + r.int(1, 600));
    }
  }

  /* ---- Random traffic. ---- */
  const nRandom = level === 1 ? 3 : level === 2 ? 4 : 5;
  for (let i = 0; i < nRandom; i++) {
    let no = 0;
    const steps = [];
    const n = r.int(2, level === 1 ? 3 : 4);
    for (let k = 0; k < n; k++) {
      if (level >= 2 && r.chance(0.2)) steps.push({ no: (no += 1), signers: 0, cc: 1 });
      no += level === 3 && r.chance(0.3) ? r.int(2, 3) : 1;
      steps.push({ no, signers: level === 3 && r.chance(0.3) ? 2 : 1, cc: level >= 2 && r.chance(0.2) ? 1 : 0 });
    }
    const signerIdx = steps.map((s, k) => (s.signers ? k : -1)).filter((k) => k >= 0);
    const roll = r.next();
    let stop = null;
    if (roll < 0.4) {
      const at = r.pick(signerIdx);
      stop = { at, signed: steps[at].signers === 2 ? r.int(0, 1) : 0, decline: roll < 0.12 };
    }
    const hops = () => (r.chance(level === 1 ? 0.25 : 0.3) ? (level >= 2 && r.chance(0.4) ? 2 : 1) : 0);
    const memo = new Map();
    const tl = build({ order: "sequential", steps, hops: (si, j) => { const k = si + "|" + j; if (!memo.has(k)) memo.set(k, hops()); return memo.get(k); }, stop });
    const extra = {};
    if (r.chance(0.15)) extra.cancel = r.int(1, tl.end + 600);
    if (level >= 2 && r.chance(0.5)) extra.expires = r.int(1440, 15 * 1440);
    place(tl, r.int(0, tl.end + 1440), extra);
  }

  /* Ids: agreements in order of sending (drafts last), events in time order. */
  const sorted = agreements.map((a, i) => ({ a, i }))
    .sort((x, y) => (x.a.sent ?? Infinity) - (y.a.sent ?? Infinity) || x.i - y.i).map((x) => x.a);
  let aid = 2000 + r.int(0, 3000);
  for (const a of sorted) a.id = "agr_" + (aid += r.int(1, 23));
  const allEv = sorted.flatMap((a) => a.ev.map((e) => ({ ...e, agr: a.id })))
    .map((e, i) => ({ e, i })).sort((x, y) => x.e.t - y.e.t || x.i - y.i).map((x) => x.e);
  let evn = 70000 + r.int(0, 9000);
  for (const e of allEv) e.id = "ev_" + (evn += r.int(1, 4));

  /* ---- The oracle: works only from the rows. opts break one rule each, for diagnostics. ---- */
  const A = sorted.map((a) => ({ id: a.id, order: a.order, sent: a.sent, expires: a.expires, cancelled: a.cancelled, status: a.status }));
  const P = sorted.flatMap((a) => a.parts.map((p) => ({ agr: a.id, ...p })));
  const EV = allEv.map((e) => ({ id: e.id, agr: e.agr, pid: e.pid, action: e.action, to: e.to, t: e.t }));
  const round2 = (sec) => Math.round(sec / 36) / 100;

  const compute = (opts = {}) => {
    const le = (x) => (opts.strict ? x < T : x <= T);
    const out = [];
    for (const a of A) {
      if (!opts.parallel && a.order !== "sequential") continue;
      if (a.sent === null || a.sent > T) continue;
      if (opts.useStatus && a.status !== "in_progress") continue;
      if (a.cancelled !== null && le(a.cancelled)) continue;
      if (!opts.ignoreExpiry && a.expires !== null && (opts.expiryInclusive ? a.expires < T : a.expires <= T)) continue;
      const evs = EV.filter((e) => e.agr === a.id && (le(e.t) || (opts.lateDeleg && e.action === "delegated")));
      if (!opts.ignoreDecline && evs.some((e) => e.action === "declined" && le(e.t))) continue;
      const slots = P.filter((p) => p.agr === a.id && (opts.ccAsSigner || p.role === "signer"))
        .map((p) => ({ assigned: p.pid, step: p.step, holder: p.pid, signedAt: null, delegatedAt: null }));
      const byHolder = new Map(slots.map((s) => [s.holder, s]));
      for (const e of evs) {
        const s = byHolder.get(e.pid);
        if (!s) continue;
        if (e.action === "delegated" && !opts.noDelegation && s.holder === e.pid) {
          if (opts.oneHop && e.pid !== s.assigned) continue;
          s.holder = e.to;
          byHolder.set(e.to, s);
          s.delegatedAt = e.t;
        } else if (e.action === "signed" && s.signedAt === null && le(e.t)) {
          s.signedAt = e.t;
        }
      }
      let cur;
      if (opts.halfStep) {
        const steps = [...new Set(slots.map((s) => s.step))].filter((st) => !slots.some((s) => s.step === st && s.signedAt !== null));
        if (!steps.length) continue;
        cur = Math.min(...steps);
      } else {
        const open = slots.filter((s) => s.signedAt === null);
        if (!open.length) continue;
        cur = Math.min(...open.map((s) => s.step));
      }
      const lower = slots.filter((s) => (opts.prevMinus1 ? s.step === cur - 1 : s.step < cur) && s.signedAt !== null);
      let reached = lower.length ? Math.max(...lower.map((s) => s.signedAt)) : a.sent;
      if (opts.fromSent) reached = a.sent;
      for (const s of slots.filter((x) => x.step === cur && x.signedAt === null).sort((x, y) => (x.assigned < y.assigned ? -1 : 1))) {
        const from = opts.clockFromDelegation && s.delegatedAt !== null ? Math.max(reached, s.delegatedAt) : reached;
        out.push([a.id, cur, s.assigned, s.holder, round2(T - from)]);
      }
    }
    return out.sort((x, y) => y[4] - x[4] || (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0) || (x[2] < y[2] ? -1 : x[2] > y[2] ? 1 : 0));
  };
  const expected = compute();

  const diagnostics = [
    { message: "The status column was used to find open agreements. It is the status at extraction, after the as-of time: an agreement completed or cancelled since then was still waiting at the as-of time. Rebuild the state from sent_at, cancelled_at and the events up to the as-of time.", rows: compute({ useStatus: true }) },
    { message: "A boundary was treated as exclusive. A signature, delegation, decline or cancellation at exactly the as-of time has happened by then.", rows: compute({ strict: true }) },
    { message: "Delegations were ignored. A delegated slot is held by the delegate, and the delegate's signature completes it; without following delegated events, pending_with is wrong and delegated slots never look signed.", rows: compute({ noDelegation: true }) },
    { message: "Delegations after the as-of time were followed. At the as-of time the slot was still with whoever held it then.", rows: compute({ lateDeleg: true }) },
    { message: "The wait was restarted at the delegation. hours_waiting runs from the moment the agreement reached the current step; passing the slot to someone else does not reset it.", rows: compute({ clockFromDelegation: true }) },
    { message: "hours_waiting was measured from sent_at for every agreement. It runs from the moment the agreement reached the current step: the last signature at a lower step, and sent_at only when no lower step names a signer.", rows: compute({ fromSent: true }) },
    { message: "Agreements with signing_order 'parallel' were included. Only sequential agreements wait on one step at a time.", rows: compute({ parallel: true }) },
    { message: "Declined agreements were still reported. A decline at or before the as-of time ends the agreement.", rows: compute({ ignoreDecline: true }) },
  ];
  if (level >= 2) {
    diagnostics.push(
      { message: "cc rows were treated as signers. A cc participant receives a copy and never signs, so the agreement never waits on them.", rows: compute({ ccAsSigner: true }) },
      { message: "Expired agreements were still reported. An agreement with an expires_at is open only while the as-of time is strictly before it.", rows: compute({ ignoreExpiry: true }) },
      { message: "An agreement expiring exactly at the as-of time was reported. At expires_at it has expired.", rows: compute({ expiryInclusive: true }) },
      { message: "Only the first delegation was followed. A delegate can delegate again; follow the chain (a recursive CTE) to the holder at the as-of time.", rows: compute({ oneHop: true }) },
      { message: "The current step was reached when step current_step − 1 was signed. Steps that name only cc rows (and, at the hardest level, gaps in the numbering) mean the previous signer step is not always current_step − 1: use the last signature at any lower step.", rows: compute({ prevMinus1: true }) },
    );
  }
  if (level === 3) {
    diagnostics.push(
      { message: "A step was treated as complete when one of its signers signed. Every signer named at a step must sign before the agreement moves on.", rows: compute({ halfStep: true }) },
    );
  }

  const aCols = ["agreement_id", "signing_order", "sent_at", "expires_at", "cancelled_at", "status"];
  const pCols = ["agreement_id", "participant_id", "step", "role"];
  const eCols = ["event_id", "agreement_id", "participant_id", "action", "delegate_to", "occurred_at"];
  const aRows = A.map((a) => [a.id, a.order, a.sent === null ? null : stamp(a.sent), a.expires === null ? null : stamp(a.expires), a.cancelled === null ? null : stamp(a.cancelled), a.status]);
  const pRows = P.slice().sort((x, y) => (x.agr < y.agr ? -1 : x.agr > y.agr ? 1 : x.step - y.step || (x.pid < y.pid ? -1 : 1)))
    .map((p) => [p.agr, p.pid, p.step, p.role]);
  const eRows = EV.map((e) => [e.id, e.agr, e.pid, e.action, e.to, stamp(e.t)]);

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE agreements (\n  agreement_id TEXT PRIMARY KEY,\n  signing_order TEXT NOT NULL CHECK (signing_order IN ('sequential','parallel')),\n  sent_at TIMESTAMPTZ,\n  expires_at TIMESTAMPTZ,\n  cancelled_at TIMESTAMPTZ,\n  status TEXT NOT NULL\n);\n" +
    "CREATE TABLE agreement_participants (\n  agreement_id TEXT NOT NULL REFERENCES agreements (agreement_id),\n  participant_id TEXT NOT NULL,\n  step INT NOT NULL,\n  role TEXT NOT NULL CHECK (role IN ('signer','cc')),\n  PRIMARY KEY (agreement_id, participant_id)\n);\n" +
    "CREATE TABLE agreement_events (\n  event_id TEXT PRIMARY KEY,\n  agreement_id TEXT NOT NULL REFERENCES agreements (agreement_id),\n  participant_id TEXT NOT NULL,\n  action TEXT NOT NULL CHECK (action IN ('viewed','reminded','delegated','signed','declined')),\n  delegate_to TEXT,\n  occurred_at TIMESTAMPTZ NOT NULL\n);\n" +
    insertSQL("agreements", aCols, aRows) + insertSQL("agreement_participants", pCols, pRows) + insertSQL("agreement_events", eCols, eRows);

  return {
    vars: {
      as_of: stamp(T),
      extracted_at: stamp(E),
      agreements: aRows.length,
      events: eRows.length,
      level_rules: level === 1
        ? "In this extract no agreement has an expiry (`expires_at` is NULL), every step names exactly one signer, and there are no cc rows."
        : level === 2
          ? "An agreement with an `expires_at` is open only while the as-of time is strictly before it. A row with role `cc` receives a copy and never signs: no agreement waits on a cc row, and a step that names only cc rows is passed over. Every step names at most one signer."
          : "An agreement with an `expires_at` is open only while the as-of time is strictly before it. A row with role `cc` receives a copy and never signs: no agreement waits on a cc row, and a step that names only cc rows is passed over. A step can name several signers, all of whom must sign before the agreement moves on, and step numbers need not be consecutive.",
    },
    setup,
    tables: [
      { name: "agreements", columns: aCols, rows: aRows },
      { name: "agreement_participants", columns: pCols, rows: pRows },
      { name: "agreement_events", columns: eCols, rows: eRows },
    ],
    expected: { columns: ["agreement_id", "current_step", "assigned_to", "pending_with", "hours_waiting"], rows: expected },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(expected)),
  };
}
