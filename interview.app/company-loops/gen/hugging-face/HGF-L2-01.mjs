/* HGF-L2-01 — Changed files between two revisions of a hub repository (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which flattens both revisions into a
   {path: (mode, id)} map and compares the maps: the naive method, fine for small
   repositories. The evaluator's reference walks the two trees together and skips
   every subtree whose id is the same on both sides; it is written independently.
   level: 1 Medium (two directory levels; files modified, added and deleted)
          · 2 Hard (+ deeper trees, whole directories added, deleted and renamed,
            executable-bit changes, pairs compared in reverse)
          · 3 Very Hard (+ a file replaced by a directory and back, one subtree
            shared by two paths, the same commit on both sides, unknown commits) */
export const kind = "python";
export const entry = "diff_revisions";
export const signature = "def diff_revisions(trees: dict[str, dict[str, tuple[str, str]]], commits: dict[str, str], pairs: list[tuple[str, str]]) -> list[list[tuple[str, str]] | None]:";
export const starter = `def diff_revisions(trees, commits, pairs):
    """trees: {tree_id: {name: (mode, object_id)}}, mode 'file' | 'exec' | 'dir'
       ('dir' entries point at another tree id).
    commits: {commit_id: root_tree_id}.
    pairs: [(old_commit, new_commit), ...].
    Return one entry per pair: a list of (path, status) sorted by path, with
    status 'A', 'D' or 'M', or None if either commit is unknown."""
    ...
`;

export const prelude = `
def _gen_hub_repo(top, fan, leaf, n_commits, n_pairs, seed):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    trees, intern, blob = {}, {}, [0]
    def put(entries):
        key = tuple(sorted(entries.items()))
        tid = intern.get(key)
        if tid is None:
            tid = 't%06d' % len(intern)
            intern[key] = tid
            trees[tid] = dict(entries)
        return tid
    def new_blob():
        blob[0] += 1
        return 'b%07d' % blob[0]
    mids = {}
    for i in range(top):
        sub = {}
        for j in range(fan):
            sub['part-%03d' % j] = ('dir', put({'shard-%05d.parquet' % k: ('file', new_blob()) for k in range(leaf)}))
        mids['split-%03d' % i] = ('dir', put(sub))
    mids['README.md'] = ('file', new_blob())
    root = put(mids)
    commits = {'c00000': root}
    for c in range(1, n_commits):
        r = dict(trees[root])
        for _ in range(1 + rnd(3)):
            i, j, k = 'split-%03d' % rnd(top), 'part-%03d' % rnd(fan), 'shard-%05d.parquet' % rnd(leaf + 2)
            mid = dict(trees[r[i][1]])
            lf = dict(trees[mid[j][1]])
            if k in lf and rnd(4) == 0 and len(lf) > 1:
                del lf[k]
            else:
                lf[k] = ('file', new_blob())
            mid[j] = ('dir', put(lf))
            r[i] = ('dir', put(mid))
        root = put(r)
        commits['c%05d' % c] = root
    pairs = []
    for _ in range(n_pairs):
        a = rnd(n_commits - 3)
        pairs.append(('c%05d' % a, 'c%05d' % (a + 1 + rnd(3))))
    return trees, commits, pairs
`.trim() + "\n";

// ---- the specification, implemented the obvious way: flatten and compare ----
function flatten(trees, tid, prefix, out) {
  for (const [name, [mode, oid]] of Object.entries(trees[tid])) {
    if (mode === "dir") flatten(trees, oid, prefix + name + "/", out);
    else out.set(prefix + name, mode + ":" + oid);
  }
  return out;
}
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export function oracle(trees, commits, pairs) {
  return pairs.map(([a, b]) => {
    if (!(a in commits) || !(b in commits)) return null;
    const A = flatten(trees, commits[a], "", new Map());
    const B = flatten(trees, commits[b], "", new Map());
    const ch = [];
    for (const [p, v] of A) {
      if (!B.has(p)) ch.push([p, "D"]);
      else if (B.get(p) !== v) ch.push([p, "M"]);
    }
    for (const p of B.keys()) if (!A.has(p)) ch.push([p, "A"]);
    return ch.sort((x, y) => cmp(x[0], y[0]));
  });
}

