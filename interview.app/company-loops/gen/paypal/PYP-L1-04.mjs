/* PYP-L1-04 — Mutual payers: pairs who paid each other in both directions within a
   window, the first reciprocating payment, its gap and how many there were (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which compares every payment with every earlier
   one (O(n²), small inputs only). The evaluator's reference sorts once and keeps the
   latest time per direction in a hash map, so each checks the other.
   level: 1 Medium (sorted input, every payment completed)
          2 Hard (+ input in any order, failed and refunded payments, payments to oneself)
          3 Very Hard (+ recipients named by email or phone identifiers resolved through an
                  alias map; unclaimed identifiers ignored) */
export const kind = "python";
export const entry = "mutual_payers";
export const signature = "def mutual_payers(payments: list[tuple[int, str, str, int, str]], window_days: int, aliases: dict[str, str] | None = None) -> dict[tuple[str, str], tuple[int, int, int]]:";
export const starter = `def mutual_payers(payments, window_days, aliases=None):
    """payments: (payment_id, sender, recipient, ts, status); ts in seconds.
    Return {(a, b): (first_payment_id, gap_seconds, reciprocating_count)} with a < b,
    for every pair of users that paid each other in both directions within the window."""
    ...
`;

export const prelude = `
def _gen_payments(n, n_users, seed, window_days, active=3, per_dir=8000, statuses=False, shuffle=False, aliases=False):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    W = window_days * 86400
    year = 365 * 86400
    users = ['u_%06d' % (k * 13 + 100000) for k in range(n_users)]
    out, pid, alias = [], 1, {}
    if aliases:
        for k in range(0, n_users, 3):
            alias['email:%d@example.test' % k] = users[k]
            alias['phone:+1555%07d' % k] = users[k]
    alias_keys = sorted(alias)
    st = ('completed',) * 6 + ('refunded', 'failed')
    for _ in range(n):
        a = users[nxt() % n_users]
        rec = users[nxt() % n_users]
        if aliases and nxt() % 10 == 0:
            rec = alias_keys[nxt() % len(alias_keys)] if nxt() % 4 else 'email:unclaimed%d@example.test' % (nxt() % 999)
        s = st[nxt() % len(st)] if statuses else 'completed'
        out.append((pid, a, rec, nxt() % year, s))
        pid += 1
    for k in range(active):                    # very active pairs: one direction for months, then the other
        a, b = 'v_%03d_a' % k, 'v_%03d_b' % k
        t1 = year // 3
        for i in range(per_dir):
            out.append((pid, a, b, (t1 * i) // per_dir, 'completed'))
            pid += 1
        start = t1 + W + 1
        for i in range(per_dir):
            out.append((pid, b, a, start + (t1 * i) // per_dir, 'completed'))
            pid += 1
        out.append((pid, a, b, start + t1 + 5, 'completed'))
        pid += 1
    if shuffle:
        for i in range(len(out) - 1, 0, -1):
            j = nxt() % (i + 1)
            out[i], out[j] = out[j], out[i]
    else:
        out.sort(key=lambda p: (p[3], p[0]))
    return (out, window_days, alias) if aliases else (out, window_days)
`.trim() + "\n";

// Brute force: every payment against every earlier payment. Small inputs only.
export function oracle(payments, windowDays, aliases) {
  const W = windowDays * 86400;
  const al = aliases || {};
  const counted = [];
  for (const [id, s, rec0, t, status] of payments) {
    if (status !== "completed") continue;
    let rec = rec0;
    if (rec.includes(":")) { if (!(rec in al)) continue; rec = al[rec]; }
    if (rec === s) continue;
    counted.push({ id, s, rec, t });
  }
  counted.sort((a, b) => a.t - b.t || a.id - b.id);
  const out = new Map();
  for (let j = 0; j < counted.length; j++) {
    const p = counted[j];
    let best = null;
    for (let i = 0; i < j; i++) {
      const q = counted[i];
      if (q.s === p.rec && q.rec === p.s && p.t - q.t <= W && (best === null || q.t > best)) best = q.t;
    }
    if (best === null) continue;
    const key = p.s < p.rec ? [p.s, p.rec] : [p.rec, p.s];
    const k = key.join("|");
    const got = out.get(k);
    if (!got) out.set(k, { key, first: p.id, gap: p.t - best, n: 1 });
    else got.n += 1;
  }
  return [...out.values()].sort((a, b) => (a.key.join("|") < b.key.join("|") ? -1 : 1));
}

const pyS = (s) => "'" + s + "'";
const pyArgs = (c) =>
  "([" + c.payments.map(([id, s, rec, t, st]) => `(${id}, ${pyS(s)}, ${pyS(rec)}, ${t}, ${pyS(st)})`).join(", ") + `], ${c.window}` +
  (c.aliases ? ", {" + Object.entries(c.aliases).map(([k, v]) => `${pyS(k)}: ${pyS(v)}`).join(", ") + "}" : "") + ")";
const pyOut = (rows) => "{" + rows.map((x) => `(${pyS(x.key[0])}, ${pyS(x.key[1])}): (${x.first}, ${x.gap}, ${x.n})`).join(", ") + "}";
const run = (c) => oracle(c.payments, c.window, c.aliases);

const NAMES = ["ana", "bo", "cy", "dee", "eli", "fay", "gus", "hal", "ivy", "jo", "kit", "lu", "max", "ned"];
const D = 86400;

