/* XAI-L2-03 — Debug the citation report for server-side tool calls (debug, Python).
   Simulated practice scenario. All data is generated from the seed; every URL uses a
   generic example domain, every post id is synthetic, and no response text is involved.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below, an
   independent JavaScript implementation of the specification in the template (it
   parses URLs with its own pattern, not with a URL library).
   Planted bugs (see the evaluator notes): citations are deduplicated on the raw URL
   before it is canonicalised; the subdomain fold checks the two-label suffixes
   against the last label only; post citations are also counted as web citations;
   responses with no citations are skipped, so they leave the denominator; the day
   is the local date written in the timestamp instead of the UTC date.
   level: 1 Medium (UTC timestamps, web citations on .com and .org hosts)
          · 2 Hard (+ timestamps with offsets near midnight, post citations)
          · 3 Very Hard (+ hosts under two-label suffixes, tracking parameters and
            fragments mixed into the same page) */
export const kind = "debug";
export const entry = "citation_report";
export const signature = "def citation_report(responses: list[dict], suffixes: list[str]) -> dict:";
export const starter = `from urllib.parse import urlsplit


def _canonical(url):
    parts = urlsplit(url)
    host = parts.hostname or ""                      # urlsplit lowercases the host
    if host.startswith("www."):
        host = host[4:]
    path = parts.path.rstrip("/")
    kept = [kv for kv in parts.query.split("&") if kv and not kv.split("=", 1)[0].startswith("utm_")]
    return host, host + path + ("?" + "&".join(kept) if kept else "")


def _domain(host, suffixes):
    labels = host.split(".")
    if len(labels) >= 3 and labels[-1] in suffixes:
        return ".".join(labels[-3:])
    return ".".join(labels[-2:])


def citation_report(responses, suffixes):
    report = {}
    for resp in responses:
        if not resp["citations"]:
            continue
        day = resp["ts"][:10]
        d = report.setdefault(day, {"responses": 0, "cited": 0, "web": 0, "posts": 0, "domains": {}})
        d["responses"] += 1
        d["cited"] += 1
        seen, domains = set(), set()
        for c in resp["citations"]:
            if c["ref"] in seen:
                continue
            seen.add(c["ref"])
            if c["kind"] == "post":
                d["posts"] += 1
            else:
                host, url = _canonical(c["ref"])
                domains.add(_domain(host, suffixes))
            d["web"] += 1
        for dom in domains:
            d["domains"][dom] = d["domains"].get(dom, 0) + 1
    return report
`;

export const prelude = `
from datetime import datetime as _dt, timedelta as _td, timezone as _tz


def _gen_responses(n, seed):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    hosts = ['www.example.com', 'docs.example.com', 'Example.com', 'news.example.co.uk', 'example.co.uk',
             'blog.example.com.au', 'example.org', 'data.example.org', 'www.example.net', 'api.example.net']
    paths = ['', '/', '/a', '/a/', '/b', '/B', '/guide/intro', '/guide/intro/']
    queries = ['', '', '?utm_source=feed', '?id=7', '?id=7&utm_medium=x', '?utm_campaign=z&ref=2']
    zones = [_tz(_td(minutes=m)) for m in (0, 0, -480, -300, 60, 330, 540)]
    base = 1791072000                                # 2026-10-04 00:00 UTC
    out = []
    for i in range(n):
        when = _dt.fromtimestamp(base + nxt() % (7 * 86400), zones[nxt() % 7])
        cites = []
        for _ in range(nxt() % 5):
            if nxt() % 4 == 0:
                cites.append({'kind': 'post', 'ref': str(100000 + nxt() % 5000)})
            else:
                cites.append({'kind': 'web', 'ref': ('https://', 'http://')[nxt() % 2] + hosts[nxt() % 10]
                              + paths[nxt() % 8] + queries[nxt() % 6] + ('', '#top')[nxt() % 2]})
        out.append({'id': 'r%d' % i, 'ts': when.isoformat(), 'citations': cites})
    return out, ['co.uk', 'com.au']
`.trim() + "\n";