// ---- building content-addressed trees from nested JS objects ----
// A working tree is {d: {name: node}}; a file is {m: "file" | "exec", o: blob_id}.
function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}
function store(node, trees, seen) {
  const ent = {};
  for (const name of Object.keys(node.d).sort()) {
    const ch = node.d[name];
    ent[name] = ch.d ? ["dir", store(ch, trees, seen)] : [ch.m, ch.o];
  }
  const canon = JSON.stringify(Object.entries(ent));
  let id = seen.get(canon);
  if (!id) {
    id = fnv(canon);
    while (trees[id]) id = fnv(id + "#");
    seen.set(canon, id);
    trees[id] = ent;
  }
  return id;
}
const clone = (n) => (n.d ? { d: Object.fromEntries(Object.entries(n.d).map(([k, v]) => [k, clone(v)])) } : { m: n.m, o: n.o });

const pyStr = (s) => "'" + s + "'";
const pyTrees = (trees) => "{" + Object.entries(trees).map(([id, ent]) =>
  pyStr(id) + ": {" + Object.entries(ent).map(([n, [m, o]]) => `${pyStr(n)}: (${pyStr(m)}, ${pyStr(o)})`).join(", ") + "}").join(", ") + "}";
const pyArgs = (trees, commits, pairs) =>
  `(${pyTrees(trees)}, {${Object.entries(commits).map(([c, t]) => `${pyStr(c)}: ${pyStr(t)}`).join(", ")}}, ` +
  `[${pairs.map(([a, b]) => `(${pyStr(a)}, ${pyStr(b)})`).join(", ")}])`;
const pyOut = (res) => "[" + res.map((x) => (x === null ? "None" : "[" + x.map(([p, s]) => `(${pyStr(p)}, ${pyStr(s)})`).join(", ") + "]")).join(", ") + "]";

const HEX = "0123456789abcdef".split("");
const hex = (r, n) => Array.from({ length: n }, () => r.pick(HEX)).join("");
const DIRS = ["onnx", "tokenizer", "checkpoints", "configs", "eval", "adapters", "gguf", "runs", "scripts", "assets", "openvino", "quantized", "logs", "images"];
const FILES = ["config.json", "model.safetensors", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json",
  "generation_config.json", "vocab.txt", "merges.txt", "pytorch_model.bin", "model.onnx", "preprocessor_config.json",
  "training_args.bin", "adapter_config.json", "adapter_model.safetensors", "results.json", "train.py",
  "model-00001-of-00002.safetensors", "model-00002-of-00002.safetensors", "README.md", "run.sh"];
const PINNED = new Set(["README.md", ".gitattributes"]);   // root files that never move or disappear

function randomDir(r, depth) {
  const node = { d: {} };
  for (const f of r.sample(FILES.filter((x) => x !== "README.md"), r.int(1, 3))) node.d[f] = { m: r.chance(0.1) ? "exec" : "file", o: hex(r, 8) };
  if (depth > 1) for (const dn of r.sample(DIRS, r.int(0, 2))) node.d[dn] = randomDir(r, depth - 1);
  return node;
}

// Every file and directory below the root, as [parent, name, node, depth].
function walk(node, depth, out = []) {
  for (const [name, ch] of Object.entries(node.d)) {
    out.push([node, name, ch, depth]);
    if (ch.d) walk(ch, depth + 1, out);
  }
  return out;
}
function prune(node) {
  for (const [name, ch] of Object.entries(node.d)) if (ch.d) { prune(ch); if (!Object.keys(ch.d).length) delete node.d[name]; }
}

