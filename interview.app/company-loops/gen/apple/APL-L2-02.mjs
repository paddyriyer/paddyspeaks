/* APL-L2-02 — App update delta with content-defined chunks (Python, rolling hash).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which recomputes every window's hash from
   scratch (O(n·w)) and compares chunks by their bytes. The evaluator's reference
   rolls the hash in O(1) per byte, so each checks the other.
   level: 1 Medium (hash boundaries only, one installed file) · 2 Hard (+ minimum
          and maximum chunk sizes) · 3 Very Hard (+ several installed files and
          content repeated inside the update) */
export const kind = "python";
export const entry = "delta_chunks";
export const signature = "def delta_chunks(installed: list[bytes], new: bytes, window: int, mask_bits: int, min_size: int = 1, max_size: int | None = None) -> tuple[int, list[tuple[int, int]]]:";
export const starter = `def delta_chunks(installed, new, window, mask_bits, min_size=1, max_size=None):
    """Split every file into content-defined chunks with the rolling hash
    H(i) = (b[i-window+1]*257^(window-1) + ... + b[i]) mod 1_000_000_007.
    Return (number of chunks in new, [(offset, length) of each chunk to download])."""
    ...
`;

export const prelude = `
def _gen_app_update(n, files, seed):
    x = seed
    def draw():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 16
    base = bytes(draw() & 255 for _ in range(n))
    new, pos = bytearray(), 0
    while pos < n:
        step = 20000 + draw() % 60000
        new += base[pos:pos + step]
        pos += step
        op = draw() % 3
        if op == 0:
            new += bytes(draw() & 255 for _ in range(1 + draw() % 300))
        elif op == 1:
            pos += 1 + draw() % 300
        else:
            new[-1 - draw() % 50] ^= 1 + draw() % 255
    cut = [n * k // files for k in range(files + 1)]
    installed = [base[cut[k]:cut[k + 1]] for k in range(files)]
    return installed, bytes(new)
`.trim() + "\n";

const M = 1000000007;

function chunk(data, w, k, minSize, maxSize) {
  const out = [];
  const div = 2 ** k;
  let s = 0;
  for (let i = 0; i < data.length; i++) {
    const len = i - s + 1;
    let cut = maxSize !== null && len === maxSize;
    if (!cut && i >= w - 1 && len >= minSize) {
      let h = 0;
      for (let j = i - w + 1; j <= i; j++) h = (h * 257 + data[j]) % M;   // the window, from scratch
      cut = h % div === 0;
    }
    if (cut) { out.push([s, len]); s = i + 1; }
  }
  if (s < data.length) out.push([s, data.length - s]);
  return out;
}

// The specification, implemented independently of the Python reference.
export function oracle(installed, data, w, k, minSize, maxSize) {
  const have = new Set();
  for (const f of installed) for (const [o, l] of chunk(f, w, k, minSize, maxSize)) have.add(f.slice(o, o + l).join(","));
  const mine = chunk(data, w, k, minSize, maxSize);
  const download = [];
  for (const [o, l] of mine) {
    const key = data.slice(o, o + l).join(",");
    if (have.has(key)) continue;
    have.add(key);                         // downloaded once, then on the device
    download.push([o, l]);
  }
  return [mine.length, download];
}

const enc = (s) => Array.from(s, (ch) => ch.charCodeAt(0));
const pyBytes = (a) => "b'" + String.fromCharCode(...a) + "'";
const pyArgs = (c) =>
  `([${c.installed.map(pyBytes).join(", ")}], ${pyBytes(c.data)}, ${c.w}, ${c.k}, ${c.min}, ${c.max === null ? "None" : c.max})`;
const run = (c) => oracle(c.installed, c.data, c.w, c.k, c.min, c.max);
const pyOut = ([n, dl]) => `(${n}, [${dl.map(([o, l]) => `(${o}, ${l})`).join(", ")}])`;

const WORDS = ["icon", "frame", "asset", "sound", "level", "tile", "font", "sprite", "map", "intro", "menu", "score",
  "glyph", "patch", "theme", "badge", "mesh", "light", "shade", "audio", "story", "voice", "tutor", "panel"];
const text = (r, words) => enc(Array.from({ length: words }, () => r.pick(WORDS)).join(" "));

function params(r, level) {
  return level === 1
    ? { w: r.int(3, 5), k: r.int(2, 3), min: 1, max: null }
    : { w: r.int(3, 5), k: r.int(2, 3), min: r.int(4, 6), max: r.int(14, 20) };
}

function edit(r, base, level) {
  let out = base.slice();
  const ops = r.int(1, 2);
  for (let i = 0; i < ops; i++) {
    const at = r.int(0, out.length - 1);
    const op = r.int(0, 2);
    if (op === 0) out = [...out.slice(0, at), ...text(r, 1), 32, ...out.slice(at)];
    else if (op === 1) out = [...out.slice(0, at), ...out.slice(at + r.int(2, 6))];
    else out[at] = enc(r.pick(["x", "q", "z"]))[0];
  }
  return out;
}

