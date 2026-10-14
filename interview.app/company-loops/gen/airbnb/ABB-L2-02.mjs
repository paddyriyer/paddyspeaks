/* ABB-L2-02 — Forward occupancy curve: share of the next nights already booked (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: for every listing and every date it walks the
   window night by night and asks each booking and block whether it covers the night.
   The evaluator's reference uses difference arrays and prefix sums, so each checks
   the other.
   level: 1 Medium (confirmed bookings only) · 2 Hard (+ host-blocked nights leave the
          denominator; a window with no available night is None) · 3 Very Hard
          (+ cancelled bookings, and overlapping confirmed bookings count a night once) */
export const kind = "python";
export const entry = "forward_occupancy";
export const signature = "def forward_occupancy(listings: list[str], bookings: list[tuple[str, int, int, str]], start: int, end: int, window: int = 30, blocked: dict[str, list[tuple[int, int]]] | None = None) -> dict[str, list[float | None]]:";
export const starter = `def forward_occupancy(listings, bookings, start, end, window=30, blocked=None):
    """bookings: (listing_id, check_in, check_out, status), nights check_in .. check_out - 1,
    as day numbers. For every listing and every date t in start .. end - 1, return the
    share of nights t .. t + window - 1 that are booked, rounded to 4 decimal places."""
    ...
`;

export const prelude = `
def _gen_stays(n, days, seed, messy):
    x, out = seed, []
    for i in range(n):
        lid, t = 'L%05d' % i, 0
        while t < days:
            x = (1103515245 * x + 12345) % 2147483648
            t += (x >> 8) % 6
            x = (1103515245 * x + 12345) % 2147483648
            nights = 1 + (x >> 8) % 9
            x = (1103515245 * x + 12345) % 2147483648
            k = (x >> 16) % 10
            out.append((lid, t, t + nights, 'cancelled' if messy and k == 0 else 'confirmed'))
            if messy and k == 1:
                out.append((lid, t + 1, t + nights + 2, 'confirmed'))
            t += nights
    return out


def _gen_blocks(n, days, seed):
    x, out = seed, {}
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        a = (x >> 8) % days
        x = (1103515245 * x + 12345) % 2147483648
        b = a + 1 + (x >> 8) % 20
        x = (1103515245 * x + 12345) % 2147483648
        c = (x >> 8) % days
        out['L%05d' % i] = [(a, b), (c, c + 3)]
    return out
`.trim() + "\n";

// Night by night, booking by booking. Small inputs only.
export function oracle(listings, bookings, start, end, window, blocked) {
  const out = {};
  for (const lid of listings) {
    const mine = bookings.filter(([l, , , s]) => l === lid && s === "confirmed");
    const blocks = (blocked && blocked[lid]) || [];
    const row = [];
    for (let t = start; t < end; t++) {
      let booked = 0, avail = 0;
      for (let night = t; night < t + window; night++) {
        const isBooked = mine.some(([, a, b]) => a <= night && night < b);
        const isBlocked = blocks.some(([a, b]) => a <= night && night < b);
        if (isBooked) booked++;
        if (isBooked || !isBlocked) avail++;
      }
      row.push(avail === 0 ? null : Number((booked / avail).toFixed(4)));
    }
    out[lid] = row;
  }
  return out;
}

const pyStr = (s) => "'" + s + "'";
const pyNum = (v) => (v === null ? "None" : String(v));
const pyArgs = (c) =>
  `([${c.ids.map(pyStr).join(", ")}], [${c.b.map(([l, a, b, s]) => `(${pyStr(l)}, ${a}, ${b}, ${pyStr(s)})`).join(", ")}], ` +
  `${c.start}, ${c.end}, ${c.w}, ` +
  (c.blk ? "{" + Object.entries(c.blk).map(([k, rs]) => `${pyStr(k)}: [${rs.map(([a, b]) => `(${a}, ${b})`).join(", ")}]`).join(", ") + "}" : "None") + ")";
const pyOut = (o) => "{" + Object.entries(o).map(([k, row]) => `${pyStr(k)}: [${row.map(pyNum).join(", ")}]`).join(", ") + "}";
const run = (c) => oracle(c.ids, c.b, c.start, c.end, c.w, c.blk);

function randomCase(r, level, ids) {
  const w = r.pick([7, 10, 14]);
  const start = r.int(0, 40), days = r.int(4, 7);
  const end = start + days;
  const b = [];
  for (const lid of ids) {
    let t = start - r.int(0, 6);
    while (t < end + w + 2) {
      t += r.int(0, 3);
      const nights = r.int(1, 5);
      b.push([lid, t, t + nights, level === 3 && r.chance(0.15) ? "cancelled" : "confirmed"]);
      if (level === 3 && r.chance(0.12)) b.push([lid, t + r.int(0, nights - 1), t + nights + r.int(0, 2), "confirmed"]);
      t += nights;
    }
  }
  if (r.chance(0.5)) b.push(["unlisted_" + r.int(10, 99), start, start + 3, "confirmed"]);   // not one of ours
  const blk = level >= 2 ? Object.fromEntries(ids.filter(() => r.chance(0.7)).map((lid) => {
    const a = start + r.int(0, days + w - 4);
    return [lid, [[a, a + r.int(1, 6)]]];
  })) : null;
  return { ids, b: r.shuffle(b), start, end, w, blk };
}

