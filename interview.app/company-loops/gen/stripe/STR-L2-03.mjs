/* STR-L2-03 — Debug a payment-status webhook processor (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes): deduplication on (payment, type) instead
   of the event id; no ordering by per-payment sequence; money in float major units;
   a swallowed exception that still acknowledges (and marks the event seen); a
   mutable default argument shared by every payment record.
   level: 1 Medium (in-order delivery, redeliveries) · 2 Hard (+ out-of-order status
          events, several partial refunds) · 3 Very Hard (+ refunds that arrive before
          their payment, then are redelivered) */
export const kind = "debug";
export const entry = "process_events";
export const signature = "def process_events(events: list[dict]) -> dict:";
export const starter = `STATUS = {
    "payment.processing": "processing",
    "payment.succeeded": "succeeded",
    "payment.failed": "failed",
}


def _new_record(amount, applied=[]):
    return {"status": None, "seq": 0, "amount": amount, "refunded": 0.0, "applied": applied}


def _apply(payments, ev):
    pid = ev["payment"]
    if ev["type"] in STATUS:
        rec = payments.setdefault(pid, _new_record(ev["amount"]))
        rec["status"] = STATUS[ev["type"]]
        rec["seq"] = ev["seq"]
        rec["applied"].append(ev["id"])
    elif ev["type"] == "refund.succeeded":
        rec = payments[pid]
        rec["refunded"] += ev["amount"] / 100          # keep refunds in major units
        rec["applied"].append(ev["id"])


def process_events(events):
    payments, seen = {}, set()
    acked, retry = [], []
    for ev in events:
        key = (ev["payment"], ev["type"])
        if key in seen:                                 # duplicate delivery
            acked.append(ev["id"])
            continue
        seen.add(key)
        try:
            _apply(payments, ev)
        except Exception:
            pass                                        # never fail the webhook
        acked.append(ev["id"])
    return {
        "payments": {
            pid: {
                "status": rec["status"],
                "amount": rec["amount"],
                "amount_refunded": int(rec["refunded"] * 100),
                "fully_refunded": rec["refunded"] == rec["amount"] / 100,
                "applied": rec["applied"],
            }
            for pid, rec in payments.items()
        },
        "acked": acked,
        "retry": retry,
    }
`;

export const prelude = `
def _gen_events(n, seed):
    x, out = seed, []
    pays = max(1, n // 8)
    kinds = ('payment.processing', 'payment.succeeded', 'payment.failed')
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        p = (x >> 16) % pays
        x = (1103515245 * x + 12345) % 2147483648
        k = (x >> 16) % 10
        if k == 9 and len(out) > 3:
            out.append(dict(out[-3]))                 # a redelivery
        elif k < 6:
            out.append({'id': 'evt_%d' % i, 'type': kinds[k % 3], 'payment': 'pi_%d' % p,
                        'seq': 1 + (x >> 8) % 6, 'amount': 1000 + (p * 37) % 9000})
        else:
            out.append({'id': 'evt_%d' % i, 'type': 'refund.succeeded', 'payment': 'pi_%d' % p,
                        'amount': 1 + (x >> 20) % 40})
    return out
`.trim() + "\n";

const STATUS = { "payment.processing": "processing", "payment.succeeded": "succeeded", "payment.failed": "failed" };

// The specification, implemented independently of the Python reference.
export function oracle(events) {
  const pays = new Map(), done = new Set(), acked = [], retry = [];
  for (const e of events) {
    if (done.has(e.id)) { acked.push(e.id); continue; }
    if (e.type in STATUS) {
      if (!pays.has(e.payment)) pays.set(e.payment, { status: null, seq: 0, amount: e.amount, refunded: 0, applied: [] });
      const p = pays.get(e.payment);
      if (e.seq > p.seq) { p.status = STATUS[e.type]; p.seq = e.seq; p.applied.push(e.id); }
    } else if (e.type === "refund.succeeded") {
      const p = pays.get(e.payment);
      if (!p) { retry.push(e.id); continue; }       // not acknowledged, not marked seen
      p.refunded += e.amount;
      p.applied.push(e.id);
    }
    done.add(e.id);
    acked.push(e.id);
  }
  const payments = {};
  for (const [pid, p] of pays) {
    payments[pid] = { status: p.status, amount: p.amount, amount_refunded: p.refunded, fully_refunded: p.refunded === p.amount, applied: p.applied };
  }
  return { payments, acked, retry };
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `'${k}': ${py(x)}`).join(", ") + "}";
}
const pyArgs = (events) => "(" + py(events) + ",)";

const ALNUM = "abcdefghijklmnopqrstuvwxyz0123456789";
const rid = (r, pre) => pre + Array.from({ length: 6 }, () => r.pick(ALNUM.split(""))).join("");
const AMOUNTS = [30, 129, 1999, 2500, 4999, 10000, 15050];

