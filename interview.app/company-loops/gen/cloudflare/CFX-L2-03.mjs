/* CFX-L2-03 — Debug the zone analytics rollup (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template
   (BigInt for nanoseconds, its own IPv6 expansion).
   Planted bugs (see the evaluator notes): retried deliveries are de-duplicated by
   (batch, ray) instead of the ray id; the hour comes from a float division of the
   nanosecond timestamp; bytes are not weighted by the sample interval; "revalidated"
   and "updating" are not counted as cached; IPv6 clients are grouped by the first four
   text groups instead of the /64 prefix.
   level: 1 Medium (one zone, IPv4 clients, no retries) · 2 Hard (+ several zones,
          retried deliveries, IPv6) · 3 Very Hard (+ compressed and upper-case IPv6,
          lines at the last nanosecond of an hour) */
export const kind = "debug";
export const entry = "zone_rollup";
export const signature = "def zone_rollup(lines: list[dict]) -> list[list]:";
export const starter = `CACHED = {"hit"}


def _network(ip):
    if ":" in ip:
        return ":".join(ip.split(":")[:4])          # IPv6: group by /64
    return ip


def zone_rollup(lines):
    seen = set()
    rows = {}
    for ln in lines:
        rid = (ln["batch"], ln["ray"])
        if rid in seen:
            continue
        seen.add(rid)
        hour = int(ln["ts_ns"] / 1e9) // 3600 * 3600
        w = ln["sample_interval"]
        r = rows.get((ln["zone"], hour))
        if r is None:
            r = rows[(ln["zone"], hour)] = [0, 0, 0, set()]
        r[0] += w
        r[1] += ln["bytes"]
        if ln["cache_status"] in CACHED:
            r[2] += ln["bytes"] * w
        r[3].add(_network(ln["client_ip"]))
    return [[z, h, r[0], r[1], r[2], len(r[3])] for (z, h), r in sorted(rows.items())]
`;

export const prelude = `
def _gen_log_lines(n, seed, start_ns=1760000000 * 10**9):
    x, out = seed, []
    zones = ['zone-%d.example' % i for i in range(12)]
    statuses = ['hit', 'miss', 'expired', 'revalidated', 'updating', 'bypass', 'dynamic']
    for i in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        k = (x >> 16) % 100
        x = (1103515245 * x + 12345) % 2147483648
        if k < 6 and out:
            dup = dict(out[(x >> 8) % len(out)])
            dup['batch'] = 'b%d' % (i // 500 + 1)
            out.append(dup)
            continue
        if k < 40:
            ip = '2001:db8:%x:%x::%x' % ((x >> 8) % 7, (x >> 12) % 300, (x >> 4) % 4000)
        else:
            ip = '198.51.%d.%d' % ((x >> 8) % 20, (x >> 16) % 250)
        out.append({'zone': zones[(x >> 20) % 12], 'ray': 'r%07x' % i, 'batch': 'b%d' % (i // 500),
                    'ts_ns': start_ns + i * 1300000000 + (x % 1000000000),
                    'sample_interval': (1, 1, 10, 100)[(x >> 6) % 4], 'bytes': 200 + (x >> 3) % 90000,
                    'cache_status': statuses[(x >> 10) % 7], 'client_ip': ip})
    return out
`.trim() + "\n";

const CACHED = new Set(["hit", "revalidated", "updating"]);
const NS_HOUR = 3600n * 1000000000n;

// The /64 network of an IPv6 address, or the IPv4 address itself.
function network(ip) {
  if (!ip.includes(":")) return "4|" + ip;
  const [head, tail] = ip.toLowerCase().split("::");
  const hs = head ? head.split(":") : [];
  const ts = tail === undefined ? [] : tail ? tail.split(":") : [];
  const groups = tail === undefined ? hs : [...hs, ...Array(8 - hs.length - ts.length).fill("0"), ...ts];
  return "6|" + groups.slice(0, 4).map((g) => parseInt(g, 16)).join(":");
}

export function oracle(lines) {
  const seen = new Set();
  const acc = new Map();
  for (const l of lines) {
    if (seen.has(l.ray)) continue;
    seen.add(l.ray);
    const hour = Number((BigInt(l.ts_ns) / NS_HOUR) * 3600n);
    const key = l.zone + "\u0000" + String(hour).padStart(12, "0");
    if (!acc.has(key)) acc.set(key, { zone: l.zone, hour, req: 0, bytes: 0, cached: 0, nets: new Set() });
    const a = acc.get(key);
    a.req += l.sample_interval;
    a.bytes += l.bytes * l.sample_interval;
    if (CACHED.has(l.cache_status)) a.cached += l.bytes * l.sample_interval;
    a.nets.add(network(l.client_ip));
  }
  return [...acc.keys()].sort().map((k) => { const a = acc.get(k); return [a.zone, a.hour, a.req, a.bytes, a.cached, a.nets.size]; });
}

const q = (s) => "'" + s + "'";
const pyLine = (l) => `{'zone': ${q(l.zone)}, 'ray': ${q(l.ray)}, 'batch': ${q(l.batch)}, 'ts_ns': ${l.ts_ns}, 'sample_interval': ${l.sample_interval}, 'bytes': ${l.bytes}, 'cache_status': ${q(l.cache_status)}, 'client_ip': ${q(l.client_ip)}}`;
const pyArgs = (ls) => "([" + ls.map(pyLine).join(", ") + "],)";
const pyOut = (rows) => "[" + rows.map((x) => `[${q(x[0])}, ${x[1]}, ${x[2]}, ${x[3]}, ${x[4]}, ${x[5]}]`).join(", ") + "]";

