/* GOO-L2-03 — Debug a rebuffering-ratio rollup from player heartbeats (debug, Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below,
   an independent JavaScript implementation of the specification in the template.
   Planted bugs (see the evaluator notes): deduplication on the payload
   (session, state, ms) instead of (session, seq); intervals read in arrival order,
   not seq order; a seek flag that is never cleared; the video's ratio averaged over
   sessions instead of computed from totals; a division by zero for a session that
   never started playing.
   level: 1 Medium (in-order delivery, redeliveries) · 2 Hard (+ out-of-order
          delivery, seeks) · 3 Very Hard (+ sessions abandoned during startup, and
          videos nobody managed to play) */
export const kind = "debug";
export const entry = "playback_quality";
export const signature = "def playback_quality(heartbeats: list[dict]) -> dict:";
export const starter = `def playback_quality(heartbeats):
    seen = set()
    sessions = {}
    for hb in heartbeats:
        key = (hb["session"], hb["state"], hb["ms"])
        if key in seen:                                  # a retried heartbeat
            continue
        seen.add(key)
        sessions.setdefault((hb["video"], hb["session"]), []).append(hb)

    per_video = {}
    for (video, session), beats in sessions.items():
        watch = join = rebuffer = 0
        played = after_seek = False
        for hb in beats:
            if hb["state"] == "playing":
                watch += hb["ms"]
                played = True
            elif hb["state"] == "seeking":
                after_seek = True
            elif hb["state"] == "buffering":
                if not played:
                    join += hb["ms"]                     # startup, not rebuffering
                elif not after_seek:
                    rebuffer += hb["ms"]
        v = per_video.setdefault(video, {"sessions": 0, "watch_ms": 0, "join_ms": 0,
                                         "rebuffer_ms": 0, "ratios": []})
        v["sessions"] += 1
        v["watch_ms"] += watch
        v["join_ms"] += join
        v["rebuffer_ms"] += rebuffer
        v["ratios"].append(rebuffer * 10000 // (watch + rebuffer))

    return {
        video: {
            "sessions": v["sessions"],
            "watch_ms": v["watch_ms"],
            "join_ms": v["join_ms"],
            "rebuffer_ms": v["rebuffer_ms"],
            "rebuffer_bp": sum(v["ratios"]) // len(v["ratios"]),
        }
        for video, v in per_video.items()
    }
`;

export const prelude = `
def _gen_heartbeats(n, seed):
    x, out = seed, []
    sessions = max(1, n // 12)
    seq = {}
    states = ('playing', 'playing', 'playing', 'playing', 'buffering', 'paused', 'seeking', 'buffering')
    for _ in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        s = (x >> 8) % sessions
        x = (1103515245 * x + 12345) % 2147483648
        if (x >> 8) % 25 == 0 and out:
            out.append(dict(out[-1 - (x >> 12) % min(len(out), 5)]))   # a redelivery
            continue
        seq[s] = seq.get(s, 0) + 1
        st = states[(x >> 12) % 8]
        out.append({'session': 'sess_%d' % s, 'video': 'vid_%d' % (s % 997), 'seq': seq[s],
                    'state': st, 'ms': 10000 if st == 'playing' else 100 * (1 + (x >> 4) % 60)})
    x = (1103515245 * x + 12345) % 2147483648
    k = (x >> 8) % len(out)
    out[k:k + 50] = out[k:k + 50][::-1]                                 # a burst delivered out of order
    return out
`.trim() + "\n";

// The specification, implemented independently of the Python reference.
export function oracle(heartbeats) {
  const bySession = new Map();                 // session -> {video, intervals: Map(seq -> hb)}
  for (const hb of heartbeats) {
    if (!bySession.has(hb.session)) bySession.set(hb.session, { video: hb.video, intervals: new Map() });
    const s = bySession.get(hb.session);
    if (!s.intervals.has(hb.seq)) s.intervals.set(hb.seq, hb);   // first delivery of (session, seq) counts
  }
  const videos = new Map();
  for (const s of bySession.values()) {
    const seqs = [...s.intervals.keys()].sort((a, b) => a - b);
    let watch = 0, join = 0, rebuf = 0, phase = "startup";       // startup | normal | seek
    for (const q of seqs) {
      const { state, ms } = s.intervals.get(q);
      if (state === "playing") { watch += ms; phase = "normal"; }
      else if (state === "seeking") { if (phase !== "startup") phase = "seek"; }
      else if (state === "buffering") {
        if (phase === "startup") join += ms;
        else if (phase === "normal") rebuf += ms;
      }
    }
    if (!videos.has(s.video)) videos.set(s.video, { sessions: 0, watch_ms: 0, join_ms: 0, rebuffer_ms: 0 });
    const v = videos.get(s.video);
    v.sessions += 1; v.watch_ms += watch; v.join_ms += join; v.rebuffer_ms += rebuf;
  }
  const out = {};
  for (const [vid, v] of videos) {
    const den = v.watch_ms + v.rebuffer_ms;
    out[vid] = { ...v, rebuffer_bp: den === 0 ? 0 : Math.floor((v.rebuffer_ms * 10000) / den) };
  }
  return out;
}

function py(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return "'" + v + "'";
  if (Array.isArray(v)) return "[" + v.map(py).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `'${k}': ${py(x)}`).join(", ") + "}";
}
const pyArgs = (hbs) => "(" + py(hbs) + ",)";

const ALNUM = "abcdefghijklmnopqrstuvwxyz0123456789";
const rid = (r, pre) => pre + Array.from({ length: 6 }, () => r.pick(ALNUM.split(""))).join("");
const HB = 10000;                              // a playing heartbeat every 10 seconds