function mutate(r, root, level, maxDepth) {
  const all = walk(root, 1);
  const files = all.filter(([p, n, ch]) => !ch.d && !(p === root && PINNED.has(n)));
  const dirs = all.filter(([, , ch]) => ch.d);
  const ops = ["modify", "modify", "add", "delete"];
  if (level >= 2) ops.push("adddir", "deldir", "movedir", "mode");
  if (level >= 3) ops.push("file2dir", "dir2file", "copydir");
  const op = r.pick(ops);
  const freeName = (parent, pool) => r.shuffle(pool).find((x) => !(x in parent.d));
  const anyFile = all.filter(([, , ch]) => !ch.d);           // README.md and .gitattributes can change
  const modify = () => { const [p, n] = r.pick(anyFile); p.d[n] = { m: p.d[n].m, o: hex(r, 8) }; };
  if (op === "modify" || (op === "delete" && files.length < 2)) {
    modify();
  } else if (op === "add") {
    const parent = r.pick([root, ...dirs.map((x) => x[2])]);
    const n = freeName(parent, FILES);
    if (n) parent.d[n] = { m: "file", o: hex(r, 8) };
  } else if (op === "delete") {
    const [p, n] = r.pick(files);
    delete p.d[n];
  } else if (op === "adddir") {
    const cand = [[root, 1], ...dirs.filter((x) => x[3] < maxDepth - 1).map((x) => [x[2], x[3] + 1])];
    const [parent, dep] = r.pick(cand);
    const n = freeName(parent, DIRS);
    if (n) parent.d[n] = randomDir(r, Math.max(1, Math.min(2, maxDepth - dep)));
  } else if (op === "deldir" && dirs.length) {
    const [p, n] = r.pick(dirs);
    delete p.d[n];
  } else if (op === "movedir" && dirs.length) {
    const [p, n, ch] = r.pick(dirs);
    const m = freeName(p, DIRS);
    if (m) { delete p.d[n]; p.d[m] = ch; }
  } else if (op === "mode" && files.length) {
    const [p, n] = r.pick(files);
    p.d[n] = { m: p.d[n].m === "exec" ? "file" : "exec", o: p.d[n].o };
  } else if (op === "file2dir" && files.length) {
    const [p, n] = r.pick(files);
    p.d[n] = randomDir(r, 1);
  } else if (op === "dir2file" && dirs.length) {
    const [p, n] = r.pick(dirs);
    p.d[n] = { m: "file", o: hex(r, 8) };
  } else if (op === "copydir" && dirs.length) {
    const [p, , ch] = r.pick(dirs);
    const m = freeName(p, DIRS);
    if (m) p.d[m] = clone(ch);
  } else {
    modify();
  }
  prune(root);
}

function randomCase(r, level) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const maxDepth = level + 1;
    const root = randomDir(r, maxDepth);
    root.d["README.md"] = { m: "file", o: hex(r, 8) };
    root.d[".gitattributes"] = { m: "file", o: hex(r, 8) };
    const trees = {}, seen = new Map(), commits = {}, ids = [];
    const nCommits = level + 2;
    let work = root;
    for (let c = 0; c < nCommits; c++) {
      if (c) {
        work = clone(work);
        for (let k = r.int(1, level + 1); k > 0; k--) mutate(r, work, level, maxDepth);
      }
      const id = hex(r, 7);
      commits[id] = store(work, trees, seen);
      ids.push(id);
    }
    const pairs = [];
    const nPairs = level + 1;
    for (let k = 0; k < nPairs; k++) {
      const i = r.int(0, nCommits - 2), j = r.int(i + 1, nCommits - 1);
      pairs.push(level >= 2 && r.chance(0.3) ? [ids[j], ids[i]] : [ids[i], ids[j]]);
    }
    if (level === 3) {
      const c = r.pick(ids);
      pairs.splice(r.int(0, pairs.length), 0, r.chance(0.5) ? [c, c] : [c, hex(r, 7)]);
    }
    const got = oracle(trees, commits, pairs);
    if (got.filter((x) => x && x.length).length >= Math.min(2, nPairs)) return { trees, commits, pairs, got };
  }
  throw new Error("HGF-L2-01: could not build a sample");
}

