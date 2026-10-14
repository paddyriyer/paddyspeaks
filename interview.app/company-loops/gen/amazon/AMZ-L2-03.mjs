/* AMZ-L2-03 — Debug the fulfilment-centre inventory reservation processor (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes): shipping does not release the reservation;
   the availability check uses < instead of <=; reported availability is clamped at
   zero; order lines are keyed by order id only; cancel releases without checking
   the line's state.
   level: 1 Medium (one centre, single-line orders) · 2 Hard (+ several centres,
          multi-line orders, cancellations) · 3 Very Hard (+ negative adjustments,
          repeated cancels and cancels after shipping) */
export const kind = "debug";
export const entry = "process_inventory";
export const signature = "def process_inventory(events: list[dict]) -> dict:";
export const starter = `def _stock(stock, fc, sku):
    return stock.setdefault((fc, sku), {"on_hand": 0, "reserved": 0})


def process_inventory(events):
    stock = {}          # (fc, sku) -> counters
    lines = {}          # order line -> reservation
    rejected = []
    for ev in events:
        t = ev["type"]
        if t in ("receive", "adjust"):
            _stock(stock, ev["fc"], ev["sku"])["on_hand"] += ev["qty"]
        elif t == "reserve":
            s = _stock(stock, ev["fc"], ev["sku"])
            if ev["qty"] < s["on_hand"] - s["reserved"]:
                s["reserved"] += ev["qty"]
                lines[ev["order"]] = {"fc": ev["fc"], "sku": ev["sku"],
                                      "qty": ev["qty"], "state": "reserved"}
            else:
                rejected.append([ev["order"], ev["sku"]])
        elif t == "cancel":
            line = lines.get(ev["order"])
            if line:
                _stock(stock, line["fc"], line["sku"])["reserved"] -= line["qty"]
                line["state"] = "cancelled"
        elif t == "ship":
            line = lines.get(ev["order"])
            if line and line["state"] == "reserved":
                _stock(stock, line["fc"], line["sku"])["on_hand"] -= line["qty"]
                line["state"] = "shipped"
    return {
        "stock": {
            fc + "/" + sku: {
                "on_hand": s["on_hand"],
                "reserved": s["reserved"],
                "available": max(0, s["on_hand"] - s["reserved"]),
            }
            for (fc, sku), s in stock.items()
        },
        "rejected": rejected,
    }
`;

export const prelude = `
def _gen_inventory_events(n, seed):
    x, out, open_lines = seed, [], []
    fcs = ['FC%d' % i for i in range(1, 9)]
    skus = ['B0%05d' % i for i in range(400)]
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        k = (x >> 16) % 20
        x = (1103515245 * x + 12345) % 2147483648
        fc, sku = fcs[(x >> 8) % 8], skus[(x >> 16) % 400]
        if k < 5:
            out.append({'type': 'receive', 'fc': fc, 'sku': sku, 'qty': 1 + (x >> 4) % 30})
        elif k == 5:
            out.append({'type': 'adjust', 'fc': fc, 'sku': sku, 'qty': -1 - (x >> 4) % 3})
        elif k < 13:
            order = 'o%d' % (i // 2)
            out.append({'type': 'reserve', 'order': order, 'fc': fc, 'sku': sku, 'qty': 1 + (x >> 4) % 4})
            open_lines.append((order, sku))
        elif open_lines:
            order, sku = open_lines[(x >> 4) % len(open_lines)]
            out.append({'type': 'cancel' if k < 15 else 'ship', 'order': order, 'sku': sku})
    return out
`.trim() + "\n";

