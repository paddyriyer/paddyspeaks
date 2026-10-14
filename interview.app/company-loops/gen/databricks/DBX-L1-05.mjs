/* DBX-L1-05 — Table snapshots from a transaction log with checkpoints (Python).
   Simulated practice scenario. All data is generated from the seed. The log rules
   (actions applied in order, checkpoints holding the full file list, missing commit
   files) are this exercise's simplified model of an open table format, stated in the
   problem; they are not the full protocol of any format.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which rebuilds every queried version independently
   (latest checkpoint at or below it, then replay). The evaluator's reference groups the
   queries by checkpoint and replays each commit once, so each checks the other.
   level: 1 Medium (every commit present; checkpoints every K versions; valid queries)
          2 Hard (+ old commits and checkpoints cleaned up, queries before the retained
                  history or beyond the latest version -> None, removes of inactive files)
          3 Very Hard (+ a missing commit in the middle, a checkpoint whose commit file is
                  gone, re-adds that replace a size, add and remove of one path in a commit) */
export const kind = "python";
export const entry = "snapshot_sizes";
export const signature = "def snapshot_sizes(commits: dict[int, list[tuple]], checkpoints: dict[int, list[tuple[str, int]]], versions: list[int]) -> list[tuple[int, int] | None]:";
export const starter = `def snapshot_sizes(commits, checkpoints, versions):
    """commits: version -> list of actions, ("add", path, size) or ("remove", path).
    checkpoints: version -> list of (path, size), the active files after that version.
    Return, for each queried version, (file_count, total_bytes) or None."""
    ...
`;

export const prelude = `
def _gen_case(n_versions, seed, cp_every, n_queries, keep_from=0, gap=None, valid_only=False):
    x = seed
    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    active, keys, where = {}, [], {}
    def put(p, size):
        if p not in active:
            where[p] = len(keys)
            keys.append(p)
        active[p] = size
    def drop(p):
        if p in active:
            del active[p]
            i = where.pop(p)
            last = keys.pop()
            if i < len(keys):
                keys[i] = last
                where[last] = i
    commits, checkpoints, serial = {}, {}, 0
    for v in range(n_versions):
        acts = []
        kind = nxt() % 10
        if v == 0 or kind < 6 or len(active) < 50:
            for _ in range(1 + nxt() % 12):
                serial += 1
                acts.append(("add", "date=2026-10-%02d/part-%06d.parquet" % (1 + nxt() % 28, serial), 1000 + nxt() % 5000000))
        elif kind < 9:
            for _ in range(1 + nxt() % 8):
                acts.append(("remove", keys[nxt() % len(keys)]))
            serial += 1
            acts.append(("add", "date=2026-10-%02d/part-%06d.parquet" % (1 + nxt() % 28, serial), 1000 + nxt() % 9000000))
        else:
            for _ in range(1 + nxt() % 5):
                acts.append(("add", keys[nxt() % len(keys)], 1000 + nxt() % 5000000))
        for a in acts:
            if a[0] == "add":
                put(a[1], a[2])
            else:
                drop(a[1])
        commits[v] = acts
        if v and v % cp_every == 0:
            checkpoints[v] = sorted(active.items())
    for v in range(keep_from):
        commits.pop(v, None)
        checkpoints.pop(v, None)
    if gap is not None:
        commits.pop(gap, None)
    if valid_only:
        qs = [nxt() % n_versions for _ in range(n_queries)]
    else:
        qs = [(nxt() % (n_versions + 40)) - 20 for _ in range(n_queries)]
    return commits, checkpoints, qs
`.trim() + "\n";

// ---- oracle: rebuild each queried version on its own ------------------------------
export function oracle(commits, checkpoints, versions) {
  const cv = Object.keys(commits).map(Number), kv = Object.keys(checkpoints).map(Number);
  const latest = Math.max(-1, ...cv, ...kv);
  return versions.map((v) => {
    if (v < 0 || v > latest) return null;
    let base = -1;
    for (const k of kv) if (k <= v && k > base) base = k;
    const state = new Map(base >= 0 ? checkpoints[base] : []);
    for (let u = base + 1; u <= v; u++) {
      if (!(u in commits)) return null;
      for (const a of commits[u]) {
        if (a[0] === "add") state.set(a[1], a[2]);
        else state.delete(a[1]);
      }
    }
    let bytes = 0;
    for (const s of state.values()) bytes += s;
    return [state.size, bytes];
  });
}

