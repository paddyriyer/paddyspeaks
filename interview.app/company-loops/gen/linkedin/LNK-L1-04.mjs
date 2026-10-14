/* LNK-L1-04 — Skills coverage: members who list every skill a job requires (Python).
   Simulated practice scenario. All data is generated from the seed; profiles and jobs are
   hypothetical. The output is a count per job, never a list of members.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: for each job, check every member's skill set (brute
   force). The evaluator's reference intersects per-skill bitsets, so each checks the other.
   level: 1 Medium (exact skill names) · 2 Hard (+ names compared trimmed and case-insensitively;
          members who opted out of this aggregate are not counted) · 3 Very Hard (+ a minimum
          count: a count below min_count is reported as -1) */
export const kind = "python";
export const entry = "skills_coverage";
export const signature = "def skills_coverage(profiles: list[list[str]], jobs: list[list[str]], opted_out: set[int] | None = None, min_count: int | None = None) -> list[int]:";
export const starter = `def skills_coverage(profiles, jobs, opted_out=None, min_count=None):
    """profiles[i] is member i's listed skills; jobs[j] is job j's required skills.
    Return, for each job, how many members list every required skill."""
    ...
`;

export const prelude = `
def _gen_profiles(n, vocab, per, seed):
    x, out = seed, []
    for _ in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        p = []
        for _ in range(3 + (x >> 8) % per):
            x = (1103515245 * x + 12345) % 2147483648
            a = (x >> 8) % vocab
            x = (1103515245 * x + 12345) % 2147483648
            p.append("skill-" + str(a * ((x >> 8) % vocab) // vocab))   # low ids are common
        out.append(p)
    return out


def _gen_jobs(m, vocab, seed):
    x, out = seed, []
    for _ in range(m):
        x = (1103515245 * x + 12345) % 2147483648
        j = []
        for _ in range(1 + (x >> 8) % 4):
            x = (1103515245 * x + 12345) % 2147483648
            a = (x >> 8) % vocab
            x = (1103515245 * x + 12345) % 2147483648
            j.append("skill-" + str(a * ((x >> 8) % (vocab // 4 + 1)) // vocab))
        out.append(j)
    return out


def _gen_opted(n, k, seed):
    x, out = seed, set()
    for _ in range(k):
        x = (1103515245 * x + 12345) % 2147483648
        out.add((x >> 8) % n)
    return out
`.trim() + "\n";

// Brute force: every job against every member. Small inputs only.
export function oracle(profiles, jobs, optedOut, minCount, normalise) {
  const norm = (s) => (normalise ? s.trim().toLowerCase() : s);
  const off = new Set(optedOut || []);
  const sets = profiles.map((p) => new Set(p.map(norm)));
  return jobs.map((req) => {
    const need = req.map(norm);
    let c = 0;
    sets.forEach((s, i) => { if (!off.has(i) && need.every((x) => s.has(x))) c++; });
    return minCount !== null && minCount !== undefined && c < minCount ? -1 : c;
  });
}

const SKILLS = ["SQL", "Python", "Spark", "Kafka", "Airflow", "dbt", "Tableau", "Java", "Scala", "Go",
  "Excel", "Statistics", "Kubernetes", "Terraform", "Snowflake modeling", "Data Visualization"];
const pyStr = (s) => JSON.stringify(s);
const pyList = (xs) => "[" + xs.map(pyStr).join(", ") + "]";
const pyLists = (xss) => "[" + xss.map(pyList).join(", ") + "]";
const pySet = (xs) => (xs.length ? "{" + xs.join(", ") + "}" : "set()");