// One session's intervals in seq order.
function sessionStory(r, level, video, session) {
  const out = [];
  const add = (state, ms) => out.push({ session, video, seq: out.length + 1, state, ms });
  for (let k = r.int(1, 2); k > 0; k--) add("buffering", 100 * r.int(3, 25));
  if (level === 3 && r.chance(0.25)) return out;                       // abandoned during startup
  const steps = level === 1 ? r.int(3, 5) : r.int(4, 7);
  for (let i = 0; i < steps; i++) {
    add("playing", HB);
    const roll = r.next();
    if (roll < 0.3) add("buffering", 100 * r.int(2, 40));
    else if (roll < 0.45) add("paused", 100 * r.int(10, 300));
    else if (level >= 2 && roll < 0.65) {
      add("seeking", 100 * r.int(1, 5));
      add("buffering", 100 * r.int(2, 30));
      if (r.chance(0.3)) add("buffering", 100 * r.int(2, 10));
    }
  }
  if (r.chance(0.5)) add("playing", 100 * r.int(5, 99));               // the last, partial interval
  return out;
}

function streamCase(r, level) {
  const vids = Array.from({ length: level === 1 ? 1 : r.int(2, 3) }, () => rid(r, "vid_"));
  const stories = [];
  const nSess = level === 1 ? r.int(2, 3) : r.int(3, 4);
  for (let i = 0; i < nSess; i++) stories.push(sessionStory(r, level, r.pick(vids), rid(r, "sess_")));
  let stream = [];
  const idx = stories.map(() => 0), total = stories.reduce((s, x) => s + x.length, 0);
  while (stream.length < total) {
    const live = stories.map((s, i) => i).filter((i) => idx[i] < stories[i].length);
    const i = r.pick(live);
    stream.push(stories[i][idx[i]++]);
  }
  if (level >= 2) {                                                     // out-of-order delivery
    for (let k = 0; k < 3; k++) {
      const i = r.int(0, stream.length - 2);
      [stream[i], stream[i + 1]] = [stream[i + 1], stream[i]];
    }
  }
  for (let k = 0; k < (level === 1 ? 1 : 2); k++) {                     // redeliveries
    const e = r.pick(stream);
    stream.splice(r.int(stream.indexOf(e) + 1, stream.length), 0, { ...e });
  }
  return stream;
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const hb = streamCase(r, level);
    samples.push({ args: pyArgs(hb), expect: py(oracle(hb)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const V = rid(r, "vid_"), W = rid(r, "vid_");
  const S = () => rid(r, "sess_");
  const story = (video, session, parts) => parts.map(([state, ms], i) => ({ session, video, seq: i + 1, state, ms }));
  const j = 100 * r.int(5, 20), rb = j + 100 * r.int(1, 20), sk = rb + 100 * r.int(1, 10);   // distinct on purpose
  const s1 = S(), s2 = S(), s3 = S();

  const regular = story(V, s1, [["buffering", j], ["playing", HB], ["playing", HB], ["playing", HB], ["buffering", rb]]);
  const redelivered = story(V, s1, [["buffering", j], ["playing", HB], ["buffering", rb], ["playing", 6000]]);
  redelivered.splice(3, 0, { ...redelivered[2] });
  const late = story(V, s1, [["buffering", j], ["playing", HB + 2000], ["buffering", rb], ["playing", 4000]]);
  const lateDelivered = [late[1], late[0], late[3], late[2]];
  const seek = story(V, s1, [["buffering", j], ["playing", HB], ["seeking", 300], ["buffering", sk],
    ["playing", 7000], ["buffering", rb]]);
  const avgA = story(V, s1, [["buffering", j], ["playing", 60000], ["buffering", 650]]);
  const avgB = story(V, s2, [["buffering", j + 100], ["playing", 4000], ["buffering", 3000]]);
  const abandoned = story(V, s3, [["buffering", 4000], ["buffering", 2500]]);
  const played = story(V, s1, [["buffering", j], ["playing", 9000], ["buffering", rb]]);
  const noOne = story(W, s2, [["buffering", 6000]]);
  const twoVideos = [...story(V, s1, [["buffering", j], ["playing", HB], ["buffering", rb]]), ...story(W, s2, [["playing", 5000], ["buffering", 500]])];

  const edges = [
    ["regular 10-second playing heartbeats are distinct intervals, not retries", regular],
    ["a redelivered heartbeat (same session and seq) is counted once", redelivered],
    ["intervals delivered out of order are read in seq order", lateDelivered],
    ["buffering after a seek is not rebuffering, but the next stall after playback resumes is", seek],
    ["the video's ratio comes from its totals, not the average of its sessions", [...avgA, ...avgB]],
    ["two videos are reported separately", twoVideos],
    ["a session abandoned during startup counts as a session with only join time", [...played, ...abandoned]],
    ["a video nobody managed to play has a ratio of 0", [...played, ...noOne]],
  ];
  for (const [name, hb] of edges) tests.push({ name, args: pyArgs(hb), expect: py(oracle(hb)) });

  const n = level === 1 ? 100000 : 200000;
  tests.push({ name: `${n.toLocaleString("en-US")} heartbeats in time`, args: `(_gen_heartbeats(${n}, ${r.int(1, 1_000_000)}),)`, limit_s: 8 });

  return {
    vars: {
      delivery_rule: level === 1
        ? "In this replay heartbeats mostly arrive in order, with a few retries; the checks also include late ones."
        : level === 2
          ? "Heartbeats can arrive twice and out of order, and viewers seek."
          : "Heartbeats can arrive twice and out of order, viewers seek, and some viewers give up before playback ever starts.",
    },
    samples,
    tests,
  };
}
