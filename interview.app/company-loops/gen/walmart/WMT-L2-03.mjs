/* WMT-L2-03 — Debug the store replenishment order calculator (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes): the shortfall is rounded down to whole
   cases; backroom stock is read from a renamed field and is always 0; a negative
   on-hand is not treated as 0; received orders are counted as still on order; the
   forecast is bucketed by its UTC date instead of the store's local date.
   level: 1 Medium (one store, open orders only) · 2 Hard (+ several stores in
          different time zones, received orders) · 3 Very Hard (+ negative on-hand,
          cancelled orders, forecast for items a store does not stock) */
export const kind = "debug";
export const entry = "replenishment_orders";
export const signature = "def replenishment_orders(positions: list[dict], forecast: list[dict], stores: dict[str, int], start: str, end: str) -> dict[str, int]:";
export const starter = `from datetime import datetime, timedelta


def _units_on_order(orders, case_pack):
    return sum(o["cases"] * case_pack for o in orders if o["status"] != "cancelled")


def replenishment_orders(positions, forecast, stores, start, end):
    need = {}                                   # (store, item) -> forecast units
    for f in forecast:
        day = f["utc"][:10]
        if start <= day <= end:
            key = (f["store"], f["item"])
            need[key] = need.get(key, 0) + f["units"]
    orders = {}
    for p in positions:
        key = (p["store"], p["item"])
        available = p["on_hand"] + p.get("back_room", 0)
        available += _units_on_order(p["open_orders"], p["case_pack"])
        short = need.get(key, 0) + p["safety"] - available
        if short > 0:
            orders[p["store"] + "/" + p["item"]] = short // p["case_pack"]    # whole cases
    return orders
`;

export const prelude = `
def _gen_replenishment(n_pos, n_fc, seed):
    x = seed
    stores = {}
    for s in range(400):
        x = (1103515245 * x + 12345) % 2147483648
        stores['S%04d' % s] = (-4, -5, -6, -7, -8, -10)[(x >> 16) % 6]
    positions = []
    for i in range(n_pos):
        x = (1103515245 * x + 12345) % 2147483648
        cp = (4, 6, 8, 12, 24)[(x >> 8) % 5]
        x = (1103515245 * x + 12345) % 2147483648
        oo = []
        for k in range((x >> 8) % 3):
            x = (1103515245 * x + 12345) % 2147483648
            oo.append({'cases': 1 + (x >> 8) % 4, 'status': ('open', 'received', 'cancelled')[(x >> 12) % 3]})
        x = (1103515245 * x + 12345) % 2147483648
        positions.append({'store': 'S%04d' % (i % 400), 'item': 'IT%05d' % (i // 400),
                          'on_hand': (x >> 8) % 60 - 8, 'backroom': (x >> 14) % 30,
                          'case_pack': cp, 'safety': (x >> 20) % 12, 'open_orders': oo})
    items = max(1, n_pos // 400)
    forecast = []
    for k in range(n_fc):
        x = (1103515245 * x + 12345) % 2147483648
        d, h = 13 + (x >> 8) % 6, (x >> 12) % 24
        x = (1103515245 * x + 12345) % 2147483648
        forecast.append({'store': 'S%04d' % ((x >> 8) % 400), 'item': 'IT%05d' % ((x >> 16) % (items + 2)),
                         'utc': '2026-10-%02dT%02d:00' % (d, h), 'units': 1 + (x >> 4) % 9})
    return positions, forecast, stores, '2026-10-15', '2026-10-17'
`.trim() + "\n";

// The specification, implemented independently of the Python reference.
export function oracle(positions, forecast, stores, start, end) {
  const need = new Map();
  for (const f of forecast) {
    const [d, t] = f.utc.split("T");
    const [y, mo, da] = d.split("-").map(Number);
    const [hh, mm] = t.split(":").map(Number);
    const local = new Date(Date.UTC(y, mo - 1, da, hh, mm) + stores[f.store] * 3600000).toISOString().slice(0, 10);
    if (local < start || local > end) continue;
    const k = f.store + "/" + f.item;
    need.set(k, (need.get(k) || 0) + f.units);
  }
  const out = {};
  for (const p of positions) {
    const k = p.store + "/" + p.item;
    let onOrder = 0;
    for (const o of p.open_orders) if (o.status === "open") onOrder += o.cases * p.case_pack;
    const available = Math.max(p.on_hand, 0) + p.backroom + onOrder;
    const short = (need.get(k) || 0) + p.safety - available;
    if (short > 0) out[k] = Math.ceil(short / p.case_pack);
  }
  return out;
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `'${k}': ${py(x)}`).join(", ") + "}";
}
const pyArgs = (c) => `(${py(c.positions)}, ${py(c.forecast)}, ${py(c.stores)}, ${py(c.start)}, ${py(c.end)})`;

const STORES = ["S1043", "S2217", "S0388", "S4120", "S5309", "S0871"];
const OFFSETS = [-4, -5, -6, -7, -8, -10];
const ITEMS = ["EGGS-12CT", "BREAD-WHT", "PASTA-1LB", "TP-12ROLL", "DETERGENT-64", "CEREAL-18OZ", "COFFEE-30OZ", "RICE-5LB"];
const PACKS = [4, 6, 8, 12];
const day = (d) => "2026-10-" + String(d).padStart(2, "0");
const at = (d, h) => `${day(d)}T${String(h).padStart(2, "0")}:00`;