export function generate(r, level) {
  const normalise = level >= 2;
  const vocab = r.sample(SKILLS, r.int(6, 8));
  // Hard+: the same skill written differently.
  const variant = (s) => {
    if (!normalise) return s;
    const v = r.pick([s, s, s.toLowerCase(), s.toUpperCase(), " " + s, s + "  "]);
    return v;
  };
  const args = (c) => `(${pyLists(c.p)}, ${pyLists(c.j)}, ${c.off ? pySet(c.off) : "None"}, ${c.k === null ? "None" : c.k})`;
  const run = (c) => oracle(c.p, c.j, c.off, c.k, normalise);
  const pyOut = (xs) => "[" + xs.join(", ") + "]";
  const finish = (c) => {
    if (level === 1) { c.off = null; c.k = null; }
    else if (level === 2) c.k = null;
    return c;
  };

  const randomCase = () => {
    for (let attempt = 0; attempt < 80; attempt++) {
      const n = r.int(8, 12);
      const p = Array.from({ length: n }, () => {
        const k = r.int(1, 5);
        const xs = r.sample(vocab.slice(0, 5), Math.min(k, 5)).map(variant);
        if (r.chance(0.2)) xs.push(variant(xs[0]));               // a skill listed twice
        return xs;
      });
      const j = Array.from({ length: r.int(3, 5) }, () => r.sample(vocab.slice(0, 5), r.int(1, 3)).map(variant));
      const off = level >= 2 ? r.sample(Array.from({ length: n }, (_, i) => i), r.int(1, 2)) : null;
      const c = finish({ p, j, off, k: level === 3 ? r.int(2, 3) : null });
      const got = run(c);
      if (got.filter((x) => x > 0).length >= 2) return c;
    }
    throw new Error("LNK-L1-04: could not build a sample with matches");
  };
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase();
    samples.push({ args: args(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [a, b, c, d] = vocab;
  const edges = [
    ["no members at all", { p: [], j: [[a], []], off: [], k: 1 }],
    ["a required skill nobody lists", { p: [[a, b], [a]], j: [[a, d], [d]], off: [], k: 1 }],
    ["a job with no required skills matches every member", { p: [[a], [b], []], j: [[]], off: [], k: 1 }],
    ["a member with no skills matches only the empty job", { p: [[], [a]], j: [[a], []], off: [], k: 1 }],
    ["a skill listed twice counts the member once", { p: [[a, a, b], [b, b]], j: [[a, b], [b], [a, a]], off: [], k: 1 }],
    ["every required skill, not any of them", { p: [[a, b], [a, c], [b, c], [a, b, c]], j: [[a, b], [a, b, c], [c]], off: [], k: 1 }],
  ];
  if (level >= 2) {
    edges.push(["case and surrounding spaces do not matter", { p: [[a.toUpperCase(), " " + b], [a.toLowerCase()], [b + " "]], j: [[a], [" " + b.toLowerCase()], [a.toLowerCase(), b.toUpperCase()]], off: [], k: 1 }]);
    edges.push(["an opted-out member is never counted", { p: [[a, b], [a, b], [a]], j: [[a, b], [a], []], off: [1], k: 1 }]);
    edges.push(["every member opted out", { p: [[a], [a, b]], j: [[a], []], off: [0, 1], k: 1 }]);
  }
  if (level === 3) {
    const k = r.int(2, 4);
    const many = Array.from({ length: k }, () => [a, b]);
    edges.push([`exactly ${k} members is shown`, { p: [...many, [c]], j: [[a, b]], off: [], k }]);
    edges.push([`${k - 1} members is suppressed`, { p: [...many.slice(1), [c]], j: [[a, b], [c]], off: [], k }]);
    edges.push(["a count of zero is suppressed too", { p: [[a], [b]], j: [[a, b], [d]], off: [], k: 1 }]);
    edges.push(["opting out can push a job below the minimum", { p: [...many, [c]], j: [[a, b]], off: [0], k }]);
  }
  for (const [name, cse] of edges) {
    const cc = finish({ ...cse, k: level === 3 ? cse.k : null });
    tests.push({ name, args: args(cc), expect: pyOut(run(cc)) });
  }

  // Timing: compared with the reference at check time. Checking every member for every job is
  // tens of millions of subset tests; intersecting per-skill bitsets is a few big-integer ANDs per job.
  const n = 25000, m = 1200, seed = r.int(1, 1_000_000);
  const off = level >= 2 ? `_gen_opted(${n}, 800, ${seed + 2})` : "None";
  const k = level === 3 ? r.int(5, 20) : "None";
  tests.push({
    name: `${n.toLocaleString("en-US")} members and ${m.toLocaleString("en-US")} jobs in time`,
    args: `(_gen_profiles(${n}, 400, 12, ${seed}), _gen_jobs(${m}, 400, ${seed + 1}), ${off}, ${k})`,
    limit_s: 8,
  });

  return {
    vars: {
      norm_rule: normalise
        ? "Skill names are compared after trimming surrounding spaces and ignoring case (`\" SQL\"` and `\"sql\"` are the same skill); spaces inside a name are kept as written. `opted_out` is a set of member indexes who chose not to be included in aggregate insights: never count them."
        : "Skill names are compared exactly as written. `opted_out` is None in this exercise.",
      min_rule: level === 3
        ? "`min_count` is an integer: a count below `min_count` (including 0) is reported as `-1`, so a small group of members is never singled out."
        : "`min_count` is None: report every count as it is.",
    },
    samples,
    tests,
  };
}
