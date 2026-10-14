/* LNK-L2-01 — Learning path: the fewest courses that teach a target skill set (Python).
   Simulated practice scenario. All data is generated from the seed.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: a brute-force enumeration of every subset of
   the catalogue (small inputs only). The evaluator's reference is a dynamic
   programme over subsets of the target skills, written independently.
   level: 1 Medium (every target skill is taught somewhere) · 2 Hard (+ skills no
          course teaches, minute ties) · 3 Very Hard (+ skills the member already
          lists on their own profile, duplicated target skills) */
export const kind = "python";
export const entry = "learning_path";
export const signature = "def learning_path(target: list[str], courses: list[tuple[str, int, list[str]]], known: list[str] | None = None) -> tuple[int, int] | None:";
export const starter = `def learning_path(target, courses, known=None):
    """target: the skills the member wants to learn.
    courses: (course_id, minutes, skills_taught) for every course in the catalogue.
    known: skills already on the member's own profile, or None.
    Return (number_of_courses, total_minutes) for the plan that teaches every
    target skill the member does not already have with the fewest courses,
    fewest total minutes on a tie; (0, 0) if nothing is left to learn;
    None if some needed skill is taught by no course."""
    ...
`;

export const prelude = `
def _gen_catalog(k, n, seed):
    x = seed
    target = ['skill%02d' % i for i in range(k)]
    courses = []
    for c in range(n):
        x = (1103515245 * x + 12345) % 2147483648
        width = 2 + (x >> 16) % 2
        skills = {target[c % k]}
        while len(skills) < width:
            x = (1103515245 * x + 12345) % 2147483648
            skills.add(target[(x >> 16) % k])
        x = (1103515245 * x + 12345) % 2147483648
        if (x >> 16) % 3 == 0:
            skills.add('other%03d' % ((x >> 8) % 500))
        x = (1103515245 * x + 12345) % 2147483648
        courses.append(('course%03d' % c, 30 + (x >> 16) % 571, sorted(skills)))
    return target, courses
`.trim() + "\n";

const SKILLS = ["SQL", "Python", "Spark", "Airflow", "dbt", "Kafka", "Data modeling", "Statistics", "Tableau",
  "Docker", "Kubernetes", "Terraform", "Go", "Machine learning", "Public speaking", "Negotiation",
  "Project management", "Leadership", "Excel", "Power BI"];

// Brute force over every subset of the catalogue.
export function oracle(target, courses, known) {
  const have = new Set(known || []);
  const need = [...new Set(target)].filter((s) => !have.has(s));
  let best = null;
  const n = courses.length;
  for (let m = 0; m < (1 << n); m++) {
    const got = new Set();
    let count = 0, minutes = 0;
    for (let i = 0; i < n; i++) {
      if (!(m & (1 << i))) continue;
      count++;
      minutes += courses[i][1];
      for (const s of courses[i][2]) got.add(s);
    }
    if (!need.every((s) => got.has(s))) continue;
    if (best === null || count < best[0] || (count === best[0] && minutes < best[1])) best = [count, minutes];
  }
  return best;
}

const q = (s) => `'${s.replace(/'/g, "\\'")}'`;
const pyOut = (v) => (v === null ? "None" : `(${v[0]}, ${v[1]})`);
const pyList = (xs) => `[${xs.map(q).join(", ")}]`;
const pyArgs = (target, courses, known) =>
  `(${pyList(target)}, [${courses.map(([id, m, sk]) => `(${q(id)}, ${m}, ${pyList(sk)})`).join(", ")}], ${known == null ? "None" : pyList(known)})`;

let courseNo = 0;
const cid = (r) => `LRN-${r.int(1, 9)}${String(++courseNo).padStart(3, "0")}`;

