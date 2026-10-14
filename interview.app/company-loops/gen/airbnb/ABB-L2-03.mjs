/* ABB-L2-03 — Debug the host payout calculator (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template:
   it assigns every night of a stay to a payout one by one.
   Planted bugs (see the evaluator notes): transfers merged by day only, not by host
   and day; the host fee rounded half to even through round() on a float; refunded
   nights taken from the start of a long stay instead of the end; the cleaning fee
   dropped on a partial refund; an empty monthly period paid as a zero transfer.
   level: 1 Medium (short and monthly stays, no refunds in the replay) · 2 Hard
          (+ partial refunds) · 3 Very Hard (+ full refunds, refunds that empty a whole
          monthly period, several stays released on the same day) */
export const kind = "debug";
export const entry = "host_payouts";
export const signature = "def host_payouts(bookings: list[dict], fee_bps: int) -> list[list]:";
export const starter = `LONG_STAY_NIGHTS = 28      # this exercise's threshold for monthly payouts
PERIOD_NIGHTS = 30         # nights covered by each monthly payout


def _host_fee(gross, fee_bps):
    """The host service fee in cents: to the nearest cent, halves rounded up."""
    return round(gross * fee_bps / 10000)


def host_payouts(bookings, fee_bps):
    lines = []                                    # (day, host, amount) per payout
    for b in bookings:
        nights = b["nights"]
        refunded = b.get("refund_nights", 0)
        paid = nights - refunded
        if paid <= 0:
            continue                              # fully refunded: nothing to pay
        cleaning = b["cleaning"] if refunded == 0 else 0
        if nights >= LONG_STAY_NIGHTS:
            for p in range(nights // PERIOD_NIGHTS + 1):
                first = p * PERIOD_NIGHTS
                last = min(first + PERIOD_NIGHTS, nights)
                paid_here = max(0, last - max(first, refunded))
                gross = paid_here * b["rate"] + (cleaning if p == 0 else 0)
                lines.append((b["check_in"] + first + 1, b["host"],
                              gross - _host_fee(gross, fee_bps)))
        else:
            gross = paid * b["rate"] + cleaning
            lines.append((b["check_in"] + 1, b["host"], gross - _host_fee(gross, fee_bps)))
    transfers = {}
    for day, host, amount in lines:
        t = transfers.setdefault(day, [day, host, 0])
        t[2] += amount
    return sorted(transfers.values())
`;

export const prelude = `
def _gen_payout_bookings(n, seed):
    x, out = seed, []
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        long_stay = (x >> 16) % 8 == 0
        x = (1103515245 * x + 12345) % 2147483648
        nights = 28 + (x >> 8) % 70 if long_stay else 1 + (x >> 8) % 14
        x = (1103515245 * x + 12345) % 2147483648
        refund = 0 if (x >> 16) % 4 else (x >> 4) % (nights + 1)
        x = (1103515245 * x + 12345) % 2147483648
        out.append({'id': 'HM%07d' % i, 'host': 'h%04d' % ((x >> 8) % 5000),
                    'check_in': (x >> 4) % 365, 'nights': nights,
                    'rate': 4000 + (x >> 12) % 40000, 'cleaning': (x >> 6) % 9000,
                    'refund_nights': refund})
    return out
`.trim() + "\n";

// The specification, implemented independently of the Python reference: every
// night of a stay is assigned to its payout one at a time.
export function oracle(bookings, feeBps) {
  const fee = (g) => Math.floor((g * feeBps + 5000) / 10000);      // halves up, integers only
  const transfers = new Map();                                     // "day|host" -> [day, host, amount]
  for (const b of bookings) {
    const refunded = b.refund_nights || 0;
    const paid = b.nights - refunded;
    if (paid <= 0) continue;
    const monthly = b.nights >= 28;
    const gross = new Map();                                       // period -> cents
    for (let night = 0; night < paid; night++) {                   // the refunded nights are the last ones
      const p = monthly ? Math.floor(night / 30) : 0;
      gross.set(p, (gross.get(p) || 0) + b.rate);
    }
    gross.set(0, gross.get(0) + b.cleaning);
    for (const [p, g] of gross) {
      const day = b.check_in + 1 + 30 * p;
      const key = day + "|" + b.host;
      if (!transfers.has(key)) transfers.set(key, [day, b.host, 0]);
      transfers.get(key)[2] += g - fee(g);
    }
  }
  return [...transfers.values()].sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `'${k}': ${py(x)}`).join(", ") + "}";
}
const pyArgs = (bs, bps) => "(" + py(bs) + ", " + bps + ")";
const isHalf = (g, bps) => (g * bps) % 10000 === 5000 && Math.floor((g * bps) / 10000) % 2 === 0;