// ---- the specification, implemented independently of the Python reference ----
const URL_RX = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?(?:#.*)?$/;
function canonical(url) {
  const m = URL_RX.exec(url);
  let host = m[2].toLowerCase();
  if (host.startsWith("www.")) host = host.slice(4);
  let path = m[3];
  while (path.endsWith("/")) path = path.slice(0, -1);
  const kept = (m[4] || "").split("&").filter((kv) => kv !== "" && !kv.split("=")[0].startsWith("utm_"));
  return { host, key: host + path + (kept.length ? "?" + kept.join("&") : "") };
}
function domainOf(host, suffixes) {
  const labels = host.split(".");
  const two = labels.slice(-2).join(".");
  return suffixes.includes(two) && labels.length >= 3 ? labels.slice(-3).join(".") : two;
}
const utcDay = (ts) => new Date(Date.parse(ts)).toISOString().slice(0, 10);

export function oracle(responses, suffixes) {
  const report = {};
  for (const resp of responses) {
    const day = utcDay(resp.ts);
    const d = (report[day] ||= { responses: 0, cited: 0, web: 0, posts: 0, domains: {} });
    d.responses += 1;
    if (resp.citations.length) d.cited += 1;
    const web = new Set(), posts = new Set(), doms = new Set();
    for (const c of resp.citations) {
      if (c.kind === "post") posts.add(c.ref);
      else {
        const { host, key } = canonical(c.ref);
        web.add(key);
        doms.add(domainOf(host, suffixes));
      }
    }
    d.web += web.size;
    d.posts += posts.size;
    for (const dom of doms) d.domains[dom] = (d.domains[dom] || 0) + 1;
  }
  return report;
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `'${k}': ${py(x)}`).join(", ") + "}";
}
const pyArgs = (c) => `(${py(c.responses)}, ${py(c.suffixes)})`;
const run = (c) => oracle(c.responses, c.suffixes);

