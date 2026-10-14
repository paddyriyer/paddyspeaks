/* CFL-L2-01 — Sticky rebalance: a balanced assignment that moves the fewest partitions (Python).
   Simulated practice scenario. All data is generated from the seed and is hypothetical.

   Contract: see docs/COMPANY-INTERVIEW-LOOPS.md § Executable templates (python).
   expect comes from oracle() below: claims grouped per partition, quotas from a sort,
   and every free partition placed by scanning all members (O(P·C), small inputs only).
   The evaluator's reference resolves claims in one pass and places free partitions
   with a heap keyed by (load, member id), written independently.
   level: 1 Medium (one topic, members join or leave, previous assignment balanced)
          2 Hard (+ several topics, joins and leaves together, uneven previous loads,
                  new partitions, claims on deleted partitions, more members than partitions)
          3 Very Hard (+ the same partition claimed by two members after a failed
                  rebalance, resolved by generation) */
export const kind = "python";
export const entry = "rebalance";
export const signature = "def rebalance(partitions: list[tuple[str, int]], members: list[str], owned: list[tuple[str, int, list[tuple[str, int]]]]) -> dict[str, list[tuple[str, int]]]:";
export const starter = `def rebalance(partitions, members, owned):
    """partitions: every (topic, partition) the group subscribes to now.
    members:    member ids in the group now.
    owned:      (member, generation, [(topic, partition), ...]) last known ownership.
    Return {member: sorted [(topic, partition), ...]} for every member."""
    ...
`;

export const prelude = `
def _gen_group(topics, per_topic, old, left, new, seed):
    x = seed
    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 16
    partitions = [('t%03d' % t, p) for t in range(topics) for p in range(per_topic)]
    olds = ['m%05d' % i for i in range(old)]
    claims = {m: [] for m in olds}
    for part in partitions:
        claims[olds[nxt() % old]].append(part)
    owned = [(m, 41, ps) for m, ps in claims.items()]
    members = olds[left:] + ['m%05d' % i for i in range(old, old + new)]
    return partitions, members, owned
`.trim() + "\n";

const cmpPart = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1]);
const pk = (p) => p[0] + "#" + p[1];
const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// The specification, implemented independently of the Python reference.
export function oracle(partitions, members, owned) {
  if (!members.length) return {};
  const exists = new Set(partitions.map(pk));
  const inGroup = new Set(members);
  const claims = new Map();                       // partition -> [{m, g}]
  for (const [m, g, ps] of owned) {
    if (!inGroup.has(m)) continue;                // a member that left keeps nothing
    for (const p of ps) {
      if (!exists.has(pk(p))) continue;           // a deleted partition
      if (!claims.has(pk(p))) claims.set(pk(p), []);
      claims.get(pk(p)).push({ m, g });
    }
  }
  const owner = new Map();
  for (const [k, cs] of claims) {
    const top = Math.max(...cs.map((c) => c.g));
    const at = new Set(cs.filter((c) => c.g === top).map((c) => c.m));
    if (at.size === 1) owner.set(k, [...at][0]);  // a tie at the top generation: nobody keeps it
  }
  const retained = Object.fromEntries(members.map((m) => [m, []]));
  for (const p of partitions) if (owner.has(pk(p))) retained[owner.get(pk(p))].push(p);
  const P = partitions.length, C = members.length, q = Math.floor(P / C), extra = P % C;
  const order = members.slice().sort((a, b) => retained[b].length - retained[a].length || cmpStr(a, b));
  const quota = {};
  order.forEach((m, i) => { quota[m] = q + (i < extra ? 1 : 0); });
  const res = {};
  const taken = new Set();
  for (const m of members) {
    res[m] = retained[m].slice().sort(cmpPart).slice(0, quota[m]);
    for (const p of res[m]) taken.add(pk(p));
  }
  const free = partitions.filter((p) => !taken.has(pk(p))).sort(cmpPart);
  for (const p of free) {
    let best = null;
    for (const m of members) {
      if (res[m].length >= quota[m]) continue;
      if (best === null || res[m].length < res[best].length || (res[m].length === res[best].length && m < best)) best = m;
    }
    res[best].push(p);
  }
  for (const m of members) res[m].sort(cmpPart);
  return res;
}