// One payment's events in source order: status events with increasing seq, then refunds.
function paymentStory(r, level, pid) {
  const amount = r.pick(AMOUNTS);
  const evs = [];
  let seq = 0;
  const status = (type) => evs.push({ id: rid(r, "evt_"), type, payment: pid, seq: ++seq, amount });
  status("payment.processing");
  if (r.chance(0.2)) { status("payment.failed"); return evs; }
  status("payment.succeeded");
  if (r.chance(level === 1 ? 0.5 : 0.8)) {
    let left = amount;
    const n = level === 1 ? 1 : r.int(1, 3);
    for (let i = 0; i < n && left > 0; i++) {
      const part = i === n - 1 && r.chance(0.5) ? left : Math.max(1, Math.floor(left * r.int(20, 60) / 100));
      left -= part;
      evs.push({ id: rid(r, "evt_"), type: "refund.succeeded", payment: pid, amount: part });
    }
  }
  return evs;
}

function streamCase(r, level) {
  const nPay = level === 1 ? r.int(1, 2) : level === 2 ? r.int(2, 3) : r.int(3, 4);
  const stories = Array.from({ length: nPay }, () => paymentStory(r, level, rid(r, "pi_")));
  // Interleave stories, keeping each story's order.
  let stream = [];
  const idx = stories.map(() => 0);
  while (stream.length < stories.reduce((s, x) => s + x.length, 0)) {
    const live = stories.map((s, i) => i).filter((i) => idx[i] < stories[i].length);
    const i = r.pick(live);
    stream.push(stories[i][idx[i]++]);
  }
  if (level >= 2) {                              // out-of-order delivery: swap a few neighbours
    for (let k = 0; k < 2; k++) {
      const i = r.int(0, stream.length - 2);
      [stream[i], stream[i + 1]] = [stream[i + 1], stream[i]];
    }
  }
  if (level === 3) {                             // a refund delivered before its payment, redelivered later
    const refunds = stream.filter((e) => e.type === "refund.succeeded");
    if (refunds.length) {
      const ref = r.pick(refunds);
      const firstOfPay = stream.findIndex((e) => e.payment === ref.payment);
      stream = stream.filter((e) => e !== ref);
      stream.splice(firstOfPay, 0, ref);
      stream.push({ ...ref });
    }
  }
  for (let k = 0; k < (level === 1 ? 1 : 2); k++) {   // redeliveries
    const e = r.pick(stream);
    stream.splice(r.int(stream.indexOf(e) + 1, stream.length), 0, { ...e });
  }
  return stream;
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const ev = streamCase(r, level);
    samples.push({ args: pyArgs(ev), expect: py(oracle(ev)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const P = rid(r, "pi_"), Q = rid(r, "pi_");
  const E = () => rid(r, "evt_");
  const amt = r.pick([4000, 10000, 20000]);
  const st = (type, pid, seq, amount = amt) => ({ id: E(), type, payment: pid, seq, amount });
  const rf = (pid, amount) => ({ id: E(), type: "refund.succeeded", payment: pid, amount });

  const succeeded = st("payment.succeeded", P, 2);
  const twoPartial = [st("payment.processing", P, 1), succeeded, rf(P, amt / 4), rf(P, amt / 4)];
  const redelivered = [st("payment.processing", P, 1), succeeded, { ...succeeded }];
  const stale = [st("payment.processing", P, 1), st("payment.succeeded", P, 3), st("payment.processing", P, 2)];
  const thirty = [st("payment.succeeded", P, 1, 30), rf(P, 10), rf(P, 20)];
  const twentyNine = [st("payment.succeeded", P, 1, 29), rf(P, 29)];
  const early = rf(P, amt / 2);
  const refundFirst = [early, st("payment.succeeded", P, 1)];
  const refundRedelivered = [early, st("payment.succeeded", P, 1), { ...early }];
  const twoPayments = [st("payment.succeeded", P, 1), st("payment.succeeded", Q, 1), rf(Q, amt / 2)];
  const edges = [
    ["two partial refunds on one payment are two events, not a duplicate", twoPartial],
    ["a redelivered event is acknowledged again but applied once", redelivered],
    ["refunds of 10 and 20 on a 30-unit payment make it fully refunded", thirty],
    ["a 29-unit refund is 29 minor units, not 28", twentyNine],
    ["two payments keep separate histories", twoPayments],
    ["an older status event that arrives late does not overwrite a newer one", stale],
    ["a refund for a payment not yet seen is not acknowledged", refundFirst],
    ["the redelivered refund is applied once its payment exists", refundRedelivered],
  ];
  for (const [name, ev] of edges) tests.push({ name, args: pyArgs(ev), expect: py(oracle(ev)) });

  const n = level === 1 ? 100000 : 200000;
  tests.push({ name: `${n.toLocaleString("en-US")} webhook deliveries in time`, args: `(_gen_events(${n}, ${r.int(1, 1_000_000)}),)`, limit_s: 8 });

  return {
    vars: {
      delivery_rule: level === 1
        ? "Most of this replay arrives in creation order, with a few redeliveries; the checks also include late and early events."
        : level === 2
          ? "Events can be delivered twice and out of order."
          : "Events can be delivered twice and out of order, and a refund can arrive before the first event of its payment.",
    },
    samples,
    tests,
  };
}
