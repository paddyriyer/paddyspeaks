/* STR-L1-05 — Card-testing velocity: first time a card reaches K merchants within T seconds (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (python).
   level: 1 Medium (every attempt counts)
          2 Hard (+ only declined attempts count)
          3 Very Hard (+ many attempts share a timestamp, including on the window boundary) */
export const kind = "python";
export const entry = "first_flags";
export const signature = "def first_flags(events: list[tuple[int, str, str, str]], k: int, window_s: int, declined_only: bool = False) -> dict[str, int]:";
export const starter = `from collections import deque

def first_flags(events, k, window_s, declined_only=False):
    """events: (ts, card_fingerprint, merchant_id, outcome) sorted by ts;
    outcome is 'approved' or 'declined'.
    Return {card_fingerprint: first ts at which the card reached k distinct
    merchants within window_s seconds}. Cards that never do are absent."""
    ...
`;

export const prelude = `
def _gen_card_events(n, n_cards, n_merchants, seed, step_max=2, stray=8192, declined_pct=30):
    x, ts, out = seed, 0, []
    for _ in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        ts += (x >> 16) % (step_max + 1)
        x = (1103515245 * x + 12345) % 2147483648
        c = (x >> 16) % n_cards
        x = (1103515245 * x + 12345) % 2147483648
        if (x >> 8) % stray == 0:
            m = (x >> 16) % n_merchants
        else:
            m = (c * 7 + (x >> 16) % 2) % n_merchants
        x = (1103515245 * x + 12345) % 2147483648
        out.append((ts, 'fp_%04d' % c, 'acct_%03d' % m, 'declined' if (x >> 16) % 100 < declined_pct else 'approved'))
    return out
`.trim() + "\n";

// Brute force: for every counted event, rescan the card's counted events in [ts - T, ts].
export function oracle(events, k, T, declinedOnly) {
  const counted = events.filter((e) => !declinedOnly || e[3] === "declined");
  const out = {};
  for (const [t, card] of counted) {
    if (card in out) continue;
    const ms = new Set();
    for (const [t2, c2, m2] of counted) if (c2 === card && t2 >= t - T && t2 <= t) ms.add(m2);
    if (ms.size >= k) out[card] = t;
  }
  return out;
}

const pyDict = (o) => "{" + Object.keys(o).sort().map((c) => `'${c}': ${o[c]}`).join(", ") + "}";
const pyArgs = (evs, k, T, d) => `([${evs.map(([t, c, m, o]) => `(${t}, '${c}', '${m}', '${o}')`).join(", ")}], ${k}, ${T}, ${d ? "True" : "False"})`;

const CARDS = ["fp_9xKq", "fp_A7td", "fp_Lm3z", "fp_Qw81", "fp_Zr5c"];
const MERCH = ["acct_arcade", "acct_bistro", "acct_cinema", "acct_deli", "acct_eyewear", "acct_florist", "acct_garage"];

function smallCase(r, level, k, T) {
  const cards = r.sample(CARDS, 3);
  const merch = r.sample(MERCH, 6);
  const declined = level >= 2;
  const evs = [];
  let t = r.int(0, 1000);
  // Background traffic on each card's two usual merchants.
  for (let i = 0; i < 8; i++) {
    t += level === 3 && r.chance(0.35) ? 0 : r.pick([5, 30, Math.floor(T / 3), T]);
    const c = r.pick(cards), ci = cards.indexOf(c);
    evs.push([t, c, merch[(ci * 2 + r.int(0, 1)) % merch.length], declined && r.chance(0.5) ? "declined" : "approved"]);
  }
  // A burst on one card: k merchants, spread over a span near T (sometimes just over it).
  const c = cards[r.int(0, 2)];
  const span = r.pick([T - 1, T, T + 1, Math.floor(T / 2)]);
  const bm = r.sample(merch, k);
  const start = t + r.int(1, 50);
  bm.forEach((m, i) => {
    const bt = i === bm.length - 1 ? start + span : start + Math.floor((span * i) / bm.length);
    evs.push([bt, c, m, declined && i === 1 && r.chance(0.4) ? "approved" : "declined"]);
  });
  evs.sort((a, b) => a[0] - b[0]);
  return evs;
}

