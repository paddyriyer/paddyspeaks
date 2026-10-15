/* BLK-L2-01 — Earliest free slot in a staff member's calendar, booked as you go (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: a minute-by-minute calendar scanned from
   minute 0 for every request (brute force, fine for the small cases). The
   evaluator's reference is a segment tree of free runs with lazy range
   assignment, written independently.
   level: 1 Medium (busy = closed hours only, bookings only) · 2 Hard (+ breaks and
          appointments already booked, unsorted and overlapping) · 3 Very Hard
          (+ cancellations that free a booking's minutes again) */
export const kind = "python";
export const entry = "book_appointments";
export const signature = "def book_appointments(horizon: int, busy: list[tuple[int, int]], requests: list[tuple[str, int]]) -> list[int]:";
export const starter = `def book_appointments(horizon, busy, requests):
    """horizon: minutes in the calendar; minute 0 is Monday 00:00 of the first week.
    busy: (start, end) half-open minute ranges that cannot be booked, in any order.
    requests, in order: ("book", length) books the earliest start s with minutes
    s .. s + length - 1 all free and s + length <= horizon, or gets -1;
    ("cancel", i) frees the booking made by requests[i] and gets its start,
    or -1 if that booking failed or was already cancelled.
    Return one int per request."""
    ...
`;

export const prelude = `
def _gen_calendar(weeks, n, cancels, seed):
    x = seed
    horizon = weeks * 7 * 1440
    busy = []
    for d in range(weeks * 7):
        base = d * 1440
        if d % 7 == 6:
            busy.append((base, base + 1440))
            continue
        busy.append((base, base + 540))
        busy.append((base + 780, base + 810))
        busy.append((base + 1140, base + 1440))
        t = base + 540
        while t < base + 1140:
            x = (1103515245 * x + 12345) % 2147483648
            if (x >> 16) % 100 < 55 - 25 * (d // 7):
                ln = 15 * (1 + (x >> 8) % 6)
                busy.append((t, min(t + ln, base + 1140)))
                t += ln + (x >> 4) % 7
            else:
                t += 5 + (x >> 4) % 20
    x = (1103515245 * x + 12345) % 2147483648
    k = (x >> 16) % len(busy)
    busy = busy[k:] + busy[:k]
    requests, books = [], []
    lengths = (15, 20, 30, 45, 60, 75, 90, 120)
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        if cancels and books and (x >> 16) % 100 < 45:
            x = (1103515245 * x + 12345) % 2147483648
            requests.append(('cancel', books[(x >> 16) % len(books)]))
        else:
            requests.append(('book', lengths[(x >> 16) % 8]))
            books.append(i)
    return horizon, busy, requests
`.trim() + "\n";

// Brute force on a minute array: scan from minute 0 for each booking.
export function oracle(horizon, busy, requests) {
  const free = new Array(horizon).fill(true);
  for (const [s, e] of busy) for (let m = s; m < e; m++) free[m] = false;
  const out = [];
  const booked = new Map();                 // request index -> [start, length]
  requests.forEach(([kind, x], i) => {
    if (kind === "book") {
      let start = -1;
      for (let s = 0; s + x <= horizon && start < 0; s++) {
        let ok = true;
        for (let m = s; m < s + x; m++) if (!free[m]) { ok = false; break; }
        if (ok) start = s;
      }
      if (start >= 0) {
        for (let m = start; m < start + x; m++) free[m] = false;
        booked.set(i, [start, x]);
      }
      out.push(start);
    } else {
      const got = booked.get(x);
      if (!got) { out.push(-1); return; }
      booked.delete(x);
      for (let m = got[0]; m < got[0] + got[1]; m++) free[m] = true;
      out.push(got[0]);
    }
  });
  return out;
}

const pyList = (xs) => "[" + xs.join(", ") + "]";
const pyArgs = (horizon, busy, requests) =>
  `(${horizon}, [${busy.map(([s, e]) => `(${s}, ${e})`).join(", ")}], [${requests.map(([k, x]) => `('${k}', ${x})`).join(", ")}])`;