function smallCase(r, level, i) {
  const k = level === 1 ? r.int(4, 6) : level === 2 ? r.int(5, 7) : r.int(6, 8);
  const n = level === 1 ? r.int(5, 7) : level === 2 ? r.int(6, 9) : r.int(7, 10);
  const pool = r.sample(SKILLS, k + 3);
  const target = pool.slice(0, k);
  const extra = pool.slice(k);
  const courses = [];
  for (let c = 0; c < n; c++) {
    const skills = new Set([target[c % k]]);
    const w = r.int(1, 3);
    while (skills.size < w) skills.add(r.pick(target));
    if (r.chance(0.3)) skills.add(r.pick(extra));
    courses.push([cid(r), r.pick([30, 45, 60, 75, 90, 120, 150, 180, 240]), [...skills]]);
  }
  if (level >= 2 && i === 2 && r.chance(0.6)) {          // a skill nobody teaches
    target.push(r.pick(SKILLS.filter((s) => !pool.includes(s))));
  }
  let known = null;
  if (level === 3) {
    known = r.sample(target, r.int(1, 2));
    if (r.chance(0.5)) known.push(r.pick(extra));          // a known skill outside the target
    if (r.chance(0.5)) target.push(r.pick(target));        // a target skill listed twice
  }
  return { target: r.shuffle(target), courses: r.shuffle(courses), known };
}

export function generate(r, level) {
  courseNo = 0;
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = smallCase(r, level, i);
    samples.push({ args: pyArgs(c.target, c.courses, c.known), expect: pyOut(oracle(c.target, c.courses, c.known)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [a, b, c, d, e, f, g] = r.sample(SKILLS, 7);
  const [A, B, C, D] = [cid(r), cid(r), cid(r), cid(r)];
  const m = r.pick([60, 90, 120]);
  const edges = [
    ["one course teaches everything", [a, b, c], [[A, m, [a, b, c, d]], [B, 30, [a]], [C, 30, [b, c]]], null],
    ["the course teaching the most skills is not part of the best plan",
      [a, b, c, d, e, f], [[A, 60, [a, b, c, d]], [B, 60, [a, b, e]], [C, 60, [c, d, f]]], null],
    ["equal course counts: fewer total minutes wins",
      [a, b], [[A, m + 30, [a, b]], [B, m, [a, b]], [C, 10, [a]]], null],
    ["more courses are never better, even when they are shorter",
      [a, b, c], [[A, 600, [a, b, c]], [B, 20, [a]], [C, 20, [b]], [D, 20, [c]]], null],
    ["a course that teaches only skills outside the target is never needed",
      [a, b], [[A, 15, [g, f]], [B, m, [a]], [C, m, [b]]], null],
    ["an empty target needs no courses", [], [[A, m, [a]]], null],
  ];
  if (level >= 2) {
    edges.push(["a skill no course teaches: None", [a, b, c], [[A, m, [a, b]], [B, m, [a]]], null]);
    edges.push(["an empty catalogue with a non-empty target: None", [a], [], null]);
  }
  if (level === 3) {
    edges.push(["skills on the member's profile are not taught again",
      [a, b, c], [[A, 30, [a, b, c]], [B, 20, [c]]], [a, b]]);
    edges.push(["every target skill already known: (0, 0)", [a, b], [[A, m, [a, b]]], [b, a, g]]);
    edges.push(["a target skill listed twice is needed once", [a, a, b], [[A, m, [a]], [B, m, [b]], [C, m + 1, [a, b]]], null]);
    edges.push(["a known skill outside the target changes nothing", [a, b], [[A, m, [a]], [B, m, [b]]], [g]]);
  }
  for (const [name, t, cs, kn] of edges) tests.push({ name, args: pyArgs(t, cs, kn), expect: pyOut(oracle(t, cs, kn)) });

  // Timing: 16 skills and 64–80 courses, each teaching at most three of them, so
  // the best plan has at least six courses. A DP over the 65 536 skill subsets is
  // well under a second; trying course combinations of growing size is C(n, 6)+.
  const n = level === 1 ? 64 : level === 2 ? 72 : 80;
  tests.push({
    name: `16 target skills, ${n} courses (DP over skill subsets)`,
    args: level === 3
      ? `(*_gen_catalog(16, ${n}, ${r.int(1, 1_000_000)}), ['other007', 'skill99'])`
      : `(*_gen_catalog(16, ${n}, ${r.int(1, 1_000_000)}), None)`,
    limit_s: 8,
  });

  return {
    vars: {
      coverage_rule: level === 1
        ? "In this replay every target skill is taught by at least one course."
        : "A target skill may be taught by no course in the catalogue; then no plan exists and you return `None`.",
      known_rule: level === 3
        ? "`known` lists skills already on the member's own profile; they are removed from the target and need not be taught. The target may name a skill twice; it is still one skill."
        : "In this replay `known` is `None`; your function must still accept the argument.",
    },
    samples,
    tests,
  };
}
