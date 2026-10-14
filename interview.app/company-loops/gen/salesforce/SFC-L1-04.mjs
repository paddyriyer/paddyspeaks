/* SFC-L1-04 — Records visible through the role hierarchy (Python).
   Simulated practice scenario. All data is generated from the seed. The visibility
   rule (owners strictly below you in the role tree, peers excluded, objects that do not
   share through the hierarchy) is this exercise's own simplification.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below: for every user and every record, walk up from the
   owner's role to see whether the user's role is a strict ancestor. The evaluator's
   reference does one post-order pass over the role tree, written independently.
   level: 1 Medium (every user has a role; roles listed parents first)
          · 2 Hard (+ users with no role, roles listed in any order)
          · 3 Very Hard (+ objects that do not share through the hierarchy) */
export const kind = "python";
export const entry = "visible_counts";
export const signature = "def visible_counts(roles: list[tuple[str, str | None]], users: list[tuple[str, str | None]], records: list[tuple[str, str, str]], no_hierarchy: list[str]) -> dict[str, int]:";
export const starter = `def visible_counts(roles, users, records, no_hierarchy):
    """roles: (role_id, parent_role_id or None).
    users: (user_id, role_id or None).
    records: (record_id, object_name, owner_user_id).
    no_hierarchy: object names whose records are not shared up the hierarchy.
    Return {user_id: number of records the user can see} for every user."""
    ...
`;

export const prelude = `
def _gen_org(n_roles, n_users, n_records, seed, roleless=False, shuffled=False, no_h=()):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    roles = [('role_0', None)]
    for i in range(1, n_roles):                       # a deep tree: each role hangs below one of the last three
        roles.append(('role_%d' % i, 'role_%d' % (i - 1 - rnd(min(3, i)))))
    if shuffled:
        roles.reverse()
    users = []
    for k in range(n_users):
        users.append(('user_%d' % k, None if roleless and rnd(20) == 0 else 'role_%d' % rnd(n_roles)))
    objects = ('Account', 'Opportunity', 'Case', 'Contract_Review__c')
    records = [('rec_%d' % k, objects[rnd(4)], 'user_%d' % rnd(n_users)) for k in range(n_records)]
    return roles, users, records, list(no_h)
`.trim() + "\n";

export function oracle(roles, users, records, noH) {
  const parent = new Map(roles);
  const roleOf = new Map(users);
  const off = new Set(noH);
  const out = new Map();
  for (const [u, ru] of users) {
    let n = 0;
    for (const [, obj, owner] of records) {
      if (owner === u) { n++; continue; }
      const ro = roleOf.get(owner);
      if (ru === null || ro === null || off.has(obj)) continue;
      for (let p = parent.get(ro); p !== null && p !== undefined; p = parent.get(p)) if (p === ru) { n++; break; }
    }
    out.set(u, n);
  }
  return out;
}

const lit = (v) => (v === null ? "None" : `'${v}'`);
const pyArgs = (roles, users, records, noH) =>
  `([${roles.map(([a, b]) => `(${lit(a)}, ${lit(b)})`).join(", ")}], ` +
  `[${users.map(([a, b]) => `(${lit(a)}, ${lit(b)})`).join(", ")}], ` +
  `[${records.map(([a, b, c]) => `('${a}', '${b}', '${c}')`).join(", ")}], ` +
  `[${noH.map((o) => `'${o}'`).join(", ")}])`;
const pyOut = (m) => "{" + [...m.entries()].map(([u, n]) => `'${u}': ${n}`).join(", ") + "}";

const ROLE_NAMES = ["ceo", "vp_sales", "vp_service", "dir_emea", "dir_amer", "dir_apac", "mgr_north", "mgr_south", "mgr_east", "mgr_west", "rep_team_a", "rep_team_b", "rep_team_c", "svc_lead", "svc_agents"];
const OBJECTS = ["Account", "Opportunity", "Case", "Contract_Review__c", "Quote"];
const FIRST = ["ana", "ben", "chloe", "dev", "emma", "farid", "gita", "hugo", "iris", "jon", "kemal", "lena", "mo", "nina", "omar", "priya"];

