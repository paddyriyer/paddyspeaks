/* STR-L2-02 — Linked-account groups by shared identifiers (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: an explicit account–identifier graph walked by
   breadth-first search. The evaluator's reference uses union-find, written
   independently, so each checks the other.
   level: 1 Medium (card fingerprints only) · 2 Hard (three identifier kinds whose
          values may collide across kinds) · 3 Very Hard (+ identifiers shared by too
          many accounts are ignored) */
export const kind = "python";
export const entry = "linked_groups";
export const signature = "def linked_groups(links: list[tuple[str, str, str]], min_size: int, max_share: int | None = None) -> list[int]:";
export const starter = `def linked_groups(links, min_size, max_share=None):
    """links: (account_id, kind, value), kind in {'card', 'device', 'bank'}.
    Return the sizes of linked groups with at least min_size accounts,
    largest first."""
    ...
`;

export const prelude = `
def _gen_links(n_links, n_accounts, n_values, seed, hot=0, kinds=('card', 'device', 'bank')):
    x, out = seed, []
    for _ in range(n_links - hot):
        x = (1103515245 * x + 12345) % 2147483648
        a = (x >> 16) % n_accounts
        x = (1103515245 * x + 12345) % 2147483648
        k = kinds[(x >> 16) % len(kinds)]
        x = (1103515245 * x + 12345) % 2147483648
        out.append(('acct_%06d' % a, k, 'v%d' % ((x >> 12) % n_values)))
    for i in range(hot):                         # one identifier on many accounts
        out.append(('acct_%06d' % ((i * 7919) % n_accounts), kinds[0], 'v_hot'))
    return out
`.trim() + "\n";

// Breadth-first search over an explicit bipartite graph (account <-> identifier).
export function oracle(links, minSize, maxShare) {
  const holders = new Map();         // "kind|value" -> Set(account)
  const accounts = new Set();
  for (const [acct, k, v] of links) {
    accounts.add(acct);
    const id = k + "|" + v;
    if (!holders.has(id)) holders.set(id, new Set());
    holders.get(id).add(acct);
  }
  const ids = new Map();             // account -> [identifier]
  for (const [id, hs] of holders) {
    if (maxShare != null && hs.size > maxShare) continue;
    for (const a of hs) {
      if (!ids.has(a)) ids.set(a, []);
      ids.get(a).push(id);
    }
  }
  const seenAcct = new Set(), seenId = new Set(), sizes = [];
  for (const start of accounts) {
    if (seenAcct.has(start)) continue;
    let size = 0;
    const queue = [start];
    seenAcct.add(start);
    while (queue.length) {
      const a = queue.pop();
      size++;
      for (const id of ids.get(a) || []) {
        if (seenId.has(id)) continue;
        seenId.add(id);
        for (const b of holders.get(id)) if (!seenAcct.has(b)) { seenAcct.add(b); queue.push(b); }
      }
    }
    if (size >= minSize) sizes.push(size);
  }
  return sizes.sort((x, y) => y - x);
}

const pyList = (xs) => "[" + xs.join(", ") + "]";
const pyArgs = (links, minSize, maxShare) =>
  `([${links.map(([a, k, v]) => `('${a}', '${k}', '${v}')`).join(", ")}], ${minSize}, ${maxShare == null ? "None" : maxShare})`;

const TOKENS = "abcdefghjkmnpqrstuvwxyz23456789";
const token = (r) => Array.from({ length: 4 }, () => r.pick(TOKENS.split(""))).join("");

