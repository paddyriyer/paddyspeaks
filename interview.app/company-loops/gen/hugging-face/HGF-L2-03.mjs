/* HGF-L2-03 — Debug the repository activity digest (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes): the day is the local date in the
   timestamp, not the UTC date; pushes are keyed by the name at push time, so
   history before a rename or transfer is lost; a transfer rebuilds the record and
   makes private repositories public; deleting a repository purges its counted
   pushes, so a restored one loses its history; visibility is checked only at the
   end, so pushes made while private are shown once the repository goes public.
   level: 1 Medium (renames, visibility changes, UTC offsets)
          · 2 Hard (+ transfers, deletions)
          · 3 Very Hard (+ restores, rejected pushes to deleted repositories, a
            name reused by a new repository after a rename) */
export const kind = "debug";
export const entry = "activity_digest";
export const signature = "def activity_digest(events: list[dict]) -> dict[str, dict[str, int]]:";
export const starter = `def activity_digest(events):
    repos = {}      # repo id -> {"owner", "name", "private", "deleted"}
    counts = {}     # (day, "owner/name") -> pushes
    for ev in events:
        t, rid = ev["type"], ev["repo"]
        rec = repos.get(rid)
        if t == "create":
            owner, name = ev["name"].split("/")
            repos[rid] = {"owner": owner, "name": name,
                          "private": ev["private"], "deleted": False}
        elif rec is None:
            continue
        elif t == "push":
            if rec["deleted"]:
                continue
            day = ev["ts"][:10]
            key = (day, rec["owner"] + "/" + rec["name"])
            counts[key] = counts.get(key, 0) + 1
        elif t == "rename":
            rec["name"] = ev["name"]
        elif t == "transfer":
            repos[rid] = {"owner": ev["owner"], "name": rec["name"],
                          "private": ev.get("private", False), "deleted": False}
        elif t == "visibility":
            rec["private"] = ev["private"]
        elif t == "delete":
            rec["deleted"] = True
            full = rec["owner"] + "/" + rec["name"]
            for key in [k for k in counts if k[1] == full]:
                del counts[key]
        elif t == "restore":
            rec["deleted"] = False
    visible = {r["owner"] + "/" + r["name"] for r in repos.values()
               if not r["deleted"] and not r["private"]}
    digest = {}
    for (day, full), n in counts.items():
        if full in visible:
            digest.setdefault(day, {})[full] = n
    return digest
`;

export const prelude = `
def _gen_hub_events(n, seed):
    from datetime import datetime, timezone, timedelta
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    zones = [timezone(timedelta(minutes=m)) for m in (0, -420, -240, 60, 330, 540, -600)]
    owners = ['user%d' % i for i in range(300)] + ['org%d' % i for i in range(60)]
    live, dead, out, t0 = [], [], [], 1790000000
    for i in range(n):
        ts = datetime.fromtimestamp(t0 + 7 * i, zones[rnd(7)]).isoformat()
        k = rnd(100)
        if k < 5 or not live:
            rid = 'r%d' % i
            out.append({'type': 'create', 'repo': rid, 'ts': ts,
                        'name': '%s/m%d' % (owners[rnd(360)], i), 'private': rnd(4) == 0})
            live.append(rid)
        elif k < 75:
            pool = dead if (k < 8 and dead) else live
            out.append({'type': 'push', 'repo': pool[rnd(len(pool))], 'ts': ts})
        elif k < 80:
            out.append({'type': 'rename', 'repo': live[rnd(len(live))], 'ts': ts, 'name': 'm%d' % i})
        elif k < 83:
            out.append({'type': 'transfer', 'repo': live[rnd(len(live))], 'ts': ts, 'owner': owners[rnd(360)]})
        elif k < 90:
            out.append({'type': 'visibility', 'repo': live[rnd(len(live))], 'ts': ts, 'private': rnd(3) == 0})
        elif k < 95 and len(live) > 1:
            rid = live.pop(rnd(len(live)))
            dead.append(rid)
            out.append({'type': 'delete', 'repo': rid, 'ts': ts})
        elif dead:
            rid = dead.pop(rnd(len(dead)))
            live.append(rid)
            out.append({'type': 'restore', 'repo': rid, 'ts': ts})
    return (out,)
`.trim() + "\n";

// ---- the specification, implemented independently of the Python reference ----
const utcDay = (ts) => new Date(Date.parse(ts)).toISOString().slice(0, 10);
export function oracle(events) {
  const repos = new Map();     // id -> {owner, name, priv, gone, pushes: Map(day -> n)}
  for (const e of events) {
    if (e.type === "create") {
      const [owner, name] = e.name.split("/");
      repos.set(e.repo, { owner, name, priv: e.private, gone: false, pushes: new Map() });
      continue;
    }
    const s = repos.get(e.repo);
    if (!s) continue;
    if (e.type === "push") {
      if (s.gone || s.priv) continue;
      const d = utcDay(e.ts);
      s.pushes.set(d, (s.pushes.get(d) || 0) + 1);
    } else if (e.type === "rename") s.name = e.name;
    else if (e.type === "transfer") s.owner = e.owner;
    else if (e.type === "visibility") s.priv = e.private;
    else if (e.type === "delete") s.gone = true;
    else if (e.type === "restore") s.gone = false;
  }
  const out = {};
  for (const s of repos.values()) {
    if (s.gone || s.priv) continue;
    for (const [d, n] of s.pushes) (out[d] ||= {})[s.owner + "/" + s.name] = n;
  }
  return out;
}

