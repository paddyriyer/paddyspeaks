/* HGF-L1-05 — Reclaimable large-file storage after branches and tags are deleted (Python).
   Simulated practice scenario. All data is generated from the seed. Repositories are
   git-style (commits with parents, branches and tags) with large files stored as
   content-addressed objects; the retention rule is this exercise's, not a description of
   how any hub collects garbage.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: for every stored object it searches the history from
   every remaining ref for a commit that wrote it (O(F·C)). The evaluator's reference marks
   the reachable commits once, written independently.
   level: 1 Medium (linear branches off a shared trunk; tags; orphan uploads)
          2 Hard (+ merge commits, objects written on several branches, deleted names that do
            not exist)
          3 Very Hard (+ objects pinned by forks that share the store, history with missing
            commits, a ref that points at a missing commit) */
export const kind = "python";
export const entry = "reclaimable";
export const signature = "def reclaimable(commits: list[tuple[str, list[str], list[str]]], refs: dict[str, str], deleted: list[str], store: dict[str, int], pinned: set[str]) -> tuple[int, int]:";
export const starter = `def reclaimable(commits, refs, deleted, store, pinned):
    """commits: (commit_id, parent_ids, oids written by this commit).
    refs: {branch or tag name: commit_id} before the deletions.
    deleted: ref names being deleted.
    store: {oid: size in bytes}; pinned: oids that must be kept regardless.
    Return (objects reclaimable, bytes reclaimable)."""
    ...
`;

export const prelude = `
def _gen_repo(n_commits, n_refs, seed, merges=False, extras=False):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 8) % m
    commits, store, written = [], {}, []
    for k in range(n_commits):
        if k == 0:
            parents = []
        else:                                    # long lines of history with short side branches
            parents = ['c%d' % (k - 1 - (rnd(min(k, 40)) if rnd(10) == 0 else 0))]
        if merges and k > 2 and rnd(20) == 0:
            parents.append('c%d' % rnd(k))
        if extras and k > 0 and rnd(500) == 0:
            parents.append('gone%d' % k)
        oids = []
        for _ in range(rnd(3)):
            if written and rnd(4) == 0:
                oid = written[rnd(len(written))]
            else:
                oid = 'sha256:%x' % (k * 7 + len(oids) + 1000003)
                written.append(oid)
                store[oid] = 1000 + rnd(5000000)
            oids.append(oid)
        commits.append(('c%d' % k, parents, oids))
    for j in range(n_commits // 20):
        store['sha256:orphan%x' % j] = 1 + rnd(100000)
    refs = {'refs/heads/main': 'c%d' % (n_commits - 1)}
    for j in range(n_refs):
        refs[('refs/tags/v%d' if j % 5 == 0 else 'refs/heads/b%d') % j] = 'c%d' % rnd(n_commits)
    if extras:
        refs['refs/heads/shallow'] = 'missing-commit'
    deleted = ['refs/heads/main'] + [name for j, name in enumerate(sorted(refs)) if j % 2 == 0] + ['refs/heads/nope']
    pinned = set(written[::97]) if extras else set()
    return commits, refs, deleted, store, pinned
`.trim() + "\n";

// The specification, literally: an object is kept if some remaining ref reaches, through
// parents, a commit that wrote it, or if it is pinned. Searched once per object.
export function oracle(commits, refs, deleted, store, pinned) {
  const byId = new Map(commits.map(([id, ps, oids]) => [id, { ps, oids }]));
  const del = new Set(deleted);
  const heads = Object.entries(refs).filter(([name]) => !del.has(name)).map(([, c]) => c);
  const keeps = (oid) => {
    const seen = new Set(), stack = heads.slice();
    while (stack.length) {
      const c = stack.pop();
      if (seen.has(c) || !byId.has(c)) continue;
      seen.add(c);
      const node = byId.get(c);
      if (node.oids.includes(oid)) return true;
      stack.push(...node.ps);
    }
    return false;
  };
  let n = 0, bytes = 0;
  for (const [oid, size] of Object.entries(store)) {
    if (pinned.includes(oid) || keeps(oid)) continue;
    n++;
    bytes += size;
  }
  return [n, bytes];
}