function smallCase(r, level) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const nAcct = level === 1 ? r.int(8, 10) : level === 2 ? r.int(10, 14) : r.int(12, 16);
    const accts = Array.from({ length: nAcct }, (_, i) => "acct_" + String(100 + i * r.int(1, 3) + r.int(0, 9)).padStart(4, "0"));
    const uniq = [...new Set(accts)];
    const kinds = level === 1 ? ["card"] : ["card", "device", "bank"];
    const pool = Array.from({ length: Math.max(4, Math.floor(uniq.length * 0.7)) }, () => token(r));
    const links = [];
    for (const a of uniq) {
      const per = r.int(1, level === 1 ? 2 : 3);
      for (let j = 0; j < per; j++) links.push([a, r.pick(kinds), r.pick(pool)]);
    }
    if (r.chance(0.5)) links.push(r.pick(links).slice());          // a duplicated row
    const minSize = level === 1 ? r.int(2, 3) : r.int(2, 4);
    const maxShare = level === 3 ? r.int(3, 4) : null;
    const shuffled = r.shuffle(links);
    const got = oracle(shuffled, minSize, maxShare);
    if (got.length) return { links: shuffled, minSize, maxShare, got };
  }
  throw new Error("STR-L2-02: could not build a non-empty sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = smallCase(r, level);
    samples.push({ args: pyArgs(c.links, c.minSize, c.maxShare), expect: pyList(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const t = () => token(r);
  const [c1, c2, c3, c4] = [t(), t(), t(), t()];
  const m = r.int(3, 4);
  const chain = (n, kind) => Array.from({ length: n }, (_, i) => [`acct_9${i}`, kind, c1]); // n accounts on one card
  const edges = [
    ["a group of exactly min_size is reported", chain(m, "card"), m, null],
    ["a group of min_size - 1 is not", chain(m - 1, "card"), m, null],
    ["links are transitive: A-B on one card, B-C on another",
      [["acct_a1", "card", c1], ["acct_b1", "card", c1], ["acct_b1", "card", c2], ["acct_c1", "card", c2], ["acct_d1", "card", c3]], 2, null],
    ["a repeated row does not add an account",
      [["acct_a2", "card", c1], ["acct_a2", "card", c1], ["acct_b2", "card", c1], ["acct_b2", "card", c1]], 2, null],
    ["accounts with no shared identifier are groups of one",
      [["acct_a3", "card", c1], ["acct_b3", "card", c2], ["acct_c3", "card", c3]], 1, null],
  ];
  if (level >= 2) {
    edges.push(["the same value under two kinds does not link",
      [["acct_a4", "card", c4], ["acct_b4", "device", c4], ["acct_c4", "bank", c2], ["acct_d4", "bank", c2]], 2, null]);
    edges.push(["links through different kinds combine into one group",
      [["acct_a5", "card", c1], ["acct_b5", "card", c1], ["acct_b5", "device", c2], ["acct_c5", "device", c2], ["acct_c5", "bank", c3], ["acct_d5", "bank", c3]], 2, null]);
  }
  if (level === 3) {
    const share = r.int(3, 5);
    const on = (n, kind, v, p = "s") => Array.from({ length: n }, (_, i) => [`acct_${p}${i}`, kind, v]);
    edges.push(["an identifier on exactly max_share accounts still links", on(share, "device", c1), 2, share]);
    edges.push(["an identifier on max_share + 1 accounts is ignored", on(share + 1, "device", c1), 2, share]);
    edges.push(["max_share counts distinct accounts, not rows",
      [...on(share, "device", c1), ...on(share, "device", c1), ...on(2, "bank", c2, "t")], 2, share]);
    edges.push(["an ignored identifier does not break other links",
      [...on(share + 2, "device", c1), ["acct_s0", "card", c3], ["acct_s1", "card", c3], ["acct_s1", "bank", c4], ["acct_x9", "bank", c4]], 2, share]);
  }
  for (const [name, links, minSize, maxShare] of edges) tests.push({ name, args: pyArgs(links, minSize, maxShare), expect: pyList(oracle(links, minSize, maxShare)) });

  // Timing: ~300 000 links. Union-find is near-linear; linking every pair of holders of
  // a popular identifier is quadratic. Compared with the reference at check time.
  const seed = r.int(1, 1_000_000);
  const n = level === 1 ? 200000 : 300000;
  const hot = level === 1 ? 2500 : 4000;
  const kindsArg = level === 1 ? ", ('card',)" : "";
  tests.push({
    name: `${n.toLocaleString("en-US")} links in time (near-linear union-find)`,
    args: `(_gen_links(${n}, ${Math.floor(n / 2)}, ${Math.floor(n / 3)}, ${seed}, ${hot}${kindsArg}), ${r.int(3, 6)}, ${level === 3 ? 1000 : "None"})`,
    limit_s: 8,
  });

  return {
    vars: {
      kind_rule: level === 1
        ? "In this replay every link is a card fingerprint (`kind = 'card'`)."
        : "Links come in three kinds: `card` (card fingerprint), `device` (device id) and `bank` (bank account). Values are opaque strings and can coincide across kinds by chance.",
      share_rule: level === 3
        ? "Some identifiers are on too many accounts to mean anything (a shared office device, a marketplace's own bank account). An identifier held by more than `max_share` distinct accounts links nobody; its holders still exist as accounts."
        : "`max_share` is None: every shared identifier links its holders.",
    },
    samples,
    tests,
  };
}