function py(v) {
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `'${k}': ${py(x)}`).join(", ") + "}";
}
const pyArgs = (events) => "(" + py(events) + ",)";

// ---- timestamps: an increasing UTC instant, written in a local offset ----
const OFFSETS = [0, -420, -300, -240, 60, 120, 330, 540, 600, -600];
const p2 = (n) => String(n).padStart(2, "0");
function stamp(utcMs, offMin) {
  const d = new Date(utcMs + offMin * 60000);
  const sign = offMin < 0 ? "-" : "+", a = Math.abs(offMin);
  return `${d.toISOString().slice(0, 19)}${sign}${p2(Math.floor(a / 60))}:${p2(a % 60)}`;
}
const T0 = Date.UTC(2026, 9, 12, 0, 0, 0);

const USERS = ["ada-lab", "bjorn", "chen-w", "dimi", "esra", "farid-ml", "gita", "hiro"];
const ORGS = ["open-models", "speech-collective", "vision-coop", "nlp-commons", "edu-ml"];
const NAMES = ["tiny-tagger", "bert-legal", "whisper-small-ft", "vit-plants", "sentiment-xl", "qa-distilled",
  "ocr-receipts", "llama-adapter-med", "code-ranker", "t5-summaries", "clip-art", "speech-nl"];