function randomCase(r, level, window) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const users = r.sample(NAMES, level === 1 ? 4 : 5).map((n) => "u_" + n).sort();
    const aliases = level === 3 ? {} : null;
    if (aliases) for (const u of r.sample(users, 2)) aliases["email:" + u.slice(2) + "@example.test"] = u;
    const payments = [];
    let id = r.int(100, 900);
    let t = r.int(0, 5) * D;
    const n = r.int(9, 13);
    for (let i = 0; i < n; i++) {
      t += r.pick([0, D, 3 * D, (window - 1) * D, window * D, (window + 2) * D, 3600]);
      const s = r.pick(users);
      let rec = r.pick(users.filter((u) => u !== s));
      let status = "completed";
      if (level >= 2 && r.chance(0.12)) status = r.pick(["failed", "refunded"]);
      if (level >= 2 && r.chance(0.06)) rec = s;
      if (aliases && r.chance(0.25)) {
        const keys = Object.keys(aliases);
        rec = r.chance(0.7) ? r.pick(keys) : "phone:+15550" + r.int(100000, 999999);
      }
      payments.push([id, s, rec, t, status]);
      id += r.int(1, 9);
    }
    const c = { payments: level === 1 ? payments : r.shuffle(payments), window, aliases };
    const got = run(c);
    if (got.length >= 1 && got.length < users.length * 2) return c;
  }
  throw new Error("PYP-L1-04: could not build a sample with a mutual pair");
}

export function generate(r, level) {
  const window = level === 1 ? 30 : r.pick([7, 14, 30]);
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level, window);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [A, B, C] = r.sample(NAMES, 3).map((n) => "u_" + n).sort();
  const W = window * D;
  const t0 = r.int(1, 9) * D + r.int(0, 3600);
  const P = (id, s, rec, t, st = "completed") => [id, s, rec, t, st];
  const edges = [
    ["exactly window_days apart reciprocates", [P(1, A, B, t0), P(2, B, A, t0 + W)]],
    ["one second more does not", [P(1, A, B, t0), P(2, B, A, t0 + W + 1)]],
    ["payments in one direction only are not mutual", [P(1, A, B, t0), P(2, A, B, t0 + 60), P(3, A, B, t0 + 120)]],
    ["the gap is to the latest earlier payment the other way", [P(1, A, B, t0), P(2, A, B, t0 + 3 * D), P(3, B, A, t0 + 4 * D)]],
    ["same second: the lower payment_id came first", [P(8, B, A, t0), P(5, A, B, t0)]],
    ["back and forth counts every reciprocating payment", [P(1, A, B, t0), P(2, B, A, t0 + D), P(3, A, B, t0 + 2 * D), P(4, B, A, t0 + W + 3 * D)]],
    ["the key is the sorted pair, whoever paid first", [P(1, B, A, t0), P(2, A, B, t0 + 7200)]],
    ["three users, two pairs", [P(1, A, B, t0), P(2, C, A, t0 + 60), P(3, B, A, t0 + 120), P(4, A, C, t0 + 180), P(5, B, C, t0 + 240)]],
    ["no payments at all", []],
  ];
  if (level >= 2) {
    edges.push(["arrives out of order: the first is by time, not by list position", [P(9, B, A, t0 + 5 * D), P(3, A, B, t0), P(4, B, A, t0 + D)]]);
    edges.push(["failed and refunded payments never count", [P(1, A, B, t0, "failed"), P(2, B, A, t0 + D), P(3, A, B, t0 + 2 * D, "refunded"), P(4, A, B, t0 + 3 * D)]]);
    edges.push(["a payment to oneself is ignored", [P(1, A, A, t0), P(2, A, A, t0 + 60)]]);
  }
  const al = {};
  if (level === 3) {
    al["email:" + B.slice(2) + "@example.test"] = B;
    al["phone:+15550100" + r.int(10, 99)] = A;
    const eB = "email:" + B.slice(2) + "@example.test";
    const pA = Object.keys(al).find((k) => k.startsWith("phone:"));
    edges.push(["a payment to an email identifier is a payment to its owner", [P(1, A, eB, t0), P(2, B, A, t0 + D)]]);
    edges.push(["an unclaimed identifier belongs to nobody", [P(1, A, "email:nobody@example.test", t0), P(2, B, A, t0 + D)]]);
    edges.push(["paying your own phone identifier is paying yourself", [P(1, A, pA, t0), P(2, B, eB, t0 + 60)]]);
  }
  for (const [name, payments] of edges) {
    const c = { payments, window, aliases: level === 3 ? al : null };
    tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });
  }

  // Timing: compared with the reference at check time. 250 000 random payments plus
  // three very active pairs that pay one way for months and then the other way.
  const seed = r.int(1, 1_000_000);
  const opts = level === 1 ? "" : level === 2 ? ", statuses=True, shuffle=True" : ", statuses=True, shuffle=True, aliases=True";
  tests.push({
    name: "250,000 payments with three very active pairs in time",
    args: `_gen_payments(250000, 40000, ${seed}, ${window}, 3, 8000${opts})`,
    limit_s: 8,
  });

  return {
    vars: {
      window_days: window,
      order_rule: level === 1
        ? "`payments` is sorted by `(ts, payment_id)` and every payment has `status = 'completed'`."
        : "`payments` arrives in any order. Only `status = 'completed'` payments count (`failed` and `refunded` never do), and a payment whose recipient is its sender is ignored.",
      alias_rule: level === 3
        ? "A recipient may be an identifier such as `'email:…'` or `'phone:…'`: `aliases` maps each claimed identifier to its user. A payment to an identifier missing from `aliases` was never claimed and is ignored; a payment to one's own identifier is a payment to oneself."
        : "Every recipient is a user id; `aliases` is not passed.",
    },
    samples,
    tests,
  };
}