export function generate(r, level) {
  const k = r.pick([3, 4]);
  const T = r.pick([300, 600, 900]);
  const dOnly = level >= 2;
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const evs = smallCase(r, level, k, T);
    samples.push({ args: pyArgs(evs, k, T, dOnly), expect: pyDict(oracle(evs, k, T, dOnly)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const W = r.pick([60, 120, 3600]);
  const c1 = r.pick(CARDS), c2 = CARDS.find((x) => x !== c1);
  const D = "declined";
  const edges = [
    ["an attempt exactly window_s earlier is still inside the window", [[0, c1, "m1", D], [W, c1, "m2", D]], 2, W],
    ["one second further and it has left", [[0, c1, "m1", D], [W + 1, c1, "m2", D]], 2, W],
    ["repeat attempts at one merchant count once", [[0, c1, "m1", D], [1, c1, "m1", D], [2, c1, "m1", D]], 2, W],
    ["a merchant stays counted while a later attempt there is in the window", [[0, c1, "m1", D], [Math.floor(W / 2), c1, "m1", D], [W + 1, c1, "m2", D], [W + 2, c1, "m3", D]], 3, W],
    ["only the first qualifying timestamp is reported", [[0, c1, "m1", D], [5, c1, "m2", D], [9, c1, "m3", D], [12, c1, "m4", D]], 2, W],
    ["cards are tracked independently", [[0, c1, "m1", D], [1, c2, "m2", D], [2, c1, "m3", D], [3, c2, "m4", D]], 2, W],
  ];
  if (level >= 2) {
    edges.push(["approved attempts do not count when declined_only", [[0, c1, "m1", "approved"], [1, c1, "m2", D], [2, c1, "m3", "approved"]], 2, W]);
  }
  if (level === 3) {
    edges.push(["several attempts at the same second on the boundary", [[0, c1, "m1", D], [0, c1, "m2", D], [W, c1, "m3", D], [W, c1, "m3", D]], 3, W]);
    edges.push(["equal timestamps just past the boundary", [[0, c1, "m1", D], [0, c1, "m2", D], [W + 1, c1, "m3", D], [W + 1, c1, "m4", D]], 3, W]);
  }
  for (const [name, evs, kk, ww] of edges) tests.push({ name, args: pyArgs(evs, kk, ww, dOnly), expect: pyDict(oracle(evs, kk, ww, dOnly)) });

  // Timing: few cards with heavy repeat traffic at two usual merchants and rare strays, so each
  // card's window holds thousands of attempts and a few cards cross the threshold late;
  // recounting distinct merchants over the window per attempt is far too slow.
  const seed = r.int(1, 1_000_000);
  const n = level === 1 ? 150000 : 200000;
  const nCards = level === 1 ? 10 : 8;
  const Tbig = level === 1 ? 20000 : 30000;
  const step = level === 3 ? 1 : 2;
  const pct = level === 1 ? 30 : 60;
  tests.push({
    name: `${n.toLocaleString("en-US")} attempts in time (O(1) amortised per attempt)`,
    args: `(_gen_card_events(${n}, ${nCards}, 400, ${seed}, ${step}, ${level === 3 ? 2048 : 1536}, ${pct}), 6, ${Tbig}, ${dOnly ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      k,
      window_s: T,
      count_rule: dOnly
        ? "`declined_only` is True: only attempts with outcome 'declined' count; approved attempts are ignored entirely."
        : "`declined_only` is False: every attempt counts, approved or declined.",
      tie_rule:
        level === 3
          ? "Many attempts share a timestamp, including exactly on the window boundary."
          : "Timestamps are non-decreasing integers.",
    },
    samples,
    tests,
  };
}
