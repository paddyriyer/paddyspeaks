/* SFC-L1-05 — Skills-based routing to the agent with the most spare capacity (Python).
   Simulated practice scenario. All data is generated from the seed. The routing rule
   (most spare capacity, then longest since last assignment, then input order) is this
   exercise's own, not a description of any product's routing engine.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which scans every agent for every case. The
   evaluator's reference keeps one heap per skill with lazy invalidation, written
   independently.
   level: 1 Medium (one unit per case, agents always online)
          · 2 Hard (+ agents with several skills, completions of cases that were never routed)
          · 3 Very Hard (+ cases of 1–3 units, agents going offline and online) */
export const kind = "python";
export const entry = "route_cases";
export const signature = "def route_cases(agents: list[tuple[str, list[str], int]], events: list[tuple]) -> dict[str, str | None]:";
export const starter = `def route_cases(agents, events):
    """agents: (agent_id, skills, capacity).
    events, in order: ('case', t, case_id, skill, units) | ('done', t, case_id)
                      | ('offline', t, agent_id) | ('online', t, agent_id).
    Return {case_id: agent_id or None} for every case."""
    ...
`;

export const prelude = `
def _gen_traffic(n_agents, n_cases, seed, sizes=False, presence=False):
    x = seed
    def rnd(m):
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return (x >> 16) % m
    skills = ('billing', 'technical', 'returns', 'onboarding', 'spanish', 'premium')
    agents = []
    for a in range(n_agents):
        ks = [skills[rnd(6)]]
        s2 = skills[rnd(6)]
        if rnd(2) and s2 != ks[0]:
            ks.append(s2)
        agents.append(('agent_%d' % a, ks, 2 + rnd(4)))
    evs, seq = [], 0
    for k in range(n_cases):
        t = k // 2                                   # two new cases a second
        evs.append((t, seq, ('case', t, 'case_%d' % k, skills[rnd(6)], 1 + rnd(3) if sizes else 1)))
        d = t + 1 + rnd(5000)
        evs.append((d, seq + 1, ('done', d, 'case_%d' % k)))
        seq += 2
        if presence and k % 40 == 0:
            a = 'agent_%d' % ((k // 40) % n_agents)
            back = t + 1 + rnd(600)
            evs.append((t, seq, ('offline', t, a)))
            evs.append((back, seq + 1, ('online', back, a)))
            seq += 2
    evs.sort()
    return agents, [e for _, _, e in evs]
`.trim() + "\n";

// The rule, applied literally: for each case, scan every agent.
export function oracle(agents, events) {
  const st = agents.map(([id, skills, cap], idx) => ({ id, skills, cap, idx, load: 0, last: null, online: true }));
  const byId = new Map(st.map((a) => [a.id, a]));
  const held = new Map();
  const out = new Map();
  for (const ev of events) {
    const [k, t] = ev;
    if (k === "case") {
      const [, , cid, skill, units] = ev;
      let best = null;
      for (const a of st) {
        if (!a.online || !a.skills.includes(skill) || a.cap - a.load < units) continue;
        if (!best) { best = a; continue; }
        const sa = a.cap - a.load, sb = best.cap - best.load;
        const la = a.last === null ? -1 : a.last, lb = best.last === null ? -1 : best.last;
        if (sa > sb || (sa === sb && (la < lb || (la === lb && a.idx < best.idx)))) best = a;
      }
      out.set(cid, best ? best.id : null);
      if (best) { best.load += units; best.last = t; held.set(cid, [best, units]); }
    } else if (k === "done") {
      const h = held.get(ev[2]);
      if (h) { h[0].load -= h[1]; held.delete(ev[2]); }
    } else if (k === "offline") byId.get(ev[2]).online = false;
    else if (k === "online") byId.get(ev[2]).online = true;
  }
  return out;
}

const pyAgents = (agents) => `[${agents.map(([id, sk, c]) => `('${id}', [${sk.map((s) => `'${s}'`).join(", ")}], ${c})`).join(", ")}]`;
const pyEvent = (e) => (e[0] === "case" ? `('case', ${e[1]}, '${e[2]}', '${e[3]}', ${e[4]})` : `('${e[0]}', ${e[1]}, '${e[2]}')`);
const pyArgs = (agents, events) => `(${pyAgents(agents)}, [${events.map(pyEvent).join(", ")}])`;
const pyOut = (m) => "{" + [...m.entries()].map(([c, a]) => `'${c}': ${a === null ? "None" : `'${a}'`}`).join(", ") + "}";

const SKILLS = ["billing", "technical", "returns", "onboarding", "spanish", "premium"];
const NAMES = ["ada", "bo", "cy", "di", "eli", "fen", "gus", "hal", "ivy", "jo"];