function randomCase(r, level) {
  const nRoles = r.int(5, level === 1 ? 8 : 11);
  const names = r.sample(ROLE_NAMES, nRoles).sort((x, y) => ROLE_NAMES.indexOf(x) - ROLE_NAMES.indexOf(y)).map((x) => "r_" + x);   // a parent is always a more senior title
  const roles = [[names[0], null]];
  for (let i = 1; i < nRoles; i++) roles.push([names[i], r.chance(0.12) ? null : names[r.int(Math.max(0, i - 3), i - 1)]]);
  let rolesOut = roles;
  if (level >= 2) rolesOut = r.shuffle(roles);
  const users = [];
  const people = r.sample(FIRST, r.int(6, level === 1 ? 9 : 12));
  for (const p of people) users.push(["u_" + p, level >= 2 && r.chance(0.15) ? null : r.pick(names)]);
  const records = [];
  let rid = 1000 + r.int(0, 8000);
  const objs = r.sample(OBJECTS, 3);
  for (let k = r.int(10, 22); k > 0; k--) records.push(["rec_" + (rid += r.int(1, 9)), r.pick(objs), r.pick(users)[0]]);
  const noH = level === 3 ? [objs[2]] : [];
  return { roles: rolesOut, users, records, noH };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.roles, c.users, c.records, c.noH), expect: pyOut(oracle(c.roles, c.users, c.records, c.noH)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [o1, o2] = r.sample(["Account", "Opportunity", "Case"], 2);
  const k = r.int(1, 3);
  const recs = (owner, n, obj = o1, start = 0) => Array.from({ length: n }, (_, i) => [`rec_${owner}_${start + i}`, obj, owner]);
  const edges = [
    ["peers in the same role do not see each other's records",
      [["r_team", null]], [["u_a", "r_team"], ["u_b", "r_team"]], [...recs("u_a", k), ...recs("u_b", 2)], []],
    ["a manager two levels up sees everything below, the middle sees only below itself",
      [["r_top", null], ["r_mid", "r_top"], ["r_low", "r_mid"]], [["u_top", "r_top"], ["u_mid", "r_mid"], ["u_low", "r_low"]],
      [...recs("u_low", 2), ...recs("u_mid", k), ...recs("u_top", 1)], []],
    ["a role with no users still passes its subtree's records up",
      [["r_top", null], ["r_empty", "r_top"], ["r_low", "r_empty"]], [["u_top", "r_top"], ["u_low", "r_low"]], recs("u_low", k + 1), []],
    ["separate trees share nothing, and a user with no records sees only what is below",
      [["r_a", null], ["r_b", null], ["r_a1", "r_a"]], [["u_a", "r_a"], ["u_b", "r_b"], ["u_a1", "r_a1"], ["u_idle", "r_a1"]],
      [...recs("u_a1", k), ...recs("u_b", 2)], []],
  ];
  if (level >= 2) {
    edges.push(["a user with no role sees only their own records, and nobody sees theirs",
      [["r_top", null], ["r_low", "r_top"]], [["u_top", "r_top"], ["u_free", null], ["u_low", "r_low"]],
      [...recs("u_free", 2), ...recs("u_low", k)], []]);
    edges.push(["roles may be listed before their parent",
      [["r_low", "r_mid"], ["r_mid", "r_top"], ["r_top", null]], [["u_low", "r_low"], ["u_top", "r_top"], ["u_mid", "r_mid"]],
      [...recs("u_low", k), ...recs("u_mid", 1)], []]);
  }
  if (level === 3) {
    edges.push(["records of an object that does not share through the hierarchy are visible to their owner only",
      [["r_top", null], ["r_low", "r_top"]], [["u_top", "r_top"], ["u_low", "r_low"]],
      [...recs("u_low", 2, o2), ...recs("u_low", k, o1, 10)], [o2]]);
    edges.push(["an object can be switched off even when nobody owns a record of it",
      [["r_top", null], ["r_low", "r_top"]], [["u_top", "r_top"], ["u_low", "r_low"]], recs("u_low", k), ["Quote"]]);
  }
  for (const [name, ro, us, re, nh] of edges) tests.push({ name, args: pyArgs(ro, us, re, nh), expect: pyOut(oracle(ro, us, re, nh)) });

  // Timing: a 12 000-role tree about 6 000 levels deep, 30 000 users, 120 000 records.
  // One post-order pass is O(roles + users + records); walking each user's (or each
  // role's) subtree is O(roles x depth), about 4 x 10^7 steps here.
  tests.push({
    name: "12,000 roles about 6,000 levels deep, 30,000 users, 120,000 records (one pass, no recursion)",
    args: `_gen_org(12000, 30000, 120000, ${r.int(1, 1_000_000)}, ${level >= 2 ? "True" : "False"}, ${level >= 2 ? "True" : "False"}, ${level === 3 ? "('Contract_Review__c',)" : "()"})`,
    limit_s: 8,
  });

  return {
    vars: {
      role_rule: level === 1
        ? "Every user has a role, and `roles` lists every parent before its children."
        : "A user's role can be `None`: that user sees only their own records, and nobody sees theirs through the hierarchy. `roles` may list a child before its parent.",
      object_rule: level === 3
        ? "Records of an object named in `no_hierarchy` are visible only to their owner; the hierarchy does not share them."
        : "`no_hierarchy` is empty in this exercise's tests, but keep the parameter.",
    },
    samples,
    tests,
  };
}
