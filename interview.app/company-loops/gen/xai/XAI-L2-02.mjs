/* XAI-L2-02 — Verbatim overlap with a cited source (Python, binary search on the
   length + rolling hash with verification).
   Simulated practice scenario. All data is generated from the seed; words are
   synthetic integer tokens and no text of any response or source is involved.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which tries every pair of start positions and
   walks forward while the tokens agree. The evaluator's reference binary-searches
   the length and finds a shared run of a given length with a rolling hash whose
   matches are verified token by token, so each checks the other.
   level: 1 Medium (one cited source, a planted copied run among unrelated words)
          2 Hard (one cited source, a small vocabulary so equal-length runs tie)
          3 Very Hard (several cited sources, one answer each; runs that repeat or
            overlap themselves, a source shorter than the response) */
export const kind = "python";
export const entry = "verbatim_overlap";
export const signature = "def verbatim_overlap(response: list[int], sources: list[list[int]]) -> list[tuple[int, int, int]]:";
export const starter = `def verbatim_overlap(response, sources):
    """response: the words of a model response, as integer token ids.
    sources: the words of each source the response cites, in citation order.
    For each source return (length, i, j): the longest run of consecutive
    words with response[i:i+length] == source[j:j+length]; ties go to the
    smallest i, then the smallest j. Return (0, -1, -1) when the two share
    no word."""
    ...
`;

export const prelude = `
def _gen_overlap(n, m, k, seed, vocab=6000):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    sources = [[nxt() % vocab for _ in range(m // k)] for _ in range(k)]
    response = []
    while len(response) < n:
        if nxt() % 3 == 0:                      # a run copied from a cited source
            src = sources[nxt() % k]
            ln = 20 + nxt() % 180
            st = nxt() % (len(src) - ln)
            response.extend(src[st:st + ln])
        else:                                   # the response's own words
            response.extend(nxt() % vocab for _ in range(10 + nxt() % 60))
    del response[n:]
    return response, sources
`.trim() + "\n";

// The rule, literally: every pair of starts, walked forward. Small inputs only.
export function oracle(response, sources) {
  return sources.map((src) => {
    let best = [0, -1, -1];
    for (let i = 0; i < response.length; i++) {
      for (let j = 0; j < src.length; j++) {
        let k = 0;
        while (i + k < response.length && j + k < src.length && response[i + k] === src[j + k]) k++;
        if (k > best[0]) best = [k, i, j];         // strict: the earliest i, then j, keeps a tie
      }
    }
    return best;
  });
}

const list = (xs) => "[" + xs.join(", ") + "]";
const pyArgs = (c) => `(${list(c.response)}, [${c.sources.map(list).join(", ")}])`;
const pyOut = (xs) => "[" + xs.map((t) => `(${t.join(", ")})`).join(", ") + "]";
const run = (c) => oracle(c.response, c.sources);

function words(r, k, vocab) {
  return Array.from({ length: k }, () => r.int(1, vocab));
}

function randomCase(r, level) {
  const vocab = level === 2 ? r.int(5, 7) : r.int(25, 60);
  const nSrc = level === 3 ? r.int(2, 3) : 1;
  const sources = Array.from({ length: nSrc }, () => words(r, r.int(14, 26), vocab));
  const response = words(r, r.int(4, 8), vocab);
  for (let k = 0; k < r.int(1, 2); k++) {               // copy a run (or two) from a cited source
    const src = r.pick(sources);
    const len = r.int(3, 7);
    const st = r.int(0, src.length - len);
    response.push(...src.slice(st, st + len), ...words(r, r.int(1, 5), vocab));
  }
  if (level === 3 && r.chance(0.5)) sources.push(words(r, r.int(2, 4), vocab));
  return { response, sources };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  // Hand-built checks. Words from disjoint ranges never match by accident.
  const base = 100 * r.int(1, 9);
  const own = (k) => Array.from({ length: k }, (_, i) => base + 1000 + i);        // only in the response
  const theirs = (k) => Array.from({ length: k }, (_, i) => base + 2000 + i);     // only in the source
  const run_ = (k, off = 0) => Array.from({ length: k }, (_, i) => base + 3000 + off + i);
  const a = r.int(4, 7);
  const one = (response, src) => ({ response, sources: [src] });
  const edges = [
    ["no shared word at all",
      one(own(6), theirs(9))],
    ["the whole response appears in the source",
      one(run_(a), theirs(3).concat(run_(a), theirs(2)))],
    ["the run ends the response and starts the source",
      one(own(4).concat(run_(a)), run_(a).concat(theirs(5)))],
    ["the longest run is not the first shared word",
      one([base + 3500].concat(own(3), run_(a), own(2)), theirs(2).concat(run_(a), theirs(1), [base + 3500]))],
    ["one word shared: a run of length 1",
      one(own(3).concat([base + 3700], own(2)), theirs(4).concat([base + 3700]))],
    ["a run cut short by one different word is two runs, and the longer counts",
      one(run_(a + 3), theirs(1).concat(run_(2), [base + 9999], run_(a + 1, 2)))],
  ];
  if (level === 2) {
    edges.push(["two runs of the same length: the one earlier in the response",
      one(run_(a, 50).concat(own(2), run_(a)), theirs(2).concat(run_(a), theirs(3), run_(a, 50)))]);
    edges.push(["the same run twice in the source: the earlier place in the source",
      one(own(2).concat(run_(a)), theirs(1).concat(run_(a), theirs(2), run_(a)))]);
    edges.push(["a run that overlaps itself: one word repeated",
      one(Array(a + 3).fill(base + 3900), theirs(2).concat(Array(a).fill(base + 3900), theirs(1)))]);
  }
  if (level === 3) {
    edges.push(["several sources, one answer each, in citation order",
      { response: own(2).concat(run_(a), own(1), run_(a - 2, 60)), sources: [theirs(3).concat(run_(a - 2, 60)), run_(a).concat(theirs(1)), theirs(4)] }]);
    edges.push(["the same run in two sources is reported for each",
      { response: own(3).concat(run_(a)), sources: [run_(a), theirs(5).concat(run_(a))] }]);
    edges.push(["a periodic run overlapping itself, and a source shorter than the run",
      { response: [7, 8, 7, 8, 7, 8, 7, 8, 7].map((w) => base + 3900 + w), sources: [[8, 7, 8, 7, 8, 7, 8].map((w) => base + 3900 + w), [base + 3907, base + 3908]] }]);
    edges.push(["an empty source, and two runs of the same length",
      { response: run_(3).concat(run_(3, 70), run_(3)), sources: [[], theirs(1).concat(run_(3, 70), run_(3), run_(3, 70))] }]);
  }
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  // Timing: compared with the reference at check time. A 10 000-word response against
  // 36 000 words of cited sources: the longest-common-substring table has 360 million cells.
  const k = level === 3 ? 3 : 1;
  tests.push({
    name: `a 10,000-word response and ${k === 1 ? "a 36,000-word source" : "three 12,000-word sources"} in time`,
    args: `_gen_overlap(10000, 36000, ${k}, ${r.int(1, 1_000_000)})`,
    limit_s: 8,
  });

  return {
    vars: {
      level_rule: level === 1
        ? "In this instance every response cites one source, so the sources list has one element."
        : level === 2
          ? "In this instance every response cites one source, so the sources list has one element; the vocabulary is small, so several runs of the same length are common."
          : "In this instance a response can cite several sources, and a source can be empty or shorter than the response.",
    },
    samples,
    tests,
  };
}