function caseFor(r, level) {
  const nStores = level === 1 ? 1 : r.int(2, 3);
  const idx = r.sample([0, 1, 2, 3, 4, 5], nStores);
  const stores = Object.fromEntries(idx.map((i) => [STORES[i], OFFSETS[i]]));
  const ids = Object.keys(stores);
  const first = r.int(6, 20), last = first + r.int(1, 3);
  const items = r.sample(ITEMS, level === 1 ? 3 : 4);
  const positions = [];
  for (const s of ids) {
    for (const item of items.slice(0, level === 3 ? 3 : items.length)) {
      const statuses = level === 1 ? ["open"] : level === 2 ? ["open", "received"] : ["open", "received", "cancelled"];
      positions.push({
        store: s, item,
        on_hand: level === 3 && r.chance(0.3) ? -r.int(1, 9) : r.int(0, 30),
        backroom: r.chance(0.6) ? r.int(1, 24) : 0,
        case_pack: r.pick(PACKS),
        safety: r.int(0, 10),
        open_orders: Array.from({ length: r.int(0, 2) }, () => ({ cases: r.int(1, 3), status: r.pick(statuses) })),
      });
    }
  }
  const forecast = [];
  const nF = level === 1 ? r.int(8, 12) : r.int(12, 18);
  for (let i = 0; i < nF; i++) {
    forecast.push({ store: r.pick(ids), item: r.pick(items), utc: at(r.int(first - 1, last + 1), r.int(0, 23)), units: r.int(2, 30) });
  }
  return { positions, forecast, stores, start: day(first), end: day(last) };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const c = caseFor(r, level);
    samples.push({ args: pyArgs(c), expect: py(oracle(c.positions, c.forecast, c.stores, c.start, c.end)) });
  }
  const tests = samples.map((t, i) => ({ name: "sample " + (i + 1), args: t.args, expect: t.expect }));

  const [S, T] = r.sample(STORES, 2);
  const [A, B] = r.sample(ITEMS, 2);
  const first = r.int(6, 20), last = first + 2;
  const off = r.pick([-5, -6, -7]);
  const stores = { [S]: off, [T]: -4 };
  const pos = (o) => ({ store: S, item: A, on_hand: 0, backroom: 0, case_pack: 6, safety: 0, open_orders: [], ...o });
  const fc = (units, o) => ({ store: S, item: A, utc: at(first + 1, 15), units, ...o });
  const mk = (positions, forecast) => ({ positions, forecast, stores, start: day(first), end: day(last) });
  const edges = [
    ["a shortfall that is not a whole number of cases rounds up to a full case",
      mk([pos({ on_hand: 10, safety: 4 })], [fc(20)])],
    ["backroom units count as available stock",
      mk([pos({ on_hand: 5, backroom: 13 })], [fc(24)])],
    ["a negative on-hand counts as zero, not as units owed",
      mk([pos({ on_hand: -6 })], [fc(12)])],
    ["a received order is already in on-hand; only open orders are still to come",
      mk([pos({ on_hand: 12, open_orders: [{ cases: 2, status: "received" }, { cases: 1, status: "open" }] })], [fc(30)])],
    ["a cancelled order never arrives",
      mk([pos({ on_hand: 6, open_orders: [{ cases: 3, status: "cancelled" }] })], [fc(18)])],
    ["forecast hours are counted on the store's local date, not the UTC date",
      mk([pos({ on_hand: 6 })], [fc(30, { utc: at(first, 2) }), fc(12, { utc: at(first + 1, 12) }), fc(24, { utc: at(last + 1, 1) })])],
    ["each store uses its own time zone",
      mk([pos({ on_hand: 0 }), pos({ store: T, on_hand: 0 })], [fc(12, { utc: at(last + 1, 4) }), fc(18, { store: T, utc: at(last + 1, 4) })])],
    ["stock that exactly covers forecast and safety orders nothing",
      mk([pos({ on_hand: 8, backroom: 8, safety: 6 }), pos({ item: B, on_hand: 30 })], [fc(10), fc(12, { item: B })])],
    ["no forecast still orders up to safety stock",
      mk([pos({ on_hand: 1, safety: 7, case_pack: 4 })], [])],
    ["forecast for an item the store does not stock is ignored",
      mk([pos({ on_hand: 30 })], [fc(12, { item: B }), fc(6)])],
  ];
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: py(oracle(c.positions, c.forecast, c.stores, c.start, c.end)) });

  const nPos = level === 1 ? 20000 : 40000;
  tests.push({ name: `${nPos.toLocaleString("en-US")} store-items and 200,000 forecast hours in time`, args: `_gen_replenishment(${nPos}, 200000, ${r.int(1, 1_000_000)})`, limit_s: 8 });

  return {
    vars: {
      replay_rule: level === 1
        ? "This replay covers one store with open orders only; the checks also include several stores in different time zones, received and cancelled orders, and negative on-hand."
        : level === 2
          ? "This replay covers several stores in different time zones, and open orders that have since been received."
          : "This replay covers several stores in different time zones, negative on-hand counts, received and cancelled orders, and forecast rows for items a store does not stock.",
    },
    samples,
    tests,
  };
}
