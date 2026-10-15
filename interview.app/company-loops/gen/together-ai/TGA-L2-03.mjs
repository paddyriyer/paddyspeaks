/* TGA-L2-03 — Debug the fine-tuning dataset validator (debug, Python).
   Simulated practice scenario. All data is generated from the seed; every line is
   synthetic (contents are placeholder words like "w17"), and every limit is hypothetical.

   Contract (debug): like python, but `starter` is buggy code the candidate fixes.
   The evaluator's reference is the fixed code. expect comes from oracle() below, an
   independent JavaScript implementation of the specification in the template, with its
   own strict JSON parser that notices repeated keys.
   Planted bugs (see the evaluator notes): line numbers counted after blank lines are
   dropped; a system turn is dropped wherever it appears, so a system turn in the middle
   passes; the token count leaves out the system turn; an assistant turn of whitespace
   only is not treated as empty; duplicate_key is reported once per repeated key instead
   of once per line.
   level: 1 Medium (no blank lines, no system turns, no repeated keys in the replay)
          2 Hard (+ blank lines and system turns, first or out of place)
          3 Very Hard (+ repeated keys and whitespace-only assistant turns) */
export const kind = "debug";
export const entry = "validate_dataset";
export const signature = "def validate_dataset(lines: list[str], max_tokens: int) -> list[tuple[int, str]]:";
export const starter = `import json


def _load(line):
    """Parse one line. Returns (value, the keys that were repeated in some object)."""
    repeated = []

    def hook(pairs):
        seen = set()
        for key, _ in pairs:
            if key in seen:
                repeated.append(key)
            seen.add(key)
        return dict(pairs)                 # a repeated key keeps its last value
    return json.loads(line, object_pairs_hook=hook), repeated


def validate_dataset(lines, max_tokens):
    rows = [line for line in lines if line.strip()]
    if not rows:
        return [(0, "no_examples")]
    errors = []
    for n, line in enumerate(rows, start=1):
        try:
            record, repeated = _load(line)
        except ValueError:
            errors.append((n, "invalid_json"))
            continue
        found = []
        for _ in repeated:
            found.append("duplicate_key")
        messages = record.get("messages") if isinstance(record, dict) else None
        if not isinstance(messages, list) or not messages:
            found.append("missing_messages")
            errors.extend((n, code) for code in found)
            continue
        turns = [m for m in messages if m["role"] != "system"]
        expected = ["user", "assistant"] * (len(turns) // 2)
        if not turns or [m["role"] for m in turns] != expected:
            found.append("bad_role_order")
        if any(m["role"] == "assistant" and m["content"] == "" for m in messages):
            found.append("empty_assistant")
        tokens = sum(len(m["content"].split()) for m in turns)
        if tokens > max_tokens:
            found.append("too_long")
        errors.extend((n, code) for code in found)
    return errors
`;

export const prelude = `
import json as _json


def _gen_dataset(n, seed, max_tokens=60):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    pool = [' '.join('w%d' % ((k * 7 + j) % 500) for j in range(1 + k % 14)) for k in range(300)]
    lines = []
    for _ in range(n):
        r = nxt() % 100
        if r < 3:
            lines.append('' if r else '   ')
            continue
        msgs = []
        if nxt() % 3 == 0:
            msgs.append({'role': 'system', 'content': pool[nxt() % 300]})
        for _ in range(1 + nxt() % 3):
            msgs.append({'role': 'user', 'content': pool[nxt() % 300]})
            msgs.append({'role': 'assistant', 'content': pool[nxt() % 300]})
        if r < 5:
            msgs.pop()
        elif r < 7:
            msgs[-1]['content'] = ' ' if r == 5 else ''
        line = _json.dumps({'messages': msgs})
        if r == 7:
            line = line[:len(line) // 2]
        elif r == 8:
            line = line[:-1] + ', "messages": []}'
        lines.append(line)
    return lines, max_tokens
`.trim() + "\n";