export function generate(r, level) {
  const bps = r.pick([300, 310, 350]);         // each has fees that land on exactly half a cent
  const hosts = r.sample(["h_maya", "h_omar", "h_lena", "h_tariq", "h_ines", "h_kenji", "h_ruth"], 3);
  let n = 0;
  const bid = () => "HM" + String(r.int(100000, 999999)) + String.fromCharCode(65 + (n++ % 26));
  const booking = (host, ci, nights, rate, cleaning, refund) =>
    ({ id: bid(), host, check_in: ci, nights, rate, cleaning, refund_nights: refund });

  function randomCase() {
    const bs = [];
    const k = level === 3 ? r.int(5, 7) : r.int(3, 5);
    const day0 = r.int(10, 200);
    for (let i = 0; i < k; i++) {
      const monthly = r.chance(0.35);
      const nights = monthly ? r.int(28, 75) : r.int(1, 12);
      let refund = 0;
      if (level >= 2 && r.chance(0.45)) refund = r.int(1, Math.max(1, nights - 1));
      if (level === 3 && r.chance(0.15)) refund = nights;                       // a full refund
      if (level === 3 && monthly && nights > 31 && r.chance(0.3)) refund = nights - 30 * Math.floor((nights - 1) / 30) + r.int(0, 2);
      const ci = level === 3 && i > 0 && r.chance(0.4) ? bs[i - 1].check_in : day0 + r.int(0, 20);
      bs.push(booking(r.pick(hosts), ci, nights, r.int(60, 400) * 100 + r.pick([0, 0, 50, 25]), r.pick([0, 2500, 4000, 6550, 9000]), Math.min(refund, nights)));
    }
    return bs;
  }
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const bs = randomCase();
    samples.push({ args: pyArgs(bs, bps), expect: py(oracle(bs, bps)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  // Rates whose grosses never land on a half cent of fee, so each check shows one bug.
  const safeRate = (nightsList, cleaning) => {
    for (;;) {
      const rate = r.int(80, 300) * 100 + r.pick([0, 50, 75]);
      if (nightsList.every((k) => !isHalf(k * rate + cleaning, bps) && !isHalf(k * rate, bps))) return rate;
    }
  };
  const [H, G] = hosts;
  const ci = r.int(20, 300);
  // A gross whose fee is exactly half a cent above an even number of cents.
  let half = null;
  while (!half) {
    const nights = r.int(2, 4), rate = r.int(80, 160) * 100;
    for (let g = nights * rate; g <= nights * rate + 12000; g += 1) if (isHalf(g, bps)) { half = { nights, rate, cleaning: g - nights * rate }; break; }
  }
  const sr = safeRate([3, 4, 5, 30, 35, 40], 0);
  const cl = r.pick([3000, 4500, 6000]);
  const sc = safeRate([2, 3, 4, 5, 6], cl);
  const edges = [
    ["two hosts paid on the same day get one transfer each",
      [booking(H, ci, 3, sr, 0, 0), booking(G, ci, 4, sr, 0, 0)]],
    ["one host's two stays released on the same day are one transfer",
      [booking(H, ci, 3, sr, 0, 0), booking(H, ci, 5, sr, 0, 0)]],
    ["a fee of exactly half a cent rounds up",
      [booking(H, ci, half.nights, half.rate, half.cleaning, 0)]],
    ["a partial refund on a long stay removes its last nights",
      [booking(H, ci, 40, sr, 0, 5)]],
    ["the cleaning fee stays with the host after a partial refund",
      [booking(H, ci, 6, sc, cl, 2)]],
    ["a long stay of exactly 60 nights has two payouts",
      [booking(H, ci, 60, sr, 0, 0)]],
    ["a stay of 27 nights is paid in one payout",
      [booking(H, ci, 27, sr, 0, 0)]],
    ["a stay of 28 nights is a monthly stay with one payout",
      [booking(H, ci, 28, sr, cl, 0)]],
    ["a stay of 31 nights pays the 31st night a month later",
      [booking(H, ci, 31, sr, 0, 0)]],
    ["a fully refunded stay pays nothing, cleaning included",
      [booking(H, ci, 5, sc, cl, 5), booking(G, ci + 2, 3, sc, cl, 0)]],
    ["a refund that empties a whole monthly period leaves no transfer for it",
      [booking(H, ci, 65, sr, 0, 5)]],
    ["a refund that ends exactly on a period boundary",
      [booking(H, ci, 70, sr, 0, 40)]],
  ];
  for (const [name, bs] of edges) tests.push({ name, args: pyArgs(bs, bps), expect: py(oracle(bs, bps)) });

  const N = 100000;
  tests.push({ name: `${N.toLocaleString("en-US")} bookings in time`, args: `(_gen_payout_bookings(${N}, ${r.int(1, 1_000_000)}), ${bps})`, limit_s: 8 });

  return {
    vars: {
      fee_pct: (bps / 100).toFixed(1) + "%",
      fee_bps: String(bps),
      replay_rule: level === 1
        ? "This replay has short and monthly stays and no refunds; the checks also cover refunds."
        : level === 2
          ? "This replay has short and monthly stays with partial refunds after cancellations."
          : "This replay has short and monthly stays, partial and full refunds, refunds that remove a whole monthly period, and several stays whose payouts are released on the same day.",
    },
    samples,
    tests,
  };
}
