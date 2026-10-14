/* CFX-L1-04 — Resolving a bulk redirect list: final target, hops and loops (Python).
   Simulated practice scenario. All data is generated from the seed. How a source is
   matched, which rule wins for a repeated source and how URLs are canonicalised are this
   exercise's own rules; check current docs for how any real redirect product behaves.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which follows every chain from scratch with a visited
   set (fine for small inputs). The evaluator's reference memoises one walk per URL.
   level: 1 Medium (each source once, canonical URLs, chains and loops)
          2 Hard (+ repeated sources: the first rule wins; self-redirects; chains that run
                  into a loop are loops too)
          3 Very Hard (+ canonical form: host lower-cased, one trailing '/' dropped from a
                       path other than '/') */
export const kind = "python";
export const entry = "resolve_redirects";
export const signature = "def resolve_redirects(rules: list[tuple[str, str, int]]) -> dict[str, tuple[str | None, int, bool]]:";
export const starter = `def resolve_redirects(rules):
    """rules: (source_url, target_url, status_code) in list order; URLs are 'host/path'.
    Return {source: (final_url, hops, permanent)} for every distinct source.
    A source whose chain never ends (it revisits a URL) maps to (None, -1, False)."""
    ...
`;

export const prelude = `
def _gen_redirects(n_chains, chain_len, n_loops, loop_len, seed, dups=False, messy=False):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    def spell(u):
        if messy and rnd(5) == 0:
            host, _, path = u.partition('/')
            return host.upper() + '/' + path + '/'
        return u
    rules = []
    for c in range(n_chains):
        for i in range(chain_len):
            tgt = 'c%d.example/%d' % (c, i + 1) if i + 1 < chain_len else 'c%d.example/final' % c
            rules.append(('c%d.example/%d' % (c, i), spell(tgt), (301, 308, 302, 307)[rnd(4)] if rnd(10) == 0 else 301))
    for j in range(n_loops):
        for i in range(loop_len):
            rules.append(('l%d.example/%d' % (j, i), spell('l%d.example/%d' % (j, (i + 1) % loop_len)), 301))
        for i in range(chain_len // 4):        # a long lead-in that ends inside the loop
            nxt = 'in%d.example/%d' % (j, i + 1) if i + 1 < chain_len // 4 else 'l%d.example/0' % j
            rules.append(('in%d.example/%d' % (j, i), spell(nxt), 308))
    for i in range(len(rules) - 1, 0, -1):     # Fisher-Yates with the LCG
        k = rnd(i + 1)
        rules[i], rules[k] = rules[k], rules[i]
    if dups:                                   # later duplicates of existing sources never win
        for i in range(len(rules) // 20):
            s = rules[rnd(len(rules))][0]
            rules.append((s, 'elsewhere.example/%d' % i, 302))
    return rules
`.trim() + "\n";

const canon = (u) => {
  const i = u.indexOf("/");
  const host = i < 0 ? u : u.slice(0, i);
  let path = i < 0 ? "/" : u.slice(i);
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return host.toLowerCase() + path;
};

// Independent oracle: follow each chain from scratch with a visited set.
export function oracle(rules, level) {
  const c = level === 3 ? canon : (u) => u;
  const next = new Map();
  for (const [s, t, code] of rules) if (!next.has(c(s))) next.set(c(s), [c(t), code === 301 || code === 308]);
  const out = new Map();
  for (const start of next.keys()) {
    const seen = new Set([start]);
    let u = start, hops = 0, perm = true, loop = false;
    while (next.has(u)) {
      const [t, p] = next.get(u);
      hops++; perm = perm && p; u = t;
      if (seen.has(u)) { loop = true; break; }
      seen.add(u);
    }
    out.set(start, loop ? null : [u, hops, perm]);
  }
  return out;
}

const q = (s) => `'${s}'`;
const pyArgs = (rules) => `([${rules.map(([s, t, c]) => `(${q(s)}, ${q(t)}, ${c})`).join(", ")}],)`;
const pyOut = (m) => "{" + [...m.entries()].map(([k, v]) => `${q(k)}: ${v === null ? "(None, -1, False)" : `(${q(v[0])}, ${v[1]}, ${v[2] ? "True" : "False"})`}`).join(", ") + "}";

const HOSTS = ["shop.example", "docs.example", "blog.example", "help.example"];
const PATHS = ["home", "sale", "spring", "pricing", "about", "guide", "v1", "v2", "old", "new", "start", "faq"];