const ZONES = ["shop.example", "news.example", "api.example", "docs.example", "media.example", "status.example"];
const STATUSES = ["hit", "miss", "expired", "revalidated", "updating", "bypass", "dynamic"];
let rayNo = 0;

// ts_ns as a decimal string: hour start (epoch seconds) plus nanoseconds into the hour.
const tsNs = (hourStart, nsInto) => (BigInt(hourStart) * 1000000000n + BigInt(nsInto)).toString();

function v4(r) { return `203.0.113.${r.int(1, 254)}`; }
function v6(r, level) {
  const p = [0x2001, 0xdb8, r.int(0, 3), r.int(0, 2)];
  const h = r.int(1, 4095).toString(16);
  if (level < 3) return `${p[0].toString(16)}:${p[1].toString(16)}:${p[2].toString(16)}:${p[3].toString(16)}:0:0:0:${h}`;
  const forms = [
    `${p.map((x) => x.toString(16)).join(":")}::${h}`,
    `${p.map((x) => x.toString(16)).join(":")}:0:0:0:${h}`,
    `${p.map((x) => x.toString(16).toUpperCase()).join(":")}::${h.toUpperCase()}`,
  ];
  if (p[2] === 0 && p[3] === 0) forms.push(`2001:db8::${h}`);
  return r.pick(forms);
}

function streamCase(r, level, hour0) {
  const zones = level === 1 ? r.sample(ZONES, 1) : r.sample(ZONES, 2);
  const out = [];
  const nl = level === 1 ? r.int(6, 9) : r.int(9, 13);
  for (let i = 0; i < nl; i++) {
    if (level >= 2 && out.length && r.chance(0.15)) {
      out.push({ ...r.pick(out), batch: "b" + r.int(50, 99) });            // a retried delivery
      continue;
    }
    const hour = hour0 + 3600 * r.int(0, 1);
    let ns = r.int(0, 3599) * 1000000000 + r.int(0, 999999);
    if (level === 3 && r.chance(0.2)) ns = 3600 * 1000000000 - r.int(1, 100);       // the hour's last nanoseconds
    out.push({
      zone: r.pick(zones), ray: "7d" + (++rayNo).toString(16).padStart(6, "0") + "a" + r.int(10, 99), batch: "b" + r.int(1, 9),
      ts_ns: tsNs(hour, ns), sample_interval: level === 1 ? r.pick([1, 1, 10]) : r.pick([1, 1, 10, 100]),
      bytes: r.int(300, 60000), cache_status: r.pick(STATUSES),
      client_ip: level >= 2 && r.chance(0.4) ? v6(r, level) : v4(r),
    });
  }
  return out;
}

export function generate(r, level) {
  rayNo = 0;
  const hour0 = 1760000400 - (1760000400 % 3600) + 3600 * r.int(0, 2000);
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const ls = streamCase(r, level, hour0 + i * 86400);
    samples.push({ args: pyArgs(ls), expect: pyOut(oracle(ls)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const Z = r.pick(ZONES);
  const base = (over) => ({
    zone: Z, ray: "8e" + (++rayNo).toString(16).padStart(6, "0") + "b" + r.int(10, 99), batch: "b1",
    ts_ns: tsNs(hour0, r.int(60, 3000) * 1000000000 + r.int(0, 999999)), sample_interval: 1,
    bytes: r.int(500, 9000), cache_status: "miss", client_ip: v4(r), ...over,
  });
  const a = base({}), b = base({});
  const pfx = `2001:db8:${r.int(1, 9)}:${r.int(1, 9)}`;
  const edges = [
    ["a line delivered twice, in two batches, is counted once", [a, b, { ...a, batch: "b2" }]],
    ["a line in the last nanosecond of an hour belongs to that hour",
      [base({ ts_ns: tsNs(hour0, 3600 * 1000000000 - 1) }), base({ ts_ns: tsNs(hour0 + 3600, 0) })]],
    ["a sampled line stands for sample_interval requests and their bytes",
      [base({ sample_interval: 10 }), base({ sample_interval: 100, cache_status: "hit" })]],
    ["revalidated and updating responses are served from cache",
      [base({ cache_status: "revalidated" }), base({ cache_status: "updating" }), base({ cache_status: "expired" }), base({ cache_status: "bypass" })]],
    ["the same /64 written three ways is one client network",
      [base({ client_ip: `${pfx}::1` }), base({ client_ip: `${pfx}:0:0:0:2` }), base({ client_ip: `${pfx.toUpperCase()}:0::A` }), base({ client_ip: `2001:db8::5` }), base({ client_ip: `2001:db8:0:0:1::5` })]],
    ["two IPv4 clients are two networks, and two zones are two rows",
      [base({}), base({ client_ip: "198.51.100.7" }), base({ client_ip: "198.51.100.8" }), base({ zone: Z === "api.example" ? "docs.example" : "api.example" })]],
  ];
  for (const [name, ls] of edges) tests.push({ name, args: pyArgs(ls), expect: pyOut(oracle(ls)) });

  const n = 100000;
  tests.push({ name: `${n.toLocaleString("en-US")} log lines in time`, args: `(_gen_log_lines(${n}, ${r.int(1, 1_000_000)}),)`, limit_s: 8 });

  return {
    vars: {
      replay_rule: level === 1
        ? "The sample below covers one zone with IPv4 clients and no retried deliveries; the checks add retries, IPv6 clients and several zones."
        : level === 2
          ? "The sample below covers several zones, retried deliveries and IPv6 clients written in full."
          : "The sample below covers several zones, retried deliveries, IPv6 clients written in compressed, full and upper-case forms, and lines in the last nanoseconds of an hour.",
    },
    samples,
    tests,
  };
}