// The specification, implemented independently of the Python reference.
export function oracle(events) {
  const stock = new Map();          // "fc/sku" -> {on_hand, reserved}
  const lines = new Map();          // "order|sku" -> {key, qty, state}
  const rejected = [];
  const at = (fc, sku) => {
    const k = fc + "/" + sku;
    if (!stock.has(k)) stock.set(k, { on_hand: 0, reserved: 0 });
    return stock.get(k);
  };
  for (const e of events) {
    if (e.type === "receive" || e.type === "adjust") at(e.fc, e.sku).on_hand += e.qty;
    else if (e.type === "reserve") {
      const s = at(e.fc, e.sku);
      if (e.qty <= s.on_hand - s.reserved) {
        s.reserved += e.qty;
        lines.set(e.order + "|" + e.sku, { key: e.fc + "/" + e.sku, qty: e.qty, state: "reserved" });
      } else rejected.push([e.order, e.sku]);
    } else {
      const line = lines.get(e.order + "|" + e.sku);
      if (!line || line.state !== "reserved") continue;     // shipped, cancelled or unknown: ignored
      const s = stock.get(line.key);
      s.reserved -= line.qty;
      if (e.type === "ship") s.on_hand -= line.qty;
      line.state = e.type === "ship" ? "shipped" : "cancelled";
    }
  }
  const out = {};
  for (const [k, s] of stock) out[k] = { on_hand: s.on_hand, reserved: s.reserved, available: s.on_hand - s.reserved };
  return { stock: out, rejected };
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

const FCS = ["FC1", "FC2", "FC3", "FC4", "FC5", "FC6"];
const SKUS = ["B0DESK", "B0CHAIR", "B0LAMP", "B0KETTLE", "B0TOASTER", "B0RUG", "B0SHELF", "B0FAN"];
let orderNo = 0;
const oid = (r) => "ord-" + String(++orderNo).padStart(2, "0") + r.int(100, 999);

function streamCase(r, level) {
  const fcs = level === 1 ? r.sample(FCS, 1) : r.sample(FCS, r.int(2, 3));
  const skus = r.sample(SKUS, level === 1 ? 2 : 3);
  const evs = [];
  for (const fc of fcs) for (const sku of skus) if (fc === fcs[0] || r.chance(0.7)) evs.push({ type: "receive", fc, sku, qty: r.int(2, 8) });
  const open = [];
  const steps = level === 1 ? r.int(6, 9) : r.int(9, 14);
  for (let i = 0; i < steps; i++) {
    const roll = r.next();
    if (roll < 0.45 || !open.length) {
      const order = oid(r);
      const nl = level === 1 ? 1 : r.int(1, 2);
      const fc = r.pick(fcs);
      for (const sku of r.sample(skus, nl)) {
        evs.push({ type: "reserve", order, fc, sku, qty: r.int(1, 4) });
        open.push([order, sku]);
      }
    } else if (roll < 0.6) {
      evs.push({ type: "receive", fc: r.pick(fcs), sku: r.pick(skus), qty: r.int(1, 5) });
    } else if (roll < 0.68 && level === 3) {
      evs.push({ type: "adjust", fc: r.pick(fcs), sku: r.pick(skus), qty: -r.int(1, 4) });
    } else {
      const [order, sku] = r.pick(open);
      const type = level === 1 ? "ship" : r.chance(0.6) ? "ship" : "cancel";
      evs.push({ type, order, sku });
      if (level === 3 && r.chance(0.3)) evs.push({ type: r.pick(["cancel", "ship"]), order, sku });  // a repeat
    }
  }
  return evs;
}

export function generate(r, level) {
  orderNo = 0;
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const ev = streamCase(r, level);
    samples.push({ args: pyArgs(ev), expect: py(oracle(ev)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [F, G] = r.sample(FCS, 2);
  const [A, B] = r.sample(SKUS, 2);
  const o1 = oid(r), o2 = oid(r);
  const q = r.int(2, 5);
  const rcv = (fc, sku, qty) => ({ type: "receive", fc, sku, qty });
  const res = (order, fc, sku, qty) => ({ type: "reserve", order, fc, sku, qty });
  const edges = [
    ["shipping consumes the reservation as well as the stock",
      [rcv(F, A, q + 3), res(o1, F, A, q), { type: "ship", order: o1, sku: A }]],
    ["a reservation for exactly the units available is accepted",
      [rcv(F, A, q), res(o1, F, A, q)]],
    ["one more unit than available is rejected",
      [rcv(F, A, q), res(o1, F, A, q + 1)]],
    ["a negative adjustment can leave availability below zero, and it is reported",
      [rcv(F, A, q + 1), res(o1, F, A, q), { type: "adjust", fc: F, sku: A, qty: -2 }]],
    ["cancelling one line of a two-line order leaves the other line reserved",
      [rcv(F, A, 5), rcv(F, B, 5), res(o1, F, A, 2), res(o1, F, B, 3), { type: "cancel", order: o1, sku: A }]],
    ["a second cancel of the same line changes nothing",
      [rcv(F, A, 6), res(o1, F, A, q), { type: "cancel", order: o1, sku: A }, { type: "cancel", order: o1, sku: A }]],
    ["stock at another centre does not make an order line available",
      [rcv(F, A, 9), res(o1, G, A, 1)]],
    ["a cancel or ship for an unknown or rejected line is ignored",
      [rcv(F, A, 1), res(o1, F, A, 2), { type: "cancel", order: o1, sku: A }, { type: "ship", order: o2, sku: A }]],
    ["a cancel after shipping does not release anything",
      [rcv(F, A, 6), res(o1, F, A, q), { type: "ship", order: o1, sku: A }, { type: "cancel", order: o1, sku: A }]],
  ];
  for (const [name, ev] of edges) tests.push({ name, args: pyArgs(ev), expect: py(oracle(ev)) });

  const n = level === 1 ? 100000 : 200000;
  tests.push({ name: `${n.toLocaleString("en-US")} inventory events in time`, args: `(_gen_inventory_events(${n}, ${r.int(1, 1_000_000)}),)`, limit_s: 8 });

  return {
    vars: {
      replay_rule: level === 1
        ? "This replay covers one fulfilment centre with single-line orders; the checks also include several centres and multi-line orders."
        : level === 2
          ? "This replay covers several fulfilment centres and multi-line orders, with cancellations."
          : "This replay covers several fulfilment centres, multi-line orders, negative stock adjustments, and cancel or ship events that repeat or arrive after the line has already shipped.",
    },
    samples,
    tests,
  };
}