const q = (s) => `'${s}'`;
const pyArgs = (commits, refs, deleted, store, pinned) =>
  `([${commits.map(([id, ps, oids]) => `(${q(id)}, [${ps.map(q).join(", ")}], [${oids.map(q).join(", ")}])`).join(", ")}], ` +
  `{${Object.entries(refs).map(([k, v]) => `${q(k)}: ${q(v)}`).join(", ")}}, ` +
  `[${deleted.map(q).join(", ")}], ` +
  `{${Object.entries(store).map(([k, v]) => `${q(k)}: ${v}`).join(", ")}}, ` +
  `${pinned.length ? "{" + pinned.map(q).join(", ") + "}" : "set()"})`;
const pyOut = ([n, b]) => `(${n}, ${b})`;

const HEX = "0123456789abcdef".split("");
const hex = (r, n) => Array.from({ length: n }, () => r.pick(HEX)).join("");

function randomCase(r, level) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const commits = [], store = {}, written = [];
    const n = r.int(6, level === 1 ? 8 : 10);
    const ids = Array.from({ length: n }, () => hex(r, 7));
    if (new Set(ids).size < n) continue;
    for (let k = 0; k < n; k++) {
      let ps = k === 0 ? [] : [ids[r.chance(0.6) ? k - 1 : r.int(0, k - 1)]];
      if (level >= 2 && k > 2 && r.chance(0.2)) {
        const p2 = ids[r.int(0, k - 1)];
        if (!ps.includes(p2)) ps.push(p2);
      }
      if (level === 3 && k > 0 && r.chance(0.1)) ps.push(hex(r, 7));      // parent missing from history
      const oids = [];
      for (let j = 0, m = r.int(0, 2); j < m; j++) {
        let oid;
        if (level >= 2 && written.length && r.chance(0.25)) oid = r.pick(written);
        else { oid = "sha256:" + hex(r, 8); written.push(oid); store[oid] = r.int(1, 900) * 1000 + r.int(0, 999); }
        if (!oids.includes(oid)) oids.push(oid);
      }
      commits.push([ids[k], ps, oids]);
    }
    for (let j = 0, m = r.int(1, 2); j < m; j++) store["sha256:" + hex(r, 8)] = r.int(1, 500) * 1000;   // orphan uploads
    const refs = { "refs/heads/main": ids[n - 1] };
    for (let j = 0, m = r.int(2, 3); j < m; j++) refs[r.pick(["refs/heads/feat-", "refs/heads/exp-", "refs/tags/v"]) + (j + 1)] = ids[r.int(0, n - 1)];
    if (level === 3 && r.chance(0.5)) refs["refs/heads/old"] = hex(r, 7);
    const names = Object.keys(refs);
    const deleted = r.sample(names, r.int(1, names.length - 1));
    if (level >= 2 && r.chance(0.5)) deleted.push("refs/heads/does-not-exist");
    const pinned = level === 3 ? r.sample(written, Math.min(written.length, r.int(1, 2))) : [];
    const got = oracle(commits, refs, deleted, store, pinned);
    if (got[0] > 0) return { commits, refs, deleted, store, pinned, got };
  }
  throw new Error("HGF-L1-05: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.commits, c.refs, c.deleted, c.store, c.pinned), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const s1 = r.int(2, 9) * 1_000_000, s2 = r.int(10, 99) * 10_000, s3 = r.int(1, 9) * 100_000, s4 = r.int(100, 999);
  const [o1, o2, o3, o4] = ["sha256:" + hex(r, 8), "sha256:" + hex(r, 8), "sha256:" + hex(r, 8), "sha256:" + hex(r, 8)];
  const st = { [o1]: s1, [o2]: s2, [o3]: s3 };
  const trunk = [["a1", [], [o1]], ["a2", ["a1"], [o2]], ["a3", ["a2"], []]];
  const edges = [
    ["deleting the only branch frees everything", trunk, { "refs/heads/main": "a3" }, ["refs/heads/main"], st, []],
    ["an object written early is kept by a later commit's history", trunk, { "refs/heads/main": "a3", "refs/heads/feat": "a2" }, ["refs/heads/feat"], st, []],
    ["a tag keeps a commit no branch reaches", [...trunk, ["b1", ["a1"], [o3]]], { "refs/heads/main": "a3", "refs/heads/exp": "b1", "refs/tags/v1": "b1" }, ["refs/heads/exp"], st, []],
    ["deleting a side branch frees only what it alone wrote", [...trunk, ["b1", ["a2"], [o3]]], { "refs/heads/main": "a3", "refs/heads/exp": "b1" }, ["refs/heads/exp"], st, []],
    ["an upload no commit references is reclaimable", trunk, { "refs/heads/main": "a3" }, [], { ...st, [o4]: s4 }, []],
    ["an object a commit names but the store does not hold has no bytes", [["a1", [], [o1, o4]]], { "refs/heads/main": "a1" }, ["refs/heads/main"], { [o1]: s1 }, []],
  ];
  if (level >= 2) {
    edges.push(["a merge keeps both parents' histories", [...trunk, ["b1", ["a1"], [o3]], ["m1", ["a3", "b1"], []]], { "refs/heads/main": "m1", "refs/heads/exp": "b1" }, ["refs/heads/exp"], st, []]);
    edges.push(["the same object written on two branches survives deleting one", [["a1", [], []], ["b1", ["a1"], [o3]], ["c1", ["a1"], [o3, o2]]], { "refs/heads/x": "b1", "refs/heads/y": "c1" }, ["refs/heads/y"], st, []]);
    edges.push(["deleting a name that does not exist changes nothing", trunk, { "refs/heads/main": "a3" }, ["refs/heads/mian"], { ...st, [o4]: s4 }, []]);
  }
  if (level === 3) {
    edges.push(["a pinned object is kept although nothing reaches it", trunk, { "refs/heads/main": "a3" }, ["refs/heads/main"], st, [o2]]);
    edges.push(["a parent missing from the history is skipped", [["a2", ["gone"], [o2]], ["a3", ["a2"], []]], { "refs/heads/main": "a3" }, [], st, []]);
    edges.push(["a ref that points at a missing commit keeps nothing", trunk, { "refs/heads/main": "a3", "refs/heads/old": "ffffffff" }, ["refs/heads/main"], st, []]);
  }
  for (const [name, commits, refs, deleted, store, pinned] of edges) {
    tests.push({ name, args: pyArgs(commits, refs, deleted, store, pinned), expect: pyOut(oracle(commits, refs, deleted, store, pinned)) });
  }

  // Timing: 150 000 commits on long chains, about 150 000 objects, 1 000 refs spread across the history. One iterative
  // mark pass is O(C + F); a reachability search per object is O(F·C), and a recursive walk
  // overflows the stack on a 150 000-commit chain.
  tests.push({
    name: "150,000 commits, about 150,000 objects, 1,000 refs (one mark pass, iterative)",
    args: `_gen_repo(150000, 1000, ${r.int(1, 1_000_000)}, ${level >= 2 ? "True" : "False"}, ${level === 3 ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      history_rule: level === 1
        ? "In this repository every commit has at most one parent."
        : level === 2
          ? "Merge commits have two parents, and the same object can be written by commits on different branches."
          : "Merge commits have two parents; some history was pruned, so a parent id or a ref can name a commit that is not in `commits` (skip it). Forks share the store, and `pinned` lists objects they still use.",
    },
    samples,
    tests,
  };
}
