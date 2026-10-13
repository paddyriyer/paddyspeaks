/* STR-L1-03 — Webhook delivery reliability per endpoint (SQL, gaps and islands).
   Simulated practice scenario. All data is generated from the seed.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates.
   level: 1 Medium (one attempt per event; 200 or an error code)
          2 Hard (+ retries, other 2xx codes, 3xx redirects that count as failures)
          3 Very Hard (+ timeouts with no status code, events never attempted, events
                       sharing a created_at, manual re-sends after a success) */
import { insertSQL, ts } from "../../js/rng.js";

export const kind = "sql";

const ENDPOINTS = ["we_analytics_sink", "we_billing_sync", "we_crm_bridge", "we_fulfilment", "we_ledger_export", "we_orders_prod", "we_support_desk"];
const TYPES = ["payment_intent.succeeded", "charge.refunded", "invoice.paid", "customer.subscription.updated", "charge.dispute.created", "payout.paid"];
const BASES = ["2026-09-03", "2026-09-12", "2026-09-19", "2026-09-27", "2026-10-04"];
const OK2XX = [200, 201, 202, 204];
const FAIL = [400, 404, 410, 500, 502, 503];
const REDIRECT = [301, 302, 307];

export function generate(r, level) {
  const minStreak = level === 1 ? r.pick([3, 4]) : r.pick([3, 4, 5]);
  const day0 = r.pick(BASES);
  const endpoints = r.sample(ENDPOINTS, level === 1 ? 4 : 5);
  const roles = r.shuffle(["streaky", "near", ...endpoints.slice(2).map((_, i) => (i === 0 && level >= 2 && r.chance(0.5) ? "streaky" : "random"))]);
  const idPool = r.shuffle([...Array(200)].map((_, i) => 100000 + i * 97 + r.int(0, 90)));
  let ip = 0;

  const events = [];
  const attempts = [];
  let attSeq = 0;
  const attId = () => "att_" + (500000 + attSeq++ * 3 + r.int(0, 2));

  endpoints.forEach((ep, ei) => {
    const role = roles[ei];
    // Outcome pattern along the endpoint's ordered events (true = never delivered).
    let pattern = [];
    if (role === "streaky") {
      const second = r.int(minStreak, minStreak + 2);
      const first = r.chance(0.4) ? second : r.int(Math.max(1, minStreak - 1), minStreak + 1);   // equal runs: the earlier wins
      pattern = [...okRun(r, 1, 3), ...fails(first), ...okRun(r, 1, 3), ...fails(second), ...okRun(r, 1, 3)];
    } else if (role === "near") {
      pattern = [...okRun(r, 1, 2), ...fails(minStreak - 1), false, ...fails(minStreak - 1), ...okRun(r, 1, 3), ...fails(r.int(1, minStreak - 1)), ...okRun(r, 1, 2)];
    } else {
      const n = r.int(8, 13);
      for (let i = 0; i < n; i++) pattern.push(r.chance(0.25));
    }
    // Times: created_at steps; level 3 allows equal timestamps.
    let t = r.int(0, 20000);
    const evs = pattern.map(() => {
      t += level === 3 && r.chance(0.2) ? 0 : r.int(30, 1500);
      return { id: "evt_" + idPool[ip++], endpoint: ep, type: r.pick(TYPES), abs: t };
    });
    evs.sort((a, b) => a.abs - b.abs || cmp(a.id, b.id));
    evs.forEach((e, i) => {
      e.failed = pattern[i];
      events.push(e);
      // Attempts.
      let at = e.abs + r.int(1, 40);
      const push = (code) => { attempts.push({ id: attId(), event: e.id, abs: at, code }); at += r.int(60, 600) * (1 + Math.floor(r.next() * 4)); };
      const failCode = () => {
        if (level === 3 && r.chance(0.2)) return null;                 // timeout: no response
        if (level >= 2 && r.chance(0.3)) return r.pick(REDIRECT);
        return r.pick(FAIL);
      };
      const okCode = () => (level === 1 ? 200 : r.pick(OK2XX));
      if (e.failed) {
        if (level === 3 && r.chance(0.3)) return;                      // never attempted (endpoint disabled)
        const k = level === 1 ? 1 : r.int(1, 4);
        for (let j = 0; j < k; j++) push(failCode());
      } else {
        const before = level === 1 ? 0 : r.int(0, 2);
        for (let j = 0; j < before; j++) push(failCode());
        push(okCode());
        if (level === 3 && r.chance(0.2)) { at += r.int(3600, 20000); push(okCode()); }   // manual re-send
      }
    });
  });
  // Level 3 always has at least one never-attempted event and one timeout.
  if (level === 3) {
    const failedEv = events.filter((e) => e.failed);
    const attempted = new Set(attempts.map((a) => a.event));
    if (!failedEv.some((e) => !attempted.has(e.id))) {
      const e = failedEv[0];
      for (let i = attempts.length - 1; i >= 0; i--) if (attempts[i].event === e.id) attempts.splice(i, 1);
    }
    if (!attempts.some((a) => a.code === null)) {
      const a = attempts.find((x) => x.code !== null && !OK2XX.includes(x.code));
      if (a) a.code = null;
    }
  }
  if (level >= 2 && !attempts.some((a) => REDIRECT.includes(a.code))) {
    const a = attempts.find((x) => x.code !== null && FAIL.includes(x.code));
    if (a) a.code = r.pick(REDIRECT);
  }

  // Oracle, parameterised so the diagnostics can break one rule each.
  const isOk = (c, o) => (o.only200 ? c === 200 : o.below400 ? c !== null && c < 400 && c >= 200 : c !== null && c >= 200 && c <= 299);
  const byEvent = new Map();
  for (const a of attempts) {
    if (!byEvent.has(a.event)) byEvent.set(a.event, []);
    byEvent.get(a.event).push(a);
  }
  for (const xs of byEvent.values()) xs.sort((a, b) => a.abs - b.abs || cmp(a.id, b.id));

  const compute = (o = {}) => {
    const rows = [];
    for (const ep of [...endpoints].sort()) {
      let evs = events.filter((e) => e.endpoint === ep).sort((a, b) => a.abs - b.abs || cmp(a.id, b.id));
      if (o.innerJoin) evs = evs.filter((e) => byEvent.has(e.id));
      let delivered = 0, latSum = 0;
      const failedFlags = evs.map((e) => {
        const xs = byEvent.get(e.id) || [];
        let succ;
        if (o.firstAttemptOnly) succ = xs.length && isOk(xs[0].code, o) ? xs[0] : null;
        else if (o.lastSuccess) succ = [...xs].reverse().find((a) => isOk(a.code, o)) || null;
        else succ = xs.find((a) => isOk(a.code, o)) || null;
        if (succ) { delivered += 1; latSum += succ.abs - e.abs; }
        return !succ;
      });
      let best = 0, bestStart = null;
      if (o.totalFailures) {
        best = failedFlags.filter(Boolean).length;
        const fi = failedFlags.indexOf(true);
        bestStart = fi >= 0 ? evs[fi].abs : null;
      } else {
        let run = 0, start = null;
        failedFlags.forEach((f, i) => {
          if (f) {
            if (run === 0) start = evs[i].abs;
            run += 1;
            if (run > best || (o.latestRun && run === best)) { best = run; bestStart = start; }
          } else run = 0;
        });
      }
      if (best < minStreak) continue;
      const avg = delivered ? Math.floor((2 * latSum * 10 + delivered) / (2 * delivered)) / 10 : null;
      rows.push([ep, evs.length, delivered, avg, best, absTs(day0, bestStart)]);
    }
    return rows.sort((a, b) => b[4] - a[4] || cmp(a[0], b[0]));
  };
  const rows = compute();

  const diagnostics = [
    { message: `Total failed events were counted, not consecutive ones. An endpoint qualifies only with a run of ${minStreak} or more failed events in a row (ordered by created_at, event_id).`, rows: compute({ totalFailures: true }) },
    { message: "The streak start came from the latest of two equally long runs. Report the start of the earliest longest run.", rows: compute({ latestRun: true }) },
  ];
  if (level >= 2) {
    diagnostics.push({ message: "Only the first attempt decided an event's outcome. Retries exist: an event is delivered if any attempt returned 2xx.", rows: compute({ firstAttemptOnly: true }) });
    diagnostics.push({ message: "Only HTTP 200 counted as success. Any 2xx (200–299) is a successful delivery.", rows: compute({ only200: true }) });
    diagnostics.push({ message: "Redirects (3xx) counted as success. A redirect is not a delivery: only 2xx counts.", rows: compute({ below400: true }) });
  }
  if (level === 3) {
    diagnostics.push({ message: "Events with no delivery attempts were dropped by an inner join. They were never delivered: LEFT JOIN from the events and count them as failed.", rows: compute({ innerJoin: true }) });
    diagnostics.push({ message: "Latency was measured to the last successful attempt. A manual re-send after a success does not change when the event was first delivered.", rows: compute({ lastSuccess: true }) });
  }

  const evCols = ["event_id", "endpoint_id", "event_type", "created_at"];
  const evRows = events.map((e) => [e.id, e.endpoint, e.type, absTs(day0, e.abs)]).sort((a, b) => cmp(a[3], b[3]) || cmp(a[1], b[1]) || cmp(a[0], b[0]));
  const atCols = ["attempt_id", "event_id", "attempted_at", "status_code"];
  const atRows = attempts.map((a) => [a.id, a.event, absTs(day0, a.abs), a.code]).sort((a, b) => cmp(a[2], b[2]) || cmp(a[0], b[0]));

  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE webhook_events (\n  event_id TEXT PRIMARY KEY,       -- one row per event per subscribed endpoint\n  endpoint_id TEXT NOT NULL,\n  event_type TEXT NOT NULL,\n  created_at TIMESTAMPTZ NOT NULL\n);\n" +
    "CREATE TABLE delivery_attempts (\n  attempt_id TEXT PRIMARY KEY,\n  event_id TEXT NOT NULL REFERENCES webhook_events(event_id),\n  attempted_at TIMESTAMPTZ NOT NULL,\n  status_code INT                  -- HTTP status; NULL = timed out, no response\n);\n" +
    insertSQL("webhook_events", evCols, evRows) + insertSQL("delivery_attempts", atCols, atRows);

  return {
    vars: {
      min_streak: minStreak,
      n_events: events.length,
      attempt_rule:
        level === 1
          ? "Each event has exactly one delivery attempt, which returned either 200 or an error status."
          : level === 2
            ? "Failed deliveries are retried, so an event can have several attempts. Any 2xx status is a success; 3xx redirects are not followed and count as failures."
            : "Failed deliveries are retried; any 2xx is a success and 3xx redirects count as failures. A NULL `status_code` is a timeout. Some events were never attempted at all, a few were re-sent by hand after they had already succeeded, and events can share a `created_at`.",
    },
    setup,
    tables: [
      { name: "webhook_events", columns: evCols, rows: evRows },
      { name: "delivery_attempts", columns: atCols, rows: atRows },
    ],
    expected: { columns: ["endpoint_id", "events", "delivered_events", "avg_first_success_s", "longest_failure_streak", "streak_started_at"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}

function fails(n) { return Array(n).fill(true); }
function okRun(r, lo, hi) { return Array(r.int(lo, hi)).fill(false); }
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
function absTs(day0, abs) {
  if (abs === null) return null;
  const d = new Date(day0 + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + Math.floor(abs / 86400));
  return ts(d.toISOString().slice(0, 10), abs % 86400);
}