function randomCase(r, level) {
  const host = r.pick(HOSTS);
  const urls = r.sample(PATHS, 9).map((p) => host + "/" + p);
  const rules = [];
  const n = r.int(5, 8);
  for (let i = 0; i < n; i++) {
    const s = level >= 2 && rules.length && r.chance(0.15) ? r.pick(rules)[0] : r.pick(urls);
    let t = r.chance(0.1) && level >= 2 ? s : r.pick(urls);
    if (t === s && level === 1) t = host + "/landing";
    let s2 = s, t2 = t;
    if (level === 3) {
      if (r.chance(0.3)) t2 = t.replace(host, host.toUpperCase());
      if (r.chance(0.3)) t2 += "/";
      if (r.chance(0.2)) s2 = s + "/";
    }
    rules.push([s2, t2, r.pick([301, 301, 302, 307, 308])]);
  }
  if (level === 1) {
    // Each source once.
    const seen = new Set();
    return rules.filter(([s]) => (seen.has(s) ? false : (seen.add(s), true)));
  }
  return rules;
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const rules = randomCase(r, level);
    samples.push({ args: pyArgs(rules), expect: pyOut(oracle(rules, level)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const h = r.pick(HOSTS);
  const u = (p) => h + "/" + p;
  const tmp = r.pick([302, 307]);
  const perm = r.pick([301, 308]);
  const edges = [
    ["one rule: one hop to a URL that is not a source", [[u("old"), u("new"), perm]]],
    ["a two-URL loop", [[u("a"), u("b"), 301], [u("b"), u("a"), 301]]],
    ["one temporary hop makes every chain through it non-permanent",
      [[u("v1"), u("v2"), 301], [u("v2"), u("v3"), tmp], [u("v3"), u("v4"), 308]]],
    ["308 is permanent and 307 is not", [[u("x"), u("y"), 308], [u("p"), u("q"), 307]]],
    ["a chain to another host is followed there", [[u("go"), "partner.example/start", 301], ["partner.example/start", "partner.example/home", 301]]],
  ];
  if (level >= 2) {
    edges.push(["a repeated source: the first rule wins", [[u("sale"), u("spring"), 301], [u("sale"), u("summer"), 302], [u("spring"), u("home"), 301]]]);
    edges.push(["a URL that redirects to itself is a loop", [[u("self"), u("self"), 301], [u("into"), u("self"), 301]]]);
    edges.push(["a chain that runs into a loop is a loop, the URLs before it too",
      [[u("start"), u("mid"), 301], [u("mid"), u("c1"), 301], [u("c1"), u("c2"), 301], [u("c2"), u("c1"), 301], [u("side"), u("end"), 302]]]);
  }
  if (level === 3) {
    const H = h.toUpperCase();
    edges.push(["host case and one trailing slash are not part of a URL's identity",
      [[H + "/docs/", u("guide"), 301], [u("guide/"), H + "/manual", 308]]]);
    edges.push(["after canonicalising, a source that targets its own other spelling is a loop",
      [[u("Home/"), H + "/Home", 301], [u("home"), u("Home"), 301]]]);
    edges.push(["the root path keeps its slash, and path case matters",
      [[h + "/", u("start"), 301], [u("Start"), h + "/", 301]]]);
    edges.push(["two spellings of one source: the first rule wins",
      [[u("faq/"), u("help"), 302], [H + "/faq", u("support"), 301]]]);
  }
  for (const [name, rules] of edges) tests.push({ name, args: pyArgs(rules), expect: pyOut(oracle(rules, level)) });

  // Timing: 40 chains of 3 000 hops plus 4 loops of 3 000 URLs with 750-URL lead-ins.
  // Following each chain from scratch is ~2·10^8 steps (tens of seconds in CPython), and a
  // recursive memo exceeds the default recursion limit; one memoised walk per URL is O(n).
  const seed = r.int(1, 1_000_000);
  tests.push({
    name: "about 135 000 rules in 3 000-hop chains and loops, in time",
    args: `(_gen_redirects(40, 3000, 4, 3000, ${seed}, ${level >= 2 ? "True" : "False"}, ${level === 3 ? "True" : "False"}),)`,
    limit_s: 8,
  });

  return {
    vars: {
      dup_rule: level === 1
        ? "Each source appears once in this round, and no URL redirects to itself."
        : "A source can appear in several rules: the **first** rule in list order wins and the others are ignored. A URL may redirect to itself, which is a loop.",
      canon_rule: level === 3
        ? "Before anything else, put every URL (source and target) in canonical form: lower-case the host (the part before the first `/`), and if the path is longer than `/` and ends with `/`, drop that one trailing `/`. Path case is kept. Keys and final URLs are returned in canonical form."
        : "URLs are already in one canonical form in this round: compare them as plain strings.",
    },
    samples,
    tests,
  };
}