function randomCase(r, level) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const p = params(r, level);
    const base = text(r, r.int(14, 20));
    const installed = [base];
    let data = edit(r, base, level);
    if (level === 3) {
      const other = text(r, r.int(8, 12));
      installed.push(other);
      const at = r.int(0, data.length);
      data = [...data.slice(0, at), 32, ...other.slice(0, r.int(10, other.length)), 32, ...data.slice(at)];
      const rep = data.slice(0, r.int(12, 24));
      data = [...data, 32, ...rep];
    }
    const c = { installed, data, ...p };
    const [n, dl] = run(c);
    if (n >= 3 && dl.length >= 1 && dl.length < n) return c;
  }
  throw new Error("APL-L2-02: could not build a sample that reuses chunks");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const p = params(r, level);
  const base = text(r, 18);
  const find = (pred, make) => {                       // a case with the property the test is about
    for (let i = 0; i < 200; i++) { const c = make(); if (pred(c)) return c; }
    throw new Error("APL-L2-02: no case for an edge test");
  };
  const edges = [
    ["an empty update has no chunks", { installed: [base], data: [], ...p }],
    ["an unchanged file downloads nothing", { installed: [base], data: base.slice(), ...p }],
    ["a file shorter than the window is one chunk", { installed: [base], data: enc("zq xz"), ...p, w: 6 }],
    ["after an insertion near the start, later chunks are found again", find(
      (c) => { const [n, dl] = run(c); return n >= 4 && dl.length < n; },
      () => { const b = text(r, 22); return { installed: [b], data: [...b.slice(0, 6), ...text(r, 1), 32, ...b.slice(6)], ...p }; })],
    ["a passage moved to the front is not downloaded again", find(
      (c) => { const [n, dl] = run(c); return n >= 3 && dl.length < n - 1; },
      () => { const b = text(r, 22); const m = r.int(30, b.length - 30); return { installed: [b], data: [...b.slice(m), 32, ...b.slice(0, m)], ...p }; })],
    ["a boundary can follow the previous one by fewer than window bytes (the window runs over the whole file)", find(
      (c) => { const ch = chunk(c.data, c.w, c.k, c.min, c.max); return ch.some(([, l], i) => i > 0 && i < ch.length - 1 && l < c.w); },
      () => ({ installed: [], data: text(r, 12), ...p, w: 5, k: 1, min: 1 }))],
  ];
  if (level >= 2) {
    const max = p.max;
    const k = p.k, w = p.w;
    let letter = 97;
    for (; letter < 123; letter++) {                    // one byte whose constant window never cuts
      let h = 0;
      for (let j = 0; j < w; j++) h = (h * 257 + letter) % M;
      if (h % 2 ** k !== 0) break;
    }
    edges.push([`a run of one byte is cut every max_size bytes, and the repeated chunk is downloaded once`,
      { installed: [base], data: Array(3 * max + 5).fill(letter), ...p }]);
    edges.push(["a hash boundary inside the first min_size bytes of a chunk is ignored", find(
      (c) => JSON.stringify(run(c)) !== JSON.stringify(run({ ...c, min: 1 })),
      () => ({ installed: [], data: text(r, 10), ...p, max: null }))]);
    edges.push(["a chunk of exactly max_size bytes is cut there", find(
      (c) => chunk(c.data, c.w, c.k, c.min, c.max).some(([, l]) => l === c.max),
      () => ({ installed: [base], data: text(r, 12), ...p, k: 4 }))]);
  }
  if (level === 3) {
    const other = text(r, 14);
    edges.push(["chunks found in a second installed file are not downloaded", find(
      (c) => { const [n, dl] = run(c); return dl.length < run({ ...c, installed: [c.installed[0]] })[1].length && n > dl.length; },
      () => ({ installed: [base, other], data: [...text(r, 4), 32, ...other, 32, ...text(r, 3)], ...p }))]);
    edges.push(["a passage repeated inside the update is downloaded once", find(
      (c) => { const [, dl] = run(c); return dl.length < run({ ...c, data: c.data.slice(0, c.data.length / 2) })[1].length * 2; },
      () => { const t = text(r, 10); return { installed: [base], data: [...t, ...t], ...p }; })]);
    edges.push(["no installed files: every distinct chunk is downloaded", { installed: [], data: text(r, 12), ...p }]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  // Timing: compared with the reference at check time. About 2 MB is hashed with a
  // 64-byte window; recomputing each window is ~130 million steps.
  const n = 1000000, files = level === 3 ? 3 : 1;
  tests.push({
    name: `a ${(n / 1e6).toFixed(0)} MB update with a 64-byte window in time`,
    args: `(*_gen_app_update(${n}, ${files}, ${r.int(1, 1_000_000)}), 64, 11, ${level === 1 ? 1 : 512}, ${level === 1 ? "None" : 8192})`,
    limit_s: 8,
  });

  return {
    vars: {
      size_rule: level === 1
        ? "In this exercise `min_size` is 1 and `max_size` is None: only the hash cuts."
        : "A boundary is also subject to two limits. A hash boundary counts only when the chunk so far has at least `min_size` bytes. And when a chunk reaches `max_size` bytes it is cut there, whatever the hash says.",
      files_rule: level === 3
        ? "The device may hold several installed files, and the update may repeat a passage inside itself: a chunk is downloaded at most once."
        : "In the checks the device holds at most one installed file, though `installed` is a list.",
    },
    samples,
    tests,
  };
}