function randomCase(r, level) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const skills = r.sample(SKILLS, level === 1 ? 2 : 3);
    const agents = r.sample(NAMES, r.int(3, 5)).map((n) => {
      const ks = level === 1 ? [r.pick(skills)] : r.sample(skills, r.int(1, 2));
      return ["agent_" + n, ks, r.int(1, 3)];
    });
    const events = [];
    const live = [];                  // case ids that may be completed
    const offline = new Set();
    let t = 0, cid = 100 + r.int(0, 800);
    for (let k = r.int(9, 15); k > 0; k--) {
      t += r.int(0, 3);
      const roll = r.next();
      if (live.length && roll < 0.3) {
        const c = live.splice(r.int(0, live.length - 1), 1)[0];
        events.push(["done", t, c]);
      } else if (level === 3 && roll < 0.42) {
        const a = r.pick(agents)[0];
        events.push([offline.has(a) ? "online" : "offline", t, a]);
        if (offline.has(a)) offline.delete(a); else offline.add(a);
      } else {
        const c = "case_" + (cid += r.int(1, 9));
        events.push(["case", t, c, r.pick(skills), level === 3 ? r.int(1, 3) : 1]);
        live.push(c);
      }
    }
    const got = oracle(agents, events);
    const routed = [...got.values()].filter((v) => v !== null).length;
    if (routed >= 2 && (level === 1 || routed < got.size)) return { agents, events, got };
  }
  throw new Error("SFC-L1-05: could not build a sample");
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const c = randomCase(r, level);
    samples.push({ args: pyArgs(c.agents, c.events), expect: pyOut(c.got) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const [S, S2] = r.sample(SKILLS, 2);
  const [A, B, C] = r.sample(NAMES, 3).map((n) => "agent_" + n);
  const cap = r.int(2, 4);
  const edges = [
    ["the agent with the most spare capacity wins, not the first listed",
      [[A, [S], cap], [B, [S], cap + 1]], [["case", 0, "c1", S, 1], ["case", 1, "c2", S, 1]]],
    ["equal spare capacity: an agent never assigned beats one assigned earlier",
      [[A, [S], 1], [B, [S], 1]], [["case", 0, "c1", S, 1], ["done", 1, "c1"], ["case", 2, "c2", S, 1]]],
    ["equal spare capacity: the longest since last assignment wins, then input order",
      [[A, [S], 2], [B, [S], 2], [C, [S], 2]],
      [["case", 0, "c1", S, 1], ["case", 0, "c2", S, 1], ["case", 0, "c3", S, 1], ["case", 5, "c4", S, 1], ["done", 6, "c1"], ["done", 6, "c3"], ["done", 7, "c4"], ["case", 8, "c5", S, 1]]],
    ["no agent has the skill", [[A, [S], cap]], [["case", 0, "c1", S2, 1]]],
    ["everyone is full until a case completes",
      [[A, [S], 1], [B, [S], 1]], [["case", 0, "c1", S, 1], ["case", 0, "c2", S, 1], ["case", 1, "c3", S, 1], ["done", 2, "c2"], ["case", 3, "c4", S, 1]]],
  ];
  if (level >= 2) {
    edges.push(["a free agent without the skill is never chosen",
      [[A, [S2], cap + 2], [B, [S, S2], 1]], [["case", 0, "c1", S, 1], ["case", 1, "c2", S, 1], ["case", 2, "c3", S2, 1]]]);
    edges.push(["completing a case that was never routed changes nothing",
      [[A, [S], 1]], [["case", 0, "c1", S, 1], ["case", 1, "c2", S, 1], ["done", 2, "c2"], ["case", 3, "c3", S, 1]]]);
  }
  if (level === 3) {
    edges.push(["a case fits an agent whose spare capacity equals its units, and nothing smaller",
      [[A, [S], 3], [B, [S], 2]], [["case", 0, "c1", S, 1], ["case", 1, "c2", S, 2], ["case", 2, "c3", S, 2], ["case", 3, "c4", S, 1]]]);
    edges.push(["spare capacity spread over several agents does not add up",
      [[A, [S], 2], [B, [S], 2]], [["case", 0, "c1", S, 1], ["case", 0, "c2", S, 1], ["case", 1, "c3", S, 2]]]);
    edges.push(["an offline agent gets nothing, a completion while offline still frees capacity, and back online they are eligible",
      [[A, [S], 2], [B, [S], 1]],
      [["case", 0, "c1", S, 1], ["offline", 1, A], ["case", 2, "c2", S, 1], ["done", 3, "c1"], ["case", 4, "c3", S, 1], ["online", 5, A], ["case", 6, "c4", S, 2]]]);
  }
  for (const [name, ag, ev] of edges) tests.push({ name, args: pyArgs(ag, ev), expect: pyOut(oracle(ag, ev)) });

  // Timing: 2 000 agents, 60 000 cases (120 000+ events). Heaps per skill make each
  // routing decision O(log a); scanning the agents with the skill is O(a) per case.
  tests.push({
    name: "2,000 agents, 60,000 cases, about 500 agents per skill (heaps per skill, not scans)",
    args: `_gen_traffic(2000, 60000, ${r.int(1, 1_000_000)}, ${level === 3 ? "True" : "False"}, ${level === 3 ? "True" : "False"})`,
    limit_s: 8,
  });

  return {
    vars: {
      units_rule: level === 3
        ? "A case needs `units` of capacity (1 to 3); it can go only to an agent whose spare capacity is at least `units`. Agents can go `'offline'` (they get no new work, but their cases still complete and free capacity) and come back `'online'`; every agent starts online."
        : "Every case needs one unit of capacity, and every agent stays online (no `'offline'`/`'online'` events in this exercise's tests).",
      done_rule: level === 1
        ? "Every agent has one skill in the samples, but `skills` is a list, so write for several."
        : "Agents can have several skills, and a case can arrive for a skill nobody has.",
    },
    samples,
    tests,
  };
}