// One or two days: closed before opening and after closing, plus (level 2+) a break
// and appointments already booked, listed in shuffled order with some overlaps.
function smallCase(r, level) {
  const days = level === 1 ? 1 : r.int(1, 2);
  const horizon = days * 1440;
  const open = 60 * r.int(7, 10), close = 60 * r.int(16, 19);
  const busy = [];
  for (let d = 0; d < days; d++) {
    const b = d * 1440;
    busy.push([b, b + open], [b + close, b + 1440]);
    if (level >= 2) {
      const brk = b + 60 * r.int(12, 13) + r.pick([0, 15, 30]);
      busy.push([brk, brk + r.pick([30, 45, 60])]);
      for (let k = r.int(2, 4); k > 0; k--) {
        const s = b + open + 5 * r.int(0, Math.floor((close - open - 30) / 5));
        busy.push([s, Math.min(s + r.pick([15, 20, 30, 45, 60]), b + close)]);
      }
      if (r.chance(0.5)) { const s = b + open + 25; busy.push([s, s + 50]); busy.push([s + 20, s + 40]); }   // overlaps
    }
  }
  const lengths = [15, 30, 45, 60, 90, 120, 240];
  const requests = [];
  const n = level === 1 ? r.int(5, 7) : r.int(7, 10);
  const cancelled = new Set();
  for (let i = 0; i < n; i++) {
    const open = requests.map((q, j) => (q[0] === "book" && !cancelled.has(j) ? j : -1)).filter((j) => j >= 0);
    if (level === 3 && open.length && r.chance(0.3)) {
      const j = cancelled.size && r.chance(0.2) ? r.pick([...cancelled]) : r.pick(open);   // now and then a repeat
      cancelled.add(j);
      requests.push(["cancel", j]);
    } else requests.push(["book", r.pick(lengths)]);
  }
  if (level === 1) requests.push(["book", close - open + 15]);       // longer than a whole day's opening
  return { horizon, busy: r.shuffle(busy), requests };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = smallCase(r, level);
    samples.push({ args: pyArgs(c.horizon, c.busy, c.requests), expect: pyList(oracle(c.horizon, c.busy, c.requests)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const g = 5 * r.int(6, 24);                  // a free gap of g minutes
  const a = 5 * r.int(4, 20);
  const edges = [
    ["a request exactly as long as a gap fills it", 600, [[0, a], [a + g, 600]], [["book", g]]],
    ["one minute longer than every gap: -1", 600, [[0, a], [a + g, 600]], [["book", g + 1]]],
    ["the earliest fit comes after a gap that is too short for it", 600, [[0, a], [a + 20, a + 50], [a + 50 + g, 600]], [["book", g], ["book", 15]]],
    ["busy ranges arrive out of order, overlap and touch", 720, [[300, 400], [100, 200], [150, 320], [400, 450], [0, 60]], [["book", 40], ["book", 60], ["book", 300], ["book", 210]]],
    ["a booking may end exactly at the end of the calendar", 120, [[0, 60]], [["book", 60], ["book", 1]]],
    ["requests are served in order, and the calendar fills up", 180, [[0, 60], [120, 180]], [["book", 30], ["book", 30], ["book", 1]]],
    ["a free run that straddles the middle of the calendar", 1024, [[0, 500], [530, 1024]], [["book", 30]]],
    ["no busy ranges: the first booking starts at minute 0", 1440, [], [["book", 45], ["book", 45], ["book", 1440]]],
  ];
  if (level === 3) {
    edges.push(["a cancelled booking's minutes can be booked again", 300, [[0, 120]], [["book", 60], ["book", 60], ["cancel", 0], ["book", 45]]]);
    edges.push(["cancelling a booking that failed gets -1", 200, [[0, 150]], [["book", 60], ["cancel", 0], ["book", 50]]]);
    edges.push(["cancelling the same booking twice: the second gets -1", 300, [[0, 120]], [["book", 30], ["cancel", 0], ["cancel", 0], ["book", 30]]]);
    edges.push(["freed minutes join their free neighbours", 400, [[0, 100], [250, 400]], [["book", 50], ["book", 50], ["book", 50], ["cancel", 1], ["book", 100], ["cancel", 0], ["book", 100]]]);
  }
  for (const [name, h, b, q] of edges) tests.push({ name, args: pyArgs(h, b, q), expect: pyList(oracle(h, b, q)) });

  // Timing. A scan of the minutes costs O(horizon) for every request, and once the
  // calendar is full every request scans it all; the segment tree answers a
  // request that cannot fit in O(1) and one that fits in O(log horizon).
  const weeks = level === 1 ? 4 : level === 2 ? 6 : 8;
  const n = level === 1 ? 12000 : level === 2 ? 10000 : 12000;
  tests.push({
    name: `${weeks} weeks (${(weeks * 10080).toLocaleString("en-US")} minutes), ${n.toLocaleString("en-US")} requests${level === 3 ? " with cancellations" : ""} in time`,
    args: `_gen_calendar(${weeks}, ${n}, ${level === 3 ? "True" : "False"}, ${r.int(1, 1_000_000)})`,
    limit_s: 8,
  });

  return {
    vars: {
      weeks,
      busy_rule: level === 1
        ? "In this replay `busy` holds only the hours the location is closed; the checks also include ranges that overlap or arrive out of order."
        : "Here `busy` holds the closed hours, the staff member's breaks and appointments already booked, in any order, and ranges may overlap or touch.",
      cancel_rule: level === 3
        ? "Requests also include `(\"cancel\", i)`, where `i` is the index in `requests` of an earlier booking request. If that booking succeeded and has not been cancelled yet, its minutes become free again and the result is its start minute. Otherwise the result is -1."
        : "Every request in this replay is a booking; there are no cancellations.",
    },
    samples,
    tests,
  };
}