function streamCase(r, level) {
  const evs = [];
  let t = T0 + r.int(0, 20) * 3600000;
  const tick = () => { t += r.int(20, 400) * 60000; return stamp(t, level === 1 && r.chance(0.5) ? 0 : r.pick(OFFSETS)); };
  const names = r.shuffle(NAMES);
  const repos = [];          // {id, owner, name, priv, gone}
  let ni = 0, rn = 0;
  const create = (priv) => {
    const rec = { id: "repo-" + (++rn) + r.int(10, 99), owner: r.pick([...USERS, ...ORGS]), name: names[ni++ % names.length], priv, gone: false };
    repos.push(rec);
    evs.push({ type: "create", repo: rec.id, ts: tick(), name: rec.owner + "/" + rec.name, private: priv });
    return rec;
  };
  create(false); create(r.chance(0.5)); if (level >= 2) create(r.chance(0.3));
  const steps = level === 1 ? r.int(10, 14) : r.int(14, 20);
  for (let i = 0; i < steps; i++) {
    const live = repos.filter((x) => !x.gone), dead = repos.filter((x) => x.gone);
    const roll = r.next();
    if (roll < 0.5 && live.length) evs.push({ type: "push", repo: r.pick(live).id, ts: tick() });
    else if (roll < 0.6 && live.length) {
      const x = r.pick(live);
      x.name = x.name + "-v" + r.int(2, 9);
      evs.push({ type: "rename", repo: x.id, ts: tick(), name: x.name });
    } else if (roll < 0.7 && live.length) {
      const x = r.pick(live);
      x.priv = !x.priv;
      evs.push({ type: "visibility", repo: x.id, ts: tick(), private: x.priv });
    } else if (roll < 0.77 && level >= 2 && live.length) {
      const x = r.pick(live);
      x.owner = r.pick(ORGS.filter((o) => o !== x.owner));
      evs.push({ type: "transfer", repo: x.id, ts: tick(), owner: x.owner });
    } else if (roll < 0.84 && level >= 2 && live.length > 1) {
      const x = r.pick(live);
      x.gone = true;
      evs.push({ type: "delete", repo: x.id, ts: tick() });
    } else if (roll < 0.92 && level === 3 && dead.length) {
      const x = r.pick(dead);
      if (r.chance(0.5)) evs.push({ type: "push", repo: x.id, ts: tick() });          // rejected, still logged
      else { x.gone = false; evs.push({ type: "restore", repo: x.id, ts: tick() }); }
    } else if (live.length) evs.push({ type: "push", repo: r.pick(live).id, ts: tick() });
  }
  if (level >= 2 && repos.length < NAMES.length && r.chance(0.5)) create(false);
  for (const x of repos.filter((y) => !y.gone && !y.priv)) if (r.chance(0.7)) evs.push({ type: "push", repo: x.id, ts: tick() });
  return evs;
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    let ev, got;
    for (let k = 0; k < 40; k++) {
      ev = streamCase(r, level);
      got = oracle(ev);
      if (Object.keys(got).length) break;
    }
    samples.push({ args: pyArgs(ev), expect: py(got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [u, o] = [r.pick(USERS), r.pick(ORGS)];
  const [n1, n2, n3] = r.sample(NAMES, 3);
  const A = "repo-a" + r.int(100, 999), B = "repo-b" + r.int(100, 999), C = "repo-c" + r.int(100, 999);
  const day = r.int(13, 20);
  const at = (d, h, m = 0, off = 0) => stamp(Date.UTC(2026, 9, d, h, m) , off);   // a UTC instant, written in an offset
  const mk = (id, name, priv, ts) => ({ type: "create", repo: id, ts, name, private: priv });
  const push = (id, ts) => ({ type: "push", repo: id, ts });
  const anchor = [mk(C, o + "/" + n3, false, at(day - 1, 9)), push(C, at(day - 1, 10))];    // keeps every digest non-empty
  const edges = [
    ["pushes are counted on their UTC day, whatever offset the timestamp is written in",
      [mk(A, u + "/" + n1, false, at(day, 0, 5)), push(A, at(day, 1, 30, -300)), push(A, at(day, 22, 15, 330)), push(A, at(day, 23, 50, 120))]],
    ["a renamed repository keeps the pushes from before the rename, under its new name",
      [...anchor, mk(A, u + "/" + n1, false, at(day, 8)), push(A, at(day, 9)), { type: "rename", repo: A, ts: at(day, 10), name: n1 + "-v2" }, push(A, at(day, 11))]],
    ["a private repository transferred to an organisation stays private",
      [...anchor, mk(A, u + "/" + n1, true, at(day, 8)), push(A, at(day, 9)), { type: "transfer", repo: A, ts: at(day, 10), owner: o }, push(A, at(day, 11))]],
    ["pushes made while a repository was private stay hidden after it goes public",
      [...anchor, mk(A, u + "/" + n1, true, at(day, 8)), push(A, at(day, 9)), push(A, at(day, 10)),
        { type: "visibility", repo: A, ts: at(day, 11), private: false }, push(A, at(day, 12))]],
    ["a repository made private at the end is left out entirely",
      [...anchor, mk(A, u + "/" + n1, false, at(day, 8)), push(A, at(day, 9)), { type: "visibility", repo: A, ts: at(day, 11), private: true }]],
  ];
  if (level >= 2) {
    edges.push(["a public repository transferred keeps its history, under the new owner",
      [...anchor, mk(A, u + "/" + n1, false, at(day, 8)), push(A, at(day, 9)), { type: "transfer", repo: A, ts: at(day + 1, 10), owner: o }, push(A, at(day + 1, 11))]]);
    edges.push(["a repository deleted at the end is left out",
      [...anchor, mk(A, u + "/" + n1, false, at(day, 8)), push(A, at(day, 9)), { type: "delete", repo: A, ts: at(day, 10) }]]);
  }
  if (level === 3) {
    edges.push(["a deleted then restored repository keeps the pushes from before the deletion",
      [...anchor, mk(A, u + "/" + n1, false, at(day, 8)), push(A, at(day, 9)), { type: "delete", repo: A, ts: at(day, 10) },
        { type: "restore", repo: A, ts: at(day + 1, 10) }, push(A, at(day + 1, 11))]]);
    edges.push(["pushes to a deleted repository are ignored, even after it is restored",
      [...anchor, mk(A, u + "/" + n1, false, at(day, 8)), { type: "delete", repo: A, ts: at(day, 10) }, push(A, at(day, 11)),
        { type: "restore", repo: A, ts: at(day, 12) }, push(A, at(day, 13))]]);
    edges.push(["a new repository takes a renamed repository's old name; each keeps its own pushes",
      [mk(A, u + "/" + n1, false, at(day, 8)), push(A, at(day, 9)), push(A, at(day, 9, 30)), { type: "rename", repo: A, ts: at(day, 10), name: n2 },
        mk(B, u + "/" + n1, false, at(day, 11)), push(B, at(day, 12))]]);
  } else {
    edges.push(["a push to an unknown repository id is ignored", [...anchor, push(B, at(day, 9))]]);
  }
  for (const [name, ev] of edges) tests.push({ name, args: pyArgs(ev), expect: py(oracle(ev)) });

  const n = level === 1 ? 100000 : 200000;
  tests.push({ name: `${n.toLocaleString("en-US")} repository events in time`, args: `_gen_hub_events(${n}, ${r.int(1, 1_000_000)})`, limit_s: 8 });

  return {
    vars: {
      replay_rule: level === 1
        ? "This replay has renames, visibility changes and timestamps in several UTC offsets; the checks also cover transfers and deletions."
        : level === 2
          ? "This replay also has ownership transfers and deletions; the checks also cover restores."
          : "This replay also has deleted repositories that are restored, pushes the hub rejected because the repository was deleted, and a name taken by a new repository after the old one was renamed.",
    },
    samples,
    tests,
  };
}