export function generate(r, level) {
  const ids = r.sample(["lst_" + r.int(1000, 4999), "cabin_" + r.int(10, 99), "loft_" + r.int(10, 99), "flat_" + r.int(100, 999), "villa_" + r.int(10, 99)], 3);
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const c = randomCase(r, level, ids.slice(0, 2 + i));
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [A, B] = ids;
  const s0 = r.int(100, 300);                    // a day number
  const ok = (l, a, b) => [l, s0 + a, s0 + b, "confirmed"];
  const w = 7;
  const edges = [
    ["the check-out night is not a booked night",
      { ids: [A], b: [ok(A, 0, 3)], start: s0, end: s0 + 4, w }],
    ["a stay that began before the first date counts only its nights inside each window",
      { ids: [A], b: [ok(A, -5, 2), ok(A, 4, 6)], start: s0, end: s0 + 3, w }],
    ["a stay that runs past the last window counts only the nights inside it",
      { ids: [A], b: [ok(A, 5, 20)], start: s0, end: s0 + 3, w }],
    ["a listing with no bookings reports 0 for every date",
      { ids: [A, B], b: [ok(A, 1, 3)], start: s0, end: s0 + 3, w }],
    ["a booking for a listing that is not in the list is ignored",
      { ids: [A], b: [ok(A, 2, 4), ["other_" + r.int(1, 9), s0, s0 + 9, "confirmed"]], start: s0, end: s0 + 2, w }],
    ["back-to-back stays fill the window exactly",
      { ids: [A], b: [ok(A, 0, 3), ok(A, 3, 7), ok(A, 7, 9)], start: s0, end: s0 + 3, w }],
    ["one date only",
      { ids: [A], b: [ok(A, 1, 2), ok(A, 4, 6)], start: s0, end: s0 + 1, w: 5 }],
    ["a thirty-night window",
      { ids: [A], b: [ok(A, 0, 10), ok(A, 12, 13), ok(A, 29, 31)], start: s0, end: s0 + 3, w: 30 }],
  ];
  if (level >= 2) {
    edges.push(["blocked nights leave the denominator",
      { ids: [A], b: [ok(A, 0, 2)], blk: { [A]: [[s0 + 3, s0 + 5]] }, start: s0, end: s0 + 3, w }]);
    edges.push(["a window with every night blocked is None, not 0",
      { ids: [A], b: [ok(A, 10, 12)], blk: { [A]: [[s0, s0 + 9]] }, start: s0, end: s0 + 6, w: 5 }]);
    edges.push(["a booked night that is also blocked counts as booked and available",
      { ids: [A], b: [ok(A, 1, 3)], blk: { [A]: [[s0 + 2, s0 + 5]] }, start: s0, end: s0 + 2, w }]);
    edges.push(["overlapping blocks remove a night once",
      { ids: [A], b: [ok(A, 0, 1)], blk: { [A]: [[s0 + 2, s0 + 5], [s0 + 4, s0 + 6]] }, start: s0, end: s0 + 2, w }]);
    edges.push(["a listing missing from blocked has no blocked nights",
      { ids: [A, B], b: [ok(A, 0, 2), ok(B, 0, 2)], blk: { [A]: [[s0 + 2, s0 + 4]] }, start: s0, end: s0 + 2, w }]);
  }
  if (level === 3) {
    const cx = (l, a, b) => [l, s0 + a, s0 + b, "cancelled"];
    edges.push(["a cancelled booking does not count",
      { ids: [A], b: [cx(A, 0, 4), ok(A, 5, 6)], start: s0, end: s0 + 2, w }]);
    edges.push(["two confirmed bookings on the same nights count each night once",
      { ids: [A], b: [ok(A, 0, 4), ok(A, 2, 6)], start: s0, end: s0 + 3, w }]);
    edges.push(["a cancelled booking does not remove the confirmed one on the same nights",
      { ids: [A], b: [ok(A, 1, 4), cx(A, 1, 4)], start: s0, end: s0 + 2, w }]);
    edges.push(["overlaps, a cancellation and a block together",
      { ids: [A, B], b: [ok(A, 0, 3), ok(A, 1, 5), cx(A, 5, 7), ok(B, 2, 3), cx(B, 0, 9)], blk: { [A]: [[s0 + 4, s0 + 8]], [B]: [[s0, s0 + 2]] }, start: s0, end: s0 + 4, w }]);
  }
  for (const [, c] of edges) {
    if (level === 1) c.blk = null;
    else if (!c.blk) c.blk = {};
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  // Timing: compared with the reference at check time. Rescanning each window is
  // n · dates · window; prefix sums make it n · (dates + window).
  const n = 2500, D = 420, W = 150;
  const seed = r.int(1, 1_000_000);
  tests.push({
    name: `${n.toLocaleString("en-US")} listings, ${D} dates and a ${W}-night window in time`,
    args: `([('L%05d' % i) for i in range(${n})], _gen_stays(${n}, ${D + W + 10}, ${seed}, ${level === 3 ? "True" : "False"}), 0, ${D}, ${W}, ` +
      `${level >= 2 ? `_gen_blocks(${n}, ${D + W}, ${seed + 1})` : "None"})`,
    limit_s: 8,
  });

  return {
    vars: {
      block_rule: level === 1
        ? "In this exercise `blocked` is None: every night is available."
        : "`blocked` maps a listing to half-open `(from, to)` ranges of nights the host has blocked; ranges may overlap, and a listing missing from it has none. A blocked night is not available and leaves the denominator, unless it is booked: a booked night always counts as booked and available. If no night of a window is available, the share is None.",
      status_rule: level === 3
        ? "`status` is 'confirmed' or 'cancelled'. Only confirmed bookings count. After a calendar sync problem, two confirmed bookings of the same listing can overlap; a night is booked once however many bookings cover it."
        : "Every booking in this exercise is 'confirmed', and a listing's bookings never overlap.",
    },
    samples,
    tests,
  };
}