/* ---------- a strict JSON parser that reports repeated keys (the oracle's own) ---------- */
function parseJSON(text) {
  let i = 0, repeated = false;
  const ws = () => { while (i < text.length && " \t\n\r".includes(text[i])) i++; };
  const fail = () => { throw new Error("bad json"); };
  function value() {
    ws();
    const ch = text[i];
    if (ch === "{") {
      i++; ws();
      const obj = {}, seen = new Set();
      if (text[i] === "}") { i++; return obj; }
      for (;;) {
        ws();
        if (text[i] !== '"') fail();
        const k = str();
        ws();
        if (text[i] !== ":") fail();
        i++;
        const v = value();
        if (seen.has(k)) repeated = true;
        seen.add(k);
        obj[k] = v;                                    // the last value of a repeated key counts
        ws();
        if (text[i] === ",") { i++; continue; }
        if (text[i] === "}") { i++; return obj; }
        fail();
      }
    }
    if (ch === "[") {
      i++; ws();
      const arr = [];
      if (text[i] === "]") { i++; return arr; }
      for (;;) {
        arr.push(value());
        ws();
        if (text[i] === ",") { i++; continue; }
        if (text[i] === "]") { i++; return arr; }
        fail();
      }
    }
    if (ch === '"') return str();
    for (const [lit, v] of [["true", true], ["false", false], ["null", null]]) {
      if (text.startsWith(lit, i)) { i += lit.length; return v; }
    }
    const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i));
    if (!m) fail();
    i += m[0].length;
    return Number(m[0]);
  }
  function str() {
    i++;
    let out = "";
    for (;;) {
      if (i >= text.length) fail();
      const ch = text[i];
      if (ch === '"') { i++; return out; }
      if (ch.charCodeAt(0) < 0x20) fail();
      if (ch === "\\") {
        const e = text[i + 1];
        const map = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
        if (e in map) { out += map[e]; i += 2; continue; }
        if (e === "u" && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) { out += String.fromCharCode(parseInt(text.slice(i + 2, i + 6), 16)); i += 6; continue; }
        fail();
      }
      out += ch; i++;
    }
  }
  const v = value();
  ws();
  if (i !== text.length) fail();
  return { value: v, repeated };
}

const isBlank = (s) => s.trim() === "";
const words = (s) => s.split(/[ \t\n\r\f\v]+/).filter((w) => w.length > 0).length;

// The specification, implemented independently of the Python reference.
export function oracle(lines, maxTokens) {
  if (lines.every(isBlank)) return [[0, "no_examples"]];
  const out = [];
  lines.forEach((line, k) => {
    const n = k + 1;                                  // 1-based, blank lines counted
    if (isBlank(line)) return;
    let parsed;
    try { parsed = parseJSON(line); } catch { out.push([n, "invalid_json"]); return; }
    if (parsed.repeated) out.push([n, "duplicate_key"]);
    const rec = parsed.value;
    const msgs = rec && typeof rec === "object" && !Array.isArray(rec) ? rec.messages : undefined;
    if (!Array.isArray(msgs) || msgs.length === 0) { out.push([n, "missing_messages"]); return; }
    const roles = msgs.map((m) => m.role);
    let p = roles[0] === "system" ? 1 : 0;
    const rest = roles.slice(p);
    const ok = rest.length > 0 && rest.length % 2 === 0 && rest.every((r, j) => r === (j % 2 === 0 ? "user" : "assistant"));
    if (!ok) out.push([n, "bad_role_order"]);
    if (msgs.some((m) => m.role === "assistant" && isBlank(m.content))) out.push([n, "empty_assistant"]);
    if (msgs.reduce((s, m) => s + words(m.content), 0) > maxTokens) out.push([n, "too_long"]);
  });
  return out;
}

/* ---------- building lines: objects as ordered pairs, so a key can repeat ---------- */
const O = (...pairs) => ({ pairs });
const ser = (v) => {
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(ser).join(", ") + "]";
  return "{" + v.pairs.map(([k, x]) => JSON.stringify(k) + ": " + ser(x)).join(", ") + "}";
};
const msg = (role, content) => O(["role", role], ["content", content]);
const line = (...msgs) => ser(O(["messages", msgs]));
const W = (k, from = 1) => Array.from({ length: k }, (_, j) => "w" + (from + j)).join(" ");

const pyArgs = (c) => `([${c.lines.map((l) => JSON.stringify(l)).join(", ")}], ${c.max})`;
const pyOut = (xs) => "[" + xs.map(([n, code]) => `(${n}, '${code}')`).join(", ") + "]";
const run = (c) => oracle(c.lines, c.max);

function content(r, k) {
  const ws = [];
  for (let j = 0; j < k; j++) ws.push("w" + r.int(1, 99));
  if (k > 1 && r.chance(0.3)) return ws.slice(0, 1).join(" ") + r.pick(["\n", "  ", "\t"]) + ws.slice(1).join(" ");
  return ws.join(" ");
}