const pyStr = (s) => `'${s}'`;
const pyAct = (a) => (a[0] === "add" ? `('add', ${pyStr(a[1])}, ${a[2]})` : `('remove', ${pyStr(a[1])})`);
function pyArgs(commits, checkpoints, versions) {
  const c = "{" + Object.keys(commits).map(Number).sort((a, b) => a - b).map((v) => `${v}: [${commits[v].map(pyAct).join(", ")}]`).join(", ") + "}";
  const k = "{" + Object.keys(checkpoints).map(Number).sort((a, b) => a - b).map((v) => `${v}: [${checkpoints[v].map(([p, s]) => `(${pyStr(p)}, ${s})`).join(", ")}]`).join(", ") + "}";
  return `(${c}, ${k}, [${versions.join(", ")}])`;
}
const pyOut = (xs) => "[" + xs.map((x) => (x === null ? "None" : `(${x[0]}, ${x[1]})`)).join(", ") + "]";

// A full history, then checkpoints from the true states, then what retention removed.
function smallLog(r, level) {
  const L = level === 3 ? r.int(12, 15) : r.int(9, 14);
  const K = r.int(3, 4);
  const commits = {}, checkpoints = {};
  const active = new Map();
  let serial = r.int(1, 40);
  const newPath = () => `part-${String(serial += r.int(1, 3)).padStart(5, "0")}.parquet`;
  const size = () => r.int(1, 99) * 1000 + r.int(0, 999);
  for (let v = 0; v <= L; v++) {
    const acts = [];
    const keys = [...active.keys()];
    const kind = v === 0 || keys.length < 2 ? "write" : r.pick(level === 3 ? ["write", "compact", "delete", "readd", "flip"] : ["write", "write", "compact", "delete"]);
    if (kind === "write") for (let k = r.int(1, 3); k > 0; k--) acts.push(["add", newPath(), size()]);
    else if (kind === "compact") {
      for (const p of r.sample(keys, Math.min(keys.length, r.int(2, 3)))) acts.push(["remove", p]);
      acts.push(["add", newPath(), size()]);
    } else if (kind === "delete") {
      acts.push(["remove", r.pick(keys)]);
      if (level >= 2 && r.chance(0.5)) acts.push(["remove", `part-${String(r.int(0, 9)).padStart(5, "0")}.parquet`]);   // never active
    } else if (kind === "readd") acts.push(["add", r.pick(keys), size()]);
    else {                                            // flip: remove+add one path, add+remove another
      const p = r.pick(keys);
      acts.push(["remove", p], ["add", p, size()]);
      const q = newPath();
      acts.push(["add", q, size()], ["remove", q]);
    }
    for (const a of acts) { if (a[0] === "add") active.set(a[1], a[2]); else active.delete(a[1]); }
    commits[v] = acts;
    if (v > 0 && v % K === 0) checkpoints[v] = [...active.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }
  if (level >= 2) {
    const c0 = level === 3 ? K : K * r.int(1, 2);
    for (let v = 0; v <= c0; v++) delete commits[v];
    for (const v of Object.keys(checkpoints).map(Number)) if (v < c0) delete checkpoints[v];
  }
  if (level === 3) {
    const cps = Object.keys(checkpoints).map(Number).sort((a, b) => a - b);
    const g = cps[cps.length - 1] + 1 <= L ? cps[cps.length - 1] - r.int(1, K - 1) : cps[0] + 1;
    delete commits[g];                                   // a missing commit between checkpoints
    delete commits[cps[cps.length - 1]];                 // a checkpoint whose own commit file is gone
  }
  const versions = [];
  for (let v = level === 1 ? 0 : -1; v <= L + (level === 1 ? 0 : 2); v++) versions.push(v);
  return { commits, checkpoints, versions: r.shuffle(versions.concat(r.sample(versions, 3))) };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const { commits, checkpoints, versions } = smallLog(r, level);
    samples.push({ args: pyArgs(commits, checkpoints, versions), expect: pyOut(oracle(commits, checkpoints, versions)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));
  for (let i = 0; i < 3; i++) {
    const { commits, checkpoints, versions } = smallLog(r, level);
    tests.push({ name: `random log ${i + 1}`, args: pyArgs(commits, checkpoints, versions), expect: pyOut(oracle(commits, checkpoints, versions)) });
  }

  const s1 = r.int(1, 9) * 1000, s2 = r.int(10, 99) * 1000, s3 = r.int(100, 300) * 1000;
  const A = "part-00001.parquet", B = "part-00002.parquet", C = "part-00003.parquet";
  const edges = [
    ["no checkpoint: replay from version 0", { 0: [["add", A, s1], ["add", B, s2]], 1: [["remove", A]] }, {}, [0, 1]],
    ["a query at a checkpoint version uses the checkpoint", { 0: [["add", A, s1]], 1: [["add", B, s2]], 2: [["add", C, s3]] }, { 2: [[A, s1], [B, s2], [C, s3]] }, [2, 1]],
    ["the latest checkpoint at or below the version is the base", { 0: [["add", A, s1]], 1: [["add", B, s2]], 2: [["remove", A]], 3: [["add", C, s3]] }, { 1: [[A, s1], [B, s2]] }, [3, 2, 0]],
    ["removing every file leaves an empty table, not None", { 0: [["add", A, s1]], 1: [["remove", A]] }, {}, [1]],
  ];
  if (level >= 2) {
    edges.push(["a remove of a file that is not active is ignored", { 0: [["add", A, s1]], 1: [["remove", B]], 2: [["remove", A], ["remove", A]] }, {}, [1, 2]]);
    edges.push(["versions below 0 or above the latest are None", { 0: [["add", A, s1]], 1: [["add", B, s2]] }, {}, [-1, 2, 1]]);
    edges.push(["cleaned-up history: versions before the oldest checkpoint are None", { 3: [["add", C, s3]], 4: [["remove", A]] }, { 2: [[A, s1], [B, s2]] }, [0, 1, 2, 3, 4]]);
  }
  if (level === 3) {
    edges.push(["a checkpoint stands in for its own missing commit", { 0: [["add", A, s1]], 1: [["add", B, s2]], 3: [["add", C, s3]] }, { 2: [[A, s1], [B, s2]] }, [2, 3]]);
    edges.push(["a missing commit breaks every later version until the next checkpoint", { 0: [["add", A, s1]], 2: [["add", B, s2]], 3: [["add", C, s3]], 5: [["remove", B]] }, { 4: [[A, s1], [B, s2], [C, s3]] }, [1, 2, 3, 4, 5]]);
    edges.push(["re-adding an active path replaces its size", { 0: [["add", A, s1]], 1: [["add", A, s2]] }, {}, [0, 1]]);
    edges.push(["actions apply in order inside one commit", { 0: [["add", A, s1]], 1: [["remove", A], ["add", A, s3], ["add", B, s2], ["remove", B]] }, {}, [1]]);
  }
  for (const [name, commits, checkpoints, versions] of edges) tests.push({ name, args: pyArgs(commits, checkpoints, versions), expect: pyOut(oracle(commits, checkpoints, versions)) });

  // Timing: 3 000 versions, a checkpoint every 100, 30 000 queries. Rebuilding each query
  // from its checkpoint costs thousands of operations per query; grouping the queries by
  // checkpoint and replaying forward costs each commit once.
  const seed = r.int(1, 1_000_000);
  const keep = level === 1 ? 0 : 400;
  const gap = level === 3 ? 1777 : null;
  tests.push({ name: "3,000 versions and 30,000 queries in time (each commit replayed once)", args: `_gen_case(3000, ${seed}, 100, 30000, ${keep}, ${gap === null ? "None" : gap}, ${level === 1 ? "True" : "False"})`, limit_s: 8 });

  return {
    vars: {
      log_rule: level === 1
        ? "In this exercise every commit from version 0 is present and every queried version exists."
        : level === 2
          ? "Old history may have been cleaned up: commits (and checkpoints) below some version can be missing. Return `None` for a version that is negative, above the latest version, or cannot be rebuilt because a commit it needs is missing."
          : "History can be incomplete: old commits and checkpoints may have been cleaned up, and a single commit file can be missing anywhere (even at a checkpoint version, where the checkpoint is enough). Return `None` for a version that is negative, above the latest version, or cannot be rebuilt because a commit it needs is missing.",
    },
    samples,
    tests,
  };
}