// A fixed test: build each revision from a nested object; pairs name revisions by index.
function fixed(r, revs, pairIdx, extraPairs = []) {
  const trees = {}, seen = new Map(), commits = {}, ids = [];
  for (const rev of revs) {
    const id = hex(r, 7);
    commits[id] = store(rev, trees, seen);
    ids.push(id);
  }
  const pairs = pairIdx.map(([a, b]) => [typeof a === "number" ? ids[a] : a, typeof b === "number" ? ids[b] : b]).concat(extraPairs);
  return { args: pyArgs(trees, commits, pairs), expect: pyOut(oracle(trees, commits, pairs)) };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.trees, c.commits, c.pairs), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const f = (o = hex(r, 8), m = "file") => ({ m, o });
  const D = (entries) => ({ d: entries });
  const [d1, d2, d3, d4] = r.sample(DIRS, 4);
  const [fa, fb, fc] = r.sample(FILES.filter((x) => x !== "README.md"), 3);
  const readme = f(), attrs = f(), deep = f(), other = f(), leaf2 = f();
  const base = () => D({ "README.md": readme, ".gitattributes": attrs,
    [d1]: D({ [fa]: other, [d2]: D({ [d3]: D({ [fb]: deep, [fc]: leaf2 }) }) }), [d4]: D({ [fa]: f(other.o) }) });
  const b0 = base();
  const b1 = base(); b1.d[d1].d[d2].d[d3].d[fb] = f();
  const added = base(); added.d[d1].d["onnx-export"] = D({ "model.onnx": f(), "config.json": f(), "int8": D({ "model_quantized.onnx": f() }) });
  const edges = [
    ["one file changed three directories deep; nothing else differs", [b0, b1], [[0, 1]]],
    ["an added directory lists every file under it, recursively", [b0, added], [[0, 1]]],
    ["a deleted directory lists every file it held", [added, b0], [[0, 1]]],
    ["comparing the same two revisions in reverse turns additions into deletions", [b0, added], [[0, 1], [1, 0]]],
  ];
  const sorty0 = D({ "README.md": readme, onnx: D({ "model.onnx": f() }), "onnx.json": f(), "onnx-int8": D({ "model.onnx": f() }) });
  const sorty1 = D({ "README.md": f(), onnx: D({ "model.onnx": f() }), "onnx.json": f(), "onnx-int8": D({ "model.onnx": f() }) });
  edges.push(["paths sort as whole strings: 'onnx-int8/…' < 'onnx.json' < 'onnx/…'", [sorty0, sorty1], [[0, 1]]]);
  if (level >= 2) {
    const moved = base(); moved.d[d1].d["renamed-" + d2] = moved.d[d1].d[d2]; delete moved.d[d1].d[d2];
    edges.push(["a renamed directory: its files are deleted at the old path and added at the new one", [b0, moved], [[0, 1]]]);
    const ex = base(); ex.d[d1].d[d2].d[d3].d[fb] = f(deep.o, "exec");
    edges.push(["only the executable bit changes on one file: a modification", [b0, ex], [[0, 1]]]);
    edges.push(["several pairs over three revisions, in both directions", [b0, b1, added], [[0, 2], [2, 1], [1, 0]]]);
  }
  if (level === 3) {
    const f2d = base(); f2d.d[d1].d[fa] = D({ "part-1.bin": f(), "part-2.bin": f() });
    edges.push(["a file replaced by a directory of the same name", [b0, f2d], [[0, 1]]]);
    const d2f = base(); d2f.d[d1].d[d2] = f();
    edges.push(["a directory replaced by a file of the same name", [b0, d2f], [[0, 1]]]);
    const shared0 = base(); shared0.d[d4].d[d3] = clone(shared0.d[d1].d[d2].d[d3]);
    const shared1 = base(); shared1.d[d4].d[d3] = clone(shared1.d[d1].d[d2].d[d3]); shared1.d[d4].d[d3].d[fc] = f();
    edges.push(["one subtree id at two paths; only the copy under one path changes", [shared0, shared1], [[0, 1]]]);
    edges.push(["the same commit on both sides, and an unknown commit, next to a real diff", [b0, b1], [[0, 0], [0, 1]], [["0000000", "ffffff0"]]]);
  } else {
    edges.push(["an unknown commit id gives None for that pair only", [b0, b1], [[0, 1]], [[hex(r, 7) + "x", "c" + hex(r, 6)]]]);
  }
  for (const [name, revs, pairIdx, extra] of edges) {
    const c = fixed(r, revs, pairIdx, extra || []);
    tests.push({ name, args: c.args, expect: c.expect });
  }

  // Timing: a dataset-style repository with 64 000 files in three directory levels,
  // 300 commits that each touch a few files, and 400 diffs between nearby commits.
  // Skipping equal subtree ids touches a few hundred entries per diff; flattening
  // both revisions touches 128 000 paths per diff.
  tests.push({
    name: "64,000 files, 300 commits, 400 diffs of nearby commits (skip equal subtrees)",
    args: `_gen_hub_repo(40, 40, 40, 300, 400, ${r.int(1, 1_000_000)})`,
    limit_s: 8,
  });

  return {
    vars: {
      tree_rule: level === 1
        ? "In this replay repositories are at most two directories deep, and commits modify, add and delete files."
        : level === 2
          ? "In this replay commits also add, delete and rename whole directories and flip the executable bit, and some pairs compare a newer commit against an older one."
          : "In this replay a commit may also replace a file with a directory of the same name (or the reverse), the same subtree may appear at two paths, and a pair may name the same commit twice or a commit that does not exist.",
    },
    samples,
    tests,
  };
}