const pyPart = ([t, p]) => `('${t}', ${p})`;
const pyParts = (ps) => "[" + ps.map(pyPart).join(", ") + "]";
const pyArgs = (partitions, members, owned) =>
  `(${pyParts(partitions)}, [${members.map((m) => `'${m}'`).join(", ")}], [${owned.map(([m, g, ps]) => `('${m}', ${g}, ${pyParts(ps)})`).join(", ")}])`;
const pyOut = (res) => "{" + Object.entries(res).map(([m, ps]) => `'${m}': ${pyParts(ps)}`).join(", ") + "}";

const TOPICS = ["orders", "payments", "clicks", "shipments", "inventory", "audit", "refunds", "sessions"];

function ids(r, n) {
  const used = new Set();
  const out = [];
  while (out.length < n) {
    const id = "c-" + r.int(0, 65535).toString(16).padStart(4, "0");
    if (!used.has(id)) { used.add(id); out.push(id); }
  }
  return out;
}

function smallCase(r, level) {
  const topics = r.sample(TOPICS, level === 1 ? 1 : r.int(2, 3));
  const count = Object.fromEntries(topics.map((t) => [t, level === 1 ? r.int(6, 12) : r.int(3, 8)]));
  const partitions = [];
  for (const t of topics) for (let p = 0; p < count[t]; p++) partitions.push([t, p]);
  const pool = ids(r, 9);
  const prev = pool.slice(0, level === 1 ? r.int(2, 4) : r.int(2, 5));
  let members;
  if (level === 1) {
    members = r.chance(0.5) ? prev.concat(pool.slice(6, 6 + r.int(1, 2))) : prev.filter((_, i) => i !== r.int(0, prev.length - 1));
  } else {
    const stay = prev.filter(() => r.chance(0.7));
    members = stay.concat(pool.slice(6, 6 + r.int(0, 3)));
    if (!members.length) members = [pool[8]];
  }
  members = r.shuffle(members);
  // Previous ownership. Level 1: round robin over the old members. Level 2+: uneven,
  // some partitions new (unowned), and claims on partitions that no longer exist.
  const claims = Object.fromEntries(prev.map((m) => [m, []]));
  partitions.forEach((p, i) => {
    if (level === 1) claims[prev[i % prev.length]].push(p);
    else if (r.chance(0.85)) claims[r.pick(prev)].push(p);
  });
  if (level >= 2) for (const t of topics) if (r.chance(0.4)) claims[r.pick(prev)].push([t, count[t] + r.int(0, 2)]);
  const gen = r.int(3, 40);
  const owned = prev.map((m) => [m, gen, r.shuffle(claims[m])]);
  if (level === 3) {
    // A failed rebalance: two members both report some partitions.
    for (let k = 0; k < 2; k++) {
      const p = r.pick(partitions);
      const m = r.pick(prev);
      const row = owned.find((o) => o[0] === m);
      if (!row[2].some((x) => pk(x) === pk(p))) {
        const newer = r.chance(0.5);
        owned.splice(owned.indexOf(row), 1, [m, newer ? gen + 1 : gen, row[2].concat([p])]);
      }
    }
  }
  return { partitions: r.shuffle(partitions), members, owned: r.shuffle(owned) };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = smallCase(r, level);
    samples.push({ args: pyArgs(c.partitions, c.members, c.owned), expect: pyOut(oracle(c.partitions, c.members, c.owned)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [t1, t2] = r.sample(TOPICS, 2);
  const [a, b, c, d] = ids(r, 4).sort();
  const g = r.int(5, 30);
  const parts = (t, n) => Array.from({ length: n }, (_, i) => [t, i]);
  const P7 = parts(t1, 7);
  const edges = [
    ["a fresh group: nobody owned anything", P7, [c, a, b], []],
    ["one member leaves: only its partitions move", P7, [a, b],
      [[a, g, [P7[0], P7[3], P7[6]]], [b, g, [P7[1], P7[4]]], [c, g, [P7[2], P7[5]]]]],
    ["one member joins: members above quota give up their highest partitions", parts(t1, 6), [a, b, c],
      [[a, g, parts(t1, 6).slice(0, 3)], [b, g, parts(t1, 6).slice(3)]]],
    ["more members than partitions: some members get nothing", parts(t1, 2), [d, c, b, a],
      [[c, g, [[t1, 1]]]]],
    ["equal retained counts: the extra partition goes to the smaller member id", parts(t1, 5), [b, a],
      [[a, g, [[t1, 0], [t1, 1]]], [b, g, [[t1, 2], [t1, 3]]]]],
    ["claims of a member that left are ignored", parts(t1, 4), [b, c],
      [[a, g, [[t1, 0], [t1, 1], [t1, 2], [t1, 3]]], [b, g, [[t1, 3]]]]],
    ["the partition count divides evenly by the members", parts(t1, 6), [a, b, c],
      [[a, g, parts(t1, 6)]]],
    ["no members: an empty assignment", parts(t1, 3), [], [[a, g, parts(t1, 3)]]],
    ["partitions sort by topic, then by partition number (2 before 10)", parts(t1, 12), [a, b],
      [[a, g, [[t1, 10], [t1, 11], [t1, 2]]], [b, g, [[t1, 9]]]]],
  ];
  if (level >= 2) {
    edges.push(["a new partition and a claim on a deleted partition", parts(t1, 4).concat(parts(t2, 2)), [a, b],
      [[a, g, [[t1, 0], [t1, 1], [t1, 7]]], [b, g, [[t1, 2], [t1, 3], [t2, 0]]]]]);
    edges.push(["joins and leaves together", parts(t1, 6), [c, d, a],
      [[a, g, [[t1, 0], [t1, 1], [t1, 2], [t1, 3]]], [b, g, [[t1, 4], [t1, 5]]]]]);
  }
  if (level === 3) {
    edges.push(["two claims at different generations: the newer one keeps it", parts(t1, 4), [a, b],
      [[a, g, [[t1, 0], [t1, 1]]], [b, g + 1, [[t1, 1], [t1, 2]]]]]);
    edges.push(["two claims at the same generation: nobody keeps it", parts(t1, 4), [a, b],
      [[a, g, [[t1, 0], [t1, 1]]], [b, g, [[t1, 1], [t1, 2], [t1, 3]]]]]);
  }
  for (const [name, ps, ms, ow] of edges) tests.push({ name, args: pyArgs(ps, ms, ow), expect: pyOut(oracle(ps, ms, ow)) });

  // Timing: 200,000 partitions; 1,000 old members, 100 leave and 3,000 join, so about
  // 150,000 partitions move. A heap places each in O(log C); scanning every member
  // for each partition is O(P·C), about 6·10^8 steps.
  tests.push({
    name: "200,000 partitions, 3,900 members after 3,000 join and 100 leave (heap)",
    args: `_gen_group(40, 5000, 1000, 100, 3000, ${r.int(1, 1_000_000)})`,
    limit_s: 8,
  });

  return {
    vars: {
      group: r.pick(["payments-sink", "order-enricher", "fraud-scorer", "clickstream-loader", "inventory-sync"]),
      replay_rule: level === 1
        ? "In this replay one topic is subscribed, members only join or only leave, and the previous assignment was balanced."
        : level === 2
          ? "In this replay several topics are subscribed, members join and leave in the same rebalance, previous loads are uneven, some partitions are new and some claimed partitions no longer exist."
          : "In this replay several topics are subscribed, members join and leave together, partitions are added and deleted, and after a failed rebalance two members can both claim a partition.",
    },
    samples,
    tests,
  };
}
