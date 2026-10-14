/* MSF-L2-01 — Malware signature scan: every occurrence of many byte patterns (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: the file is joined and every signature is
   compared at every offset, byte by byte (O(n · k · m), fine for small inputs).
   The evaluator's reference is an Aho–Corasick automaton fed chunk by chunk,
   written independently.
   level: 1 Medium (one chunk, signatures that never sit inside one another)
          · 2 Hard (+ signatures that are suffixes or middles of others, identical
            patterns under two ids) · 3 Very Hard (+ the file arrives in chunks and
            occurrences span chunk boundaries) */
export const kind = "python";
export const entry = "scan";
export const signature = "def scan(signatures: list[tuple[str, bytes]], chunks: list[bytes]) -> list[tuple[int, str]]:";
export const starter = `def scan(signatures, chunks):
    """signatures: (sig_id, pattern) pairs; pattern is non-empty bytes.
    chunks: the file's bytes, in the order they were read.
    Return [(offset, sig_id), ...] for every occurrence of every signature in the
    whole file (overlaps included), offset counted from the file's first byte,
    sorted by offset, then sig_id."""
    ...
`;

export const prelude = `
def _gen_scan(n_sigs, n_bytes, chunk, seed):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    alphabet = bytes([0x00, 0x90, 0xcc, 0xff])        # a padded, low-entropy region
    sigs, seen = [], set()
    while len(sigs) < n_sigs:
        p = bytes(alphabet[rnd(4)] for _ in range(8 + rnd(9)))
        if p not in seen:
            seen.add(p)
            sigs.append(('sig-%05d' % len(sigs), p))
    data = bytearray(alphabet[rnd(4)] for _ in range(n_bytes))
    for _ in range(n_bytes // 2000):                  # plant some known occurrences
        p = sigs[rnd(n_sigs)][1]
        at = rnd(n_bytes - len(p))
        data[at:at + len(p)] = p
    data = bytes(data)
    return sigs, [data[i:i + chunk] for i in range(0, n_bytes, chunk)]
`.trim() + "\n";

// The specification, literally: join the chunks, then compare every signature at
// every offset.
export function oracle(signatures, chunks) {
  const data = chunks.flat();
  const out = [];
  for (const [id, pat] of signatures) {
    for (let i = 0; i + pat.length <= data.length; i++) {
      let ok = true;
      for (let j = 0; j < pat.length; j++) if (data[i + j] !== pat[j]) { ok = false; break; }
      if (ok) out.push([i, id]);
    }
  }
  out.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  return out;
}

const hex2 = (b) => b.toString(16).padStart(2, "0");
const pyBytes = (arr) => "b'" + arr.map((b) => "\\x" + hex2(b)).join("") + "'";
const pyArgs = (sigs, chunks) =>
  `([${sigs.map(([id, p]) => `('${id}', ${pyBytes(p)})`).join(", ")}], [${chunks.map(pyBytes).join(", ")}])`;
const pyOut = (rows) => "[" + rows.map(([o, id]) => `(${o}, '${id}')`).join(", ") + "]";

// Byte values common in executable files (padding, NOP, INT3, header and opcode bytes).
const BYTES = [0x00, 0x4d, 0x5a, 0x90, 0xcc, 0xe8, 0xff, 0x48, 0x8b, 0x89, 0xc3];
const HEX = "0123456789abcdef".split("");
function ids(r, n) {
  const s = new Set();
  while (s.size < n) s.add("sig-" + Array.from({ length: 4 }, () => r.pick(HEX)).join(""));
  return [...s];
}
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const contains = (big, small) => {
  for (let i = 0; i + small.length <= big.length; i++) if (same(big.slice(i, i + small.length), small)) return true;
  return false;
};

function splitChunks(r, data, level) {
  if (level < 3) return [data];
  const chunks = [];
  let i = 0;
  while (i < data.length) {
    const len = r.chance(0.15) ? r.int(0, 1) : r.int(2, 9);    // empty and one-byte chunks happen
    chunks.push(data.slice(i, i + len));
    i += len;
  }
  return chunks;
}

