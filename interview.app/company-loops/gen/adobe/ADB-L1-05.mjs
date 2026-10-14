/* ADB-L1-05 — Cloud document sync plan from local, cloud and last-synced hashes (Python).
   Simulated practice scenario. All data is generated from the seed. The sync rules are this
   exercise's, stated in the problem; they do not describe how any product's sync works.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which decides each path from "changed locally?" and
   "changed in the cloud?" flags; the evaluator's reference applies the four ordered rules from the
   problem statement with dictionaries, written independently.
   level: 1 Medium (edits and new files only)
          · 2 Hard (+ deletions: a path missing on one side, edit/delete conflicts)
          · 3 Very Hard (+ local and cloud are journals: a path can appear several times, the last entry
            wins, and a None hash is a deletion) */
export const kind = "python";
export const entry = "sync_plan";
export const signature = "def sync_plan(local: list[tuple[str, str | None]], cloud: list[tuple[str, str | None]], base: list[tuple[str, str]]) -> dict[str, str]:";
export const starter = `def sync_plan(local, cloud, base):
    """local, cloud: (path, content_hash) for each file on this device and in cloud storage.
    base: (path, content_hash) as of the last successful sync.
    Return {path: action} for every path in any of the three lists, where action is one of
    'upload', 'download', 'delete_local', 'delete_cloud', 'conflict', 'none'."""
    ...
`;

export const prelude = `
def _sync_case(n, seed, deletions, journal):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    def h():
        return '%08x' % (rnd(65536) * 65536 + rnd(65536))
    base, local, cloud = [], [], []
    for i in range(n):
        p = 'projects/p%03d/doc_%06d.psd' % (rnd(500), i)
        b = h() if rnd(10) < 8 else None
        if b is not None:
            base.append((p, b))
        for side in (local, cloud):
            c = rnd(10)
            if c < 6 and b is not None:
                side.append((p, b))
            elif c < 8 or b is None:
                side.append((p, h()))
            elif deletions:
                if journal and rnd(2):
                    side.append((p, None))
            else:
                side.append((p, b))
    if journal:                                  # replay part of each journal: earlier states first
        for side in (local, cloud):
            extra = [(side[rnd(len(side))][0], h()) for _ in range(n // 4)]
            side[:0] = extra
    local.reverse()
    return local, cloud, base
`.trim() + "\n";

// Each path from two flags: did it change locally since the last sync, and did it change in the cloud?
export function oracle(local, cloud, base) {
  const last = (list) => { const m = new Map(); for (const [p, h] of list) m.set(p, h); return m; };
  const L = last(local), C = last(cloud), B = last(base);
  const out = new Map();
  for (const p of [...new Set([...L.keys(), ...C.keys(), ...B.keys()])].sort()) {
    const l = L.has(p) ? L.get(p) : null, c = C.has(p) ? C.get(p) : null, b = B.has(p) ? B.get(p) : null;
    const lChanged = l !== b, cChanged = c !== b;
    let a;
    if (!lChanged && !cChanged) a = "none";
    else if (lChanged && !cChanged) a = l === null ? "delete_cloud" : "upload";
    else if (!lChanged && cChanged) a = c === null ? "delete_local" : "download";
    else a = l === c ? "none" : "conflict";
    out.set(p, a);
  }
  return out;
}

const pyStr = (s) => (s === null ? "None" : `'${s}'`);
const pyList = (xs) => "[" + xs.map(([p, h]) => `(${pyStr(p)}, ${pyStr(h)})`).join(", ") + "]";
const pyArgs = (l, c, b) => `(${pyList(l)}, ${pyList(c)}, ${pyList(b)})`;
const pyOut = (m) => "{" + [...m.entries()].map(([p, a]) => `'${p}': '${a}'`).join(", ") + "}";

const FOLDERS = ["brand", "campaign", "catalog", "client", "print", "social"];
const FILES = ["banner.psd", "brochure.indd", "cover.ai", "deck.pdf", "flyer.psd", "logo.ai", "poster.indd", "report.pdf"];