const pad = (n) => String(n).padStart(2, "0");
// An ISO 8601 time with a fixed offset, from UTC seconds.
function iso(sec, offMin) {
  const t = new Date((sec + offMin * 60) * 1000);
  const sign = offMin < 0 ? "-" : "+";
  const a = Math.abs(offMin);
  return `${t.toISOString().slice(0, 19)}${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}
const DAY0 = Date.UTC(2026, 9, 5) / 1000;          // 2026-10-05 00:00 UTC

function sampleCase(r, level) {
  const hosts = level === 1
    ? ["www.example.com", "example.com", "docs.example.com", "example.org", "data.example.org"]
    : level === 2
      ? ["www.example.com", "Example.com", "docs.example.com", "example.org", "www.example.net"]
      : ["www.example.com", "docs.example.com", "news.example.co.uk", "example.co.uk", "blog.example.com.au", "example.net"];
  const paths = ["/a", "/a/", "/b", "/guide", "/guide/", ""];
  const queries = level === 3 ? ["", "", "?utm_source=feed", "?id=7", "?id=7&utm_medium=x"] : ["", "", "?id=7"];
  const frags = level === 3 ? ["", "#top"] : [""];
  const responses = [];
  const n = r.int(4, 7);
  for (let i = 0; i < n; i++) {
    const off = level === 1 ? 0 : r.pick([0, -480, -300, 330, 540]);
    const sec = DAY0 + r.int(0, 2) * 86400 + (r.chance(0.6) ? r.pick([r.int(0, 3), r.int(20, 23)]) * 3600 : r.int(4, 19) * 3600) + r.int(0, 3599);
    const citations = [];
    const k = r.chance(0.25) ? 0 : r.int(1, 4);
    for (let j = 0; j < k; j++) {
      if (level >= 2 && r.chance(0.3)) citations.push({ kind: "post", ref: String(r.int(100000, 100006)) });
      else citations.push({ kind: "web", ref: r.pick(["https://", "http://"]) + r.pick(hosts) + r.pick(paths) + r.pick(queries) + r.pick(frags) });
    }
    if (k && r.chance(0.3)) citations.push({ ...citations[0] });          // the same citation twice
    responses.push({ id: `resp-${r.int(100, 999)}${i}`, ts: iso(sec, off), citations });
  }
  return { responses, suffixes: ["co.uk", "com.au"] };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const c = sampleCase(r, level);
    samples.push({ args: pyArgs(c), expect: py(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const mid = DAY0 + 86400 * r.int(0, 2) + 3600 * r.int(9, 16) + 60 * r.int(0, 59);
  const web = (ref) => ({ kind: "web", ref });
  const post = (ref) => ({ kind: "post", ref });
  const resp = (id, sec, citations, off = 0) => ({ id, ts: iso(sec, off), citations });
  const SUF = ["co.uk", "com.au"];
  const p1 = r.pick(["/guide", "/docs/limits", "/blog/launch", "/a"]);
  const pid = () => String(r.int(100000, 999999));
  const edges = [
    ["one response, two different pages on one site",
      { responses: [resp("r1", mid, [web(`https://example.com${p1}`), web("https://example.com/b")])], suffixes: SUF }],
    ["the same page written five ways is one web citation",
      { responses: [resp("r1", mid, [web(`https://www.Example.com${p1}/?utm_source=feed#top`), web(`http://example.com${p1}`),
        web(`https://EXAMPLE.com${p1}/`), web(`https://example.com${p1}?utm_medium=x&utm_campaign=y`), web(`https://www.example.com${p1}#refs`)])], suffixes: SUF }],
    ["paths keep their case, and other query parameters stay",
      { responses: [resp("r1", mid, [web("https://example.com/A"), web("https://example.com/a"), web("https://example.com/a?id=7"), web("https://example.com/a?id=8")])], suffixes: SUF }],
    ["subdomains fold to the site, under a two-label suffix too",
      { responses: [resp("r1", mid, [web(`https://news.example.co.uk${p1}`), web("https://blog.example.com/x")]),
        resp("r2", mid + 60, [web("https://example.co.uk/y"), web(`https://shop.example.com.au${p1}`)])], suffixes: SUF }],
    ["post citations are counted apart from web citations",
      { responses: [resp("r1", mid, [web(`https://example.org${p1}`), post(pid()), post(pid())])], suffixes: SUF }],
    ["responses with no citations stay in the denominator",
      { responses: [resp("r1", mid, [web(`https://example.org${p1}`)]), resp("r2", mid + 120, []), resp("r3", mid + 86400 * 3, [])], suffixes: SUF }],
    ["late evening west of UTC is already the next UTC day",
      { responses: [resp("r1", DAY0 + 86400 + 3600 * 3, [web(`https://example.net${p1}`)], r.pick([-480, -420, -300]))], suffixes: SUF }],
    ["early morning east of UTC is still the previous UTC day",
      { responses: [resp("r1", DAY0 + 86400 - 3600 * 2, [web(`https://example.net${p1}`)], r.pick([330, 540, 600]))], suffixes: SUF }],
  ];
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: py(run(c)) });

  tests.push({ name: "50,000 responses with their citations in time", args: `_gen_responses(50000, ${r.int(1, 1_000_000)})`, limit_s: 8 });

  return {
    vars: {
      replay_rule: level === 1
        ? "The sample replays here have UTC timestamps and web citations on .com and .org hosts; the checks below cover every rule."
        : level === 2
          ? "The sample replays here add timestamps with offsets near midnight and post citations; the checks below cover every rule."
          : "The sample replays here add hosts under two-label suffixes, and tracking parameters and fragments on the same pages; the checks below cover every rule.",
    },
    samples,
    tests,
  };
}