function streamCase(r, level) {
  const max = r.int(12, 20);
  const lines = [];
  const n = r.int(6, 9);
  for (let i = 0; i < n; i++) {
    if (level >= 2 && r.chance(0.15)) { lines.push(r.pick(["", "   ", "\t"])); continue; }
    const kind = r.int(0, 12);
    const msgs = [];
    if (level >= 2 && r.chance(0.35)) msgs.push(msg("system", content(r, r.int(1, 6))));
    const turns = r.int(1, 2);
    for (let t = 0; t < turns; t++) { msgs.push(msg("user", content(r, r.int(1, 5)))); msgs.push(msg("assistant", content(r, r.int(1, 5)))); }
    if (kind === 0) { lines.push(r.pick([`{'messages': []}`, "messages: user w1", ser(O(["messages", msgs])).slice(0, -2)])); continue; }
    if (kind === 1) { lines.push(r.pick([`{"messages": []}`, `["w1", "w2"]`, ser(O(["prompt", "w1 w2"]))])); continue; }
    if (kind === 2) msgs.pop();                                         // ends with the user
    if (kind === 3) msgs.splice(msgs.length - 1, 0, msg("user", content(r, 2)));   // two users in a row
    if (kind === 4) msgs[msgs.length - 1] = msg("assistant", level === 3 && r.chance(0.5) ? r.pick([" ", "  \n"]) : "");
    if (kind === 5) msgs.push(msg("user", content(r, 6)), msg("assistant", content(r, 8)));  // long
    if (kind === 6 && level >= 2) msgs.splice(1 + r.int(0, msgs.length - 2), 0, msg("system", content(r, 2)));
    if (kind === 7 && level === 3) {
      const m = r.int(0, msgs.length - 1);
      msgs[m] = O(["role", msgs[m].pairs[0][1]], ["content", "w1"], ["content", msgs[m].pairs[1][1]]);
      if (r.chance(0.5)) {
        const m2 = r.int(0, msgs.length - 1);
        if (m2 !== m) msgs[m2] = O(["role", msgs[m2].pairs[0][1]], ["role", msgs[m2].pairs[0][1]], ["content", msgs[m2].pairs[1][1]]);
      }
    }
    lines.push(ser(O(["messages", msgs])));
  }
  return { lines, max };
}

export function generate(r, level) {
  const samples = [];
  for (let i = 0; i < 2; i++) {
    let c;
    for (let a = 0; a < 50; a++) { c = streamCase(r, level); if (run(c).length >= 2) break; }
    samples.push({ args: pyArgs(c), expect: pyOut(run(c)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const max = r.int(12, 24);
  const ok = () => line(msg("user", W(2)), msg("assistant", W(3, 5)));
  const sys = r.int(3, 6);
  const edges = [
    ["line numbers count blank lines",
      { lines: [ok(), "", `{"messages": [`, "   ", `{"prompt": "w1"}`, ok()], max }],
    ["a system turn is allowed first and nowhere else",
      { lines: [line(msg("system", W(2)), msg("user", W(2)), msg("assistant", W(2))),
        line(msg("user", W(2)), msg("system", W(2)), msg("assistant", W(2))),
        line(msg("system", W(1)), msg("system", W(1)), msg("user", W(2)), msg("assistant", W(2)))], max }],
    ["the length limit counts every turn, the system turn included",
      { lines: [line(msg("system", W(sys)), msg("user", W(max - sys - 2)), msg("assistant", W(3))),
        line(msg("system", W(sys)), msg("user", W(max - sys - 3)), msg("assistant", W(3)))], max }],
    ["an assistant turn of whitespace only is empty",
      { lines: [line(msg("user", W(2)), msg("assistant", "  \n ")), line(msg("user", W(2)), msg("assistant", "")), ok()], max }],
    ["several repeated keys on one line are reported once",
      { lines: [ser(O(["messages", [O(["role", "user"], ["role", "user"], ["content", W(2)]), O(["role", "assistant"], ["content", "w9"], ["content", W(2)])]])),
        ser(O(["messages", [msg("user", W(2)), O(["role", "assistant"], ["content", "w9"], ["content", W(2)])]]))], max }],
    ["exactly max_tokens is allowed, one more is too long",
      { lines: [line(msg("user", W(max - 3)), msg("assistant", W(3))), line(msg("user", W(max - 2)), msg("assistant", W(3)))], max }],
    ["a file with only blank lines has no examples",
      { lines: ["", "  ", "\t"], max }],
    ["not JSON, not an object, or no messages",
      { lines: [`{'messages': []}`, ok() + ",", `["w1", "w2"]`, `{"messages": []}`, `{"messages": {}}`, ser(O(["prompt", W(3)]))], max }],
    ["the conversation starts with the user and ends with the assistant",
      { lines: [line(msg("assistant", W(2)), msg("user", W(2))), line(msg("user", W(2))),
        line(msg("user", W(2)), msg("user", W(2)), msg("assistant", W(2))), line(msg("system", W(2)))], max }],
    ["a repeated messages key keeps its last value",
      { lines: [ser(O(["messages", [msg("user", W(2)), msg("assistant", W(2))]], ["messages", []])), ok()], max }],
  ];
  for (const [name, c] of edges) tests.push({ name, args: pyArgs(c), expect: pyOut(run(c)) });

  const n = level === 1 ? 50000 : 80000;
  tests.push({ name: `${n.toLocaleString("en-US")} lines in time`, args: `_gen_dataset(${n}, ${r.int(1, 1_000_000)}, ${r.int(40, 80)})`, limit_s: 8 });

  return {
    vars: {
      replay_rule: level === 1
        ? "This replay has no blank lines, no system turns and no repeated keys; the checks also include all three."
        : level === 2
          ? "This replay has blank lines and system turns, some of them out of place; the checks also include repeated keys and whitespace-only assistant turns."
          : "This replay has blank lines, system turns in and out of place, repeated keys and assistant turns of whitespace only.",
    },
    samples,
    tests,
  };
}