function randomCase(r, level) {
  const hex = () => Array.from({ length: 8 }, () => "0123456789abcdef"[r.int(0, 15)]).join("");
  const paths = new Set();
  const n = r.int(6, level === 1 ? 8 : 10);
  while (paths.size < n) paths.add(r.pick(FOLDERS) + "/" + r.pick(FILES));
  const base = [], local = [], cloud = [];
  for (const p of r.shuffle([...paths])) {
    const b = r.chance(0.75) ? hex() : null;
    if (b !== null) base.push([p, b]);
    const shared = hex();                       // both sides may make the same edit
    for (const side of [local, cloud]) {
      const c = r.int(0, 9);
      if (b === null) { if (c < 6) side.push([p, c < 2 ? shared : hex()]); continue; }
      if (c < 5) side.push([p, b]);
      else if (c < 7) side.push([p, hex()]);
      else if (c < 8) side.push([p, shared]);
      else if (level === 1) side.push([p, b]);
      else if (level === 3 && r.chance(0.5)) side.push([p, null]);
      // else: missing from this side (deleted)
    }
    if (b === null && !local.some((x) => x[0] === p) && !cloud.some((x) => x[0] === p)) local.push([p, hex()]);
  }
  if (level === 3) {                            // earlier journal entries, overwritten later
    for (const side of [local, cloud]) {
      for (let k = r.int(1, 3); k > 0 && side.length; k--) {
        const [p] = r.pick(side);
        const at = side.findIndex((x) => x[0] === p);
        side.splice(at, 0, [p, r.chance(0.3) ? null : hex()]);
      }
    }
  }
  return { local, cloud, base };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.local, c.cloud, c.base), expect: pyOut(oracle(c.local, c.cloud, c.base)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const hex = () => Array.from({ length: 8 }, () => "0123456789abcdef"[r.int(0, 15)]).join("");
  const [h1, h2, h3] = [hex(), hex(), hex()];
  const p = r.pick(FOLDERS) + "/" + r.pick(FILES);
  const q = r.pick(FOLDERS.filter((f) => !p.startsWith(f))) + "/" + r.pick(FILES);
  const edges = [
    ["unchanged everywhere", [[p, h1]], [[p, h1]], [[p, h1]]],
    ["edited locally only: upload", [[p, h2]], [[p, h1]], [[p, h1]]],
    ["edited in the cloud only: download", [[p, h1]], [[p, h2]], [[p, h1]]],
    ["edited on both sides differently: conflict", [[p, h2]], [[p, h3]], [[p, h1]]],
    ["the same edit on both sides: nothing to do", [[p, h2]], [[p, h2]], [[p, h1]]],
    ["new on this device only: upload; new in the cloud only: download", [[p, h1]], [[q, h2]], []],
    ["new on both sides with different contents: conflict", [[p, h1]], [[p, h2]], []],
  ];
  if (level >= 2) {
    edges.push(["deleted locally, unchanged in the cloud: delete_cloud", [], [[p, h1]], [[p, h1]]]);
    edges.push(["deleted in the cloud, unchanged locally: delete_local", [[p, h1]], [], [[p, h1]]]);
    edges.push(["deleted locally but edited in the cloud: conflict", [], [[p, h2]], [[p, h1]]]);
    edges.push(["edited locally but deleted in the cloud: conflict", [[p, h2]], [], [[p, h1]]]);
    edges.push(["deleted on both sides: nothing to do", [], [], [[p, h1]]]);
  }
  if (level === 3) {
    edges.push(["the last journal entry wins: edited and then reverted locally", [[p, h2], [p, h1]], [[p, h1]], [[p, h1]]]);
    edges.push(["a None hash is a deletion", [[p, h1], [p, null]], [[p, h1]], [[p, h1]]]);
    edges.push(["deleted and then re-created locally with new contents", [[p, null], [p, h2]], [[p, h1]], [[p, h1]]]);
    edges.push(["created and deleted locally before any sync", [[p, h1], [p, null]], [], []]);
  }
  for (const [name, l, c, b] of edges) tests.push({ name, args: pyArgs(l, c, b), expect: pyOut(oracle(l, c, b)) });

  // Timing: 100 000 files. Three dictionaries make every lookup O(1); scanning the other
  // lists for each path is O(n²).
  tests.push({
    name: "100,000 files (dictionaries, not a scan of the other lists per path)",
    args: `_sync_case(100000, ${r.int(1, 1_000_000)}, ${level >= 2 ? "True" : "False"}, ${level === 3 ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      delete_rule: level === 1
        ? "In this exercise nothing is deleted: every path in `base` is still in `local` and in `cloud`."
        : "A path missing from a list does not exist on that side (it was deleted, or never existed there).",
      journal_rule: level === 3
        ? "`local` and `cloud` are journals in the order the changes happened: a path can appear several times and its last entry is its current state, and a hash of `None` means the file was deleted. `base` is a snapshot with each path once."
        : "Each path appears at most once in each list, and every hash is a string.",
    },
    samples,
    tests,
  };
}