function randomCase(r, level) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const alpha = r.sample(BYTES, level === 1 ? 3 : r.int(2, 3));
    const nSigs = level === 1 ? r.int(3, 4) : r.int(4, 6);
    const sigIds = ids(r, nSigs);
    const pats = [];
    for (let k = 0; k < nSigs; k++) {
      if (level >= 2 && pats.length && r.chance(0.4)) {
        const base = r.pick(pats);
        if (base.length >= 3 && r.chance(0.7)) {
          const from = r.int(0, base.length - 2);
          pats.push(base.slice(from, from + r.int(2, base.length - from)));   // a piece of another signature
        } else pats.push(base.slice());                                        // identical bytes, another id
      } else pats.push(Array.from({ length: r.int(2, level === 1 ? 4 : 5) }, () => r.pick(alpha)));
    }
    if (level === 1) {
      // Medium: no signature equals, or sits inside, another one.
      let nested = false;
      for (let a = 0; a < pats.length; a++) for (let b = 0; b < pats.length; b++) if (a !== b && contains(pats[a], pats[b])) nested = true;
      if (nested) continue;
    }
    const n = level === 1 ? r.int(18, 30) : r.int(24, 40);
    const data = Array.from({ length: n }, () => r.pick(alpha));
    for (let p = 0; p < 2; p++) {                       // plant a few occurrences
      const pat = r.pick(pats);
      const at = r.int(0, n - pat.length);
      for (let j = 0; j < pat.length; j++) data[at + j] = pat[j];
    }
    const sigs = sigIds.map((id, k) => [id, pats[k]]);
    const chunks = splitChunks(r, data, level);
    const got = oracle(sigs, chunks);
    if (got.length < 2) continue;
    if (level >= 2 && new Set(got.map((g) => g[0])).size === got.length) continue;   // want a shared offset
    if (level === 3) {                                  // want an occurrence across a chunk boundary
      const ends = [];
      let at = 0;
      for (const c of chunks) { at += c.length; ends.push(at); }
      const len = new Map(sigs.map(([id, p]) => [id, p.length]));
      if (!got.some(([o, id]) => ends.some((e) => o < e && o + len.get(id) > e))) continue;
    }
    return { sigs, chunks, got };
  }
  throw new Error("MSF-L2-01: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.sigs, c.chunks), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [a, b, c, d] = r.sample(BYTES, 4);
  const [I1, I2, I3] = ids(r, 3).sort();
  const k = r.int(2, 4);                               // repeats of an overlapping pattern
  const edges = [
    ["overlapping occurrences of one signature are all reported",
      [[I1, [a, b, a]]], [[a, b, a, b, a, ...Array(k).fill(0).flatMap(() => [b, a])]]],
    ["occurrences at the first and the last byte of the file",
      [[I1, [a, b]], [I2, [c, d]]], [[a, b, d, d, c, d]]],
    ["after a partial match fails, the scan resumes inside it",
      [[I1, [a, a, b]]], [[a, a, a, b, a, a, a, a, b]]],
    ["no occurrence returns an empty list", [[I1, [a, b, c]], [I2, [d, d]]], [[a, b, a, c, b, c, d, a]]],
    ["a signature longer than the file is never found", [[I1, [a, b, c, d, a]]], [[a, b, c, d]]],
    ["an empty file", [[I1, [a]]], [[]]],
  ];
  if (level >= 2) {
    edges.push(["a signature that ends where a longer one ends is reported too",
      [[I1, [c, d]], [I2, [a, b, c, d]]], [[b, a, b, c, d, a]]]);
    edges.push(["a signature inside the middle of a longer one is reported too",
      [[I1, [b, c]], [I2, [a, b, c, d]]], [[a, b, c, d, d]]]);
    edges.push(["identical patterns under two ids are both reported, in id order",
      [[I2, [a, b, c]], [I1, [a, b, c]]], [[d, a, b, c, a, b, c]]]);
    edges.push(["two signatures starting at the same offset are ordered by id",
      [[I3, [a, b]], [I1, [a, b, c]], [I2, [b]]], [[a, b, c, a, b, d]]]);
  }
  if (level === 3) {
    edges.push(["an occurrence spans two chunks", [[I1, [a, b, c, d]]], [[d, a, b], [c, d, a]]]);
    edges.push(["an occurrence spans three chunks, the middle one a single byte", [[I1, [a, b, c]], [I2, [b]]], [[d, a], [b], [c, d]]]);
    edges.push(["empty chunks change nothing", [[I1, [c, d]]], [[], [a, c], [], [d, c], [d]]]);
    edges.push(["offsets count from the start of the file, not of the chunk", [[I1, [d, a]]], [[a, b, c], [d, a, b], [d, a]]]);
  }
  for (const [name, sigs, chunks] of edges) tests.push({ name, args: pyArgs(sigs, chunks), expect: pyOut(oracle(sigs, chunks)) });

  // Timing: 20 000 signatures over a 500 KB low-entropy region. One pass with an
  // automaton is O(n + m + z); searching for each signature separately is
  // 20 000 passes over the file.
  const chunk = level === 3 ? 65536 : 500000;
  tests.push({
    name: "20,000 signatures over 500,000 bytes (one pass, not one pass per signature)",
    args: `_gen_scan(20000, 500000, ${chunk}, ${r.int(1, 1_000_000)})`,
    limit_s: 8,
  });

  return {
    vars: {
      chunk_rule: level === 3
        ? "The scanner reads files in chunks, and an occurrence may start in one chunk and end in a later one; chunks can be any length, including one byte or none."
        : "In this replay every file arrives as a single chunk, but `chunks` is a list and the code must accept several.",
      nesting_rule: level === 1
        ? "In this replay no signature's bytes appear inside another signature."
        : "A signature's bytes can appear inside another signature's bytes, and two signatures can have identical bytes; report every one.",
    },
    samples,
    tests,
  };
}
