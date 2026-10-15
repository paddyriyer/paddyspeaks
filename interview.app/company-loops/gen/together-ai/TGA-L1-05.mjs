/* TGA-L1-05 — Structured output streams: when did the JSON become complete, or invalid?
   (Python, one incremental scanner state per stream.)
   Simulated practice scenario. All data is generated from the seed; responses are
   synthetic JSON-like text and the structural check is this exercise's rule.

   Contract (python): entry, signature, starter, prelude, generate(r, level) ->
     { vars, samples: [{args, expect}], tests: [{name, args, expect?, limit_s?}] }.
   expect comes from oracle() below, which joins each stream's chunks into one text and
   parses it with a recursive descent (a container calls itself for nested containers
   and a string reader for strings), then maps the closing bracket back to its chunk.
   The evaluator's reference is a single incremental scanner over the chunks, so each
   checks the other. One reference serves every level: lower levels simply never
   contain the cases that only the higher levels' rules decide.
   level: 1 Medium (brackets inside strings, escaped quotes and backslashes, chunks that
            split anything, mismatched brackets, text before the first bracket, streams
            that stop early)
          · 2 Hard (+ only JSON's escapes are allowed, \u needs four hex digits, and
            nothing but whitespace may follow a complete response)
          · 3 Very Hard (+ a raw control character inside a string is invalid; escapes
            and \u digits split across chunks) */
export const kind = "python";
export const entry = "json_stream_status";
export const signature = "def json_stream_status(streams: list[list[str]]) -> list[tuple[str, int]]:";
export const starter = `def json_stream_status(streams):
    """streams: one list of text chunks per streamed response, in arrival order.
    For each stream return ("complete", chunk_index), ("invalid", char_index)
    or ("incomplete", open_brackets), by this exercise's structural rules."""
    ...
`;

export const prelude = `
def _gen_streams(n, length, seed, strict=True):
    x = seed

    def nxt():
        nonlocal x
        x = (1103515245 * x + 12345) % 2147483648
        return x >> 8
    words = ["lora", "adapter", "token", "x{y}", "a[b]", "rank", " ", "eval", "{", "]"]
    pieces = ['\\\\"', "\\\\\\\\", "\\\\u00e9", "\\\\n", "\\\\/"]

    def text():
        out = []
        for _ in range(1 + nxt() % 4):
            out.append(words[nxt() % 10] if nxt() % 3 else pieces[nxt() % 5])
        return '"' + "".join(out) + '"'
    streams = []
    for s in range(n):
        recs, size = [], 0
        while size < length:
            rec = '{"id": %d, "text": %s, "tags": [%s, %s], "meta": {"k": %s, "n": [1, 2, {"d": %d}]}}' % (
                nxt() % 100000, text(), text(), text(), text(), nxt() % 1000)
            recs.append(rec)
            size += len(rec) + 2
        body = "[" + ", ".join(recs) + "]"
        kind = s % 4
        if kind == 0:
            body += "\\n"
        elif kind == 1:
            body = body[:-1] + "}"
        elif kind == 2:
            body = body[:-(5 + nxt() % 40)]
        elif strict:
            body = body[:-1] + ', "bad \\\\q"]'
        else:
            body += " \\n "
        chunks, i = [], 0
        while i < len(body):
            step = 1 + nxt() % 4
            chunks.append(body[i:i + step])
            i += step
        streams.append(chunks)
    return (streams,)
`.trim() + "\n";

const WS = new Set([" ", "\t", "\n", "\r"]);
const ESC = new Set(['"', "\\", "/", "b", "f", "n", "r", "t", "u"]);
const isHex = (c) => /^[0-9a-fA-F]$/.test(c);

// Independent oracle: recursive descent over the joined text.
export function oracle(chunks) {
  const text = chunks.join("");
  const n = text.length;
  let i = 0;
  const eof = (depth) => ({ t: "eof", depth });
  const bad = (at) => ({ t: "invalid", at });
  function str(depth) {                         // text[i] is the opening quote
    i++;
    for (;;) {
      if (i >= n) return eof(depth);
      const c = text[i];
      if (c === '"') { i++; return null; }
      if (c === "\\") {
        i++;
        if (i >= n) return eof(depth);
        const e = text[i];
        if (!ESC.has(e)) return bad(i);
        i++;
        if (e === "u") {
          for (let h = 0; h < 4; h++) {
            if (i >= n) return eof(depth);
            if (!isHex(text[i])) return bad(i);
            i++;
          }
        }
        continue;
      }
      if (c.charCodeAt(0) < 32) return bad(i);
      i++;
    }
  }
  function container(depth) {                   // text[i] is the opening bracket
    const close = text[i] === "{" ? "}" : "]";
    i++;
    for (;;) {
      if (i >= n) return eof(depth);
      const c = text[i];
      if (c === '"') { const s = str(depth); if (s) return s; }
      else if (c === "{" || c === "[") { const s = container(depth + 1); if (s.t !== "closed") return s; }
      else if (c === "}" || c === "]") { if (c !== close) return bad(i); i++; return { t: "closed" }; }
      else i++;
    }
  }
  while (i < n && WS.has(text[i])) i++;
  if (i === n) return ["incomplete", 0];
  if (text[i] !== "{" && text[i] !== "[") return ["invalid", i];
  const res = container(1);
  if (res.t === "invalid") return ["invalid", res.at];
  if (res.t === "eof") return ["incomplete", res.depth];
  const closedAt = i - 1;
  for (; i < n; i++) if (!WS.has(text[i])) return ["invalid", i];
  let start = 0;
  for (let k = 0; k < chunks.length; k++) {
    if (closedAt >= start && closedAt < start + chunks[k].length) return ["complete", k];
    start += chunks[k].length;
  }
  throw new Error("TGA-L1-05 oracle: closing bracket outside every chunk");
}

const pyArgs = (streams) => `(${JSON.stringify(streams)},)`;
const pyOut = (res) => "[" + res.map(([s, v]) => `("${s}", ${v})`).join(", ") + "]";
const run = (streams) => streams.map((c) => oracle(c));

// ---- Random responses ---------------------------------------------------------------
const WORDS = ["lora", "rank", "x{y}", "a[b]", "ok", "}", "[", "eval", "id 7", " "];
const ESCAPED = ['\\"', "\\\\", "\\n", "\\u00e9", "\\/", "\\t"];
const KEYS = ["name", "score", "tags", "steps", "label", "items"];

function build(r, depth, out) {                 // appends a value; records string starts
  const roll = r.next();
  if (depth < 3 && (depth === 0 || roll < 0.45)) {
    const obj = depth === 0 ? r.chance(0.6) : r.chance(0.5);
    out.text += obj ? "{" : "[";
    const k = r.int(depth === 0 ? 2 : 0, 3);
    for (let j = 0; j < k; j++) {
      if (j) out.text += r.pick([", ", ",", ",\n  "]);
      if (obj) { out.strings.push(out.text.length); out.text += `"${r.pick(KEYS)}": `; }
      build(r, depth + 1, out);
    }
    out.text += obj ? "}" : "]";
    return;
  }
  if (roll < 0.8) {
    out.strings.push(out.text.length);
    let s = '"';
    for (let j = r.int(1, 3); j > 0; j--) s += r.chance(0.55) ? r.pick(WORDS) : r.pick(ESCAPED);
    out.text += s + '"';
    return;
  }
  out.text += r.pick(["12", "0.5", "true", "null", "-3"]);
}
function chunk(r, text, level) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    if (r.chance(0.05)) out.push("");
    const step = r.int(1, 6);
    out.push(text.slice(i, i + step));
    i += step;
  }
  if (level === 3) {                             // split right after a backslash somewhere
    const j = text.indexOf("\\");
    if (j >= 0) return chunkAt(text, out, j + 1);
  }
  return out;
}
function chunkAt(text, chunks, cut) {            // re-chunk so that a chunk boundary falls at cut
  const out = [];
  let start = 0;
  for (const c of chunks) {
    const end = start + c.length;
    if (cut > start && cut < end) { out.push(text.slice(start, cut), text.slice(cut, end)); }
    else out.push(c);
    start = end;
  }
  return out;
}
function response(r) {
  const o = { text: "", strings: [] };
  build(r, 0, o);
  return o;
}
function variant(r, level, kindName) {
  const o = response(r);
  let t = o.text;
  const strAt = () => r.pick(o.strings) + 1;   // just inside an opening quote
  switch (kindName) {
    case "complete": t = r.pick(["", "", " ", "\n"]) + t + (level >= 2 ? r.pick(["", "\n", " \n "]) : ""); break;
    case "cut": t = t.slice(0, r.int(1, t.length - 1)); break;
    case "mismatch": {
      const closers = [];
      let inStr = false;
      for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (inStr) { if (c === "\\") i++; else if (c === '"') inStr = false; }
        else if (c === '"') inStr = true;
        else if (c === "}" || c === "]") closers.push(i);
      }
      const p = r.pick(closers);
      t = t.slice(0, p) + (t[p] === "}" ? "]" : "}") + t.slice(p + 1);
      break;
    }
    case "preamble": t = r.pick(["Sure! ", "Here is the JSON: ", '"', "json\n"]) + t; break;
    case "trailing": t = t + r.pick([" Done.", "\n{}", " ]", "\n\n```"]); break;
    case "escape": { const p = strAt(); t = t.slice(0, p) + r.pick(["\\q", "\\x41", "\\a"]) + t.slice(p); break; }
    case "hex": { const p = strAt(); t = t.slice(0, p) + r.pick(["\\u12g4", "\\u00", "\\uZZZZ"]) + t.slice(p); break; }
    case "control": { const p = strAt(); t = t.slice(0, p) + r.pick(["line\nbreak", "tab\there"]) + t.slice(p); break; }
    default: throw new Error(kindName);
  }
  return chunk(r, t, level);
}

export function generate(r, level) {
  const kinds = ["complete", "complete", "cut", "mismatch", "preamble"];
  if (level >= 2) kinds.push("trailing", "escape", "hex");
  if (level === 3) kinds.push("control", "cut");
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const picks = r.shuffle(kinds).slice(0, r.int(4, 6));
    if (!picks.includes("complete")) picks[0] = "complete";
    const streams = picks.map((k) => variant(r, level, k));
    samples.push({ args: pyArgs(streams), expect: pyOut(run(streams)) });
  }
  const tests = samples.map((s, i) => ({ name: "sample " + (i + 1), args: s.args, expect: s.expect }));

  const w = r.pick(["lora", "rank", "eval", "steps"]);
  const edges = [
    ["brackets inside a string are text", [`{"${w}": "}]"`, "}"]],
    ["an escaped quote does not end the string", [`["say \\"${w}\\" ]"`, "]"]],
    ["an escaped backslash before the closing quote", [`["${w}\\\\"]`]],
    ["a backslash at the end of a chunk", [`{"${w}": "a\\`, '"', ' b"}']],
    ["a mismatched closing bracket", [`{"${w}": [1, 2}`]],
    ["text before the first bracket", [`Sure: {"${w}": 1}`]],
    ["a stream that stops inside a string", ["[{", `"${w}": "unfinish`]],
    ["nested brackets close in a later chunk", ["[[{", "}]", " ]"]],
    ["empty chunks still count", ["", "[", "", `"${w}"`, "]", ""]],
    ["only whitespace so far", ["  ", "\n"]],
    ["no chunks at all", []],
  ];
  if (level >= 2) {
    edges.push(["whitespace after a complete response", ["[]", " \n\t"]]);
    edges.push(["text after a complete response", [`{"${w}": 1}`, " ok"]]);
    edges.push(["two objects in one response", ["{}{}"]]);
    edges.push(["an escape that JSON does not allow", [`["${w}\\q"]`]]);
    edges.push(["a \\u escape with four hex digits", [`["\\u00E9${w}"]`]]);
    edges.push(["a \\u escape with a character that is not hex", [`["\\u00g9"]`]]);
  }
  if (level === 3) {
    edges.push(["a raw newline inside a string", [`{"${w}": "line`, '\nnext"}']]);
    edges.push(["a raw tab inside a string", [`["a\tb"]`]]);
    edges.push(["newlines between values are whitespace", [`{\n  "${w}": 1,\n  "x": [\n  ]\n}`]]);
    edges.push(["\\u digits split across chunks", ['["\\u0', "0e", '9"]']]);
    edges.push(["a stream that stops after a backslash", [`["${w}\\`]]);
  }
  for (const [name, chunks] of edges) tests.push({ name, args: pyArgs([chunks]), expect: pyOut(run([chunks])) });

  // Timing: compared with the reference at check time. Four streams of about 150,000
  // characters in chunks of 1-4 characters (about 240,000 chunks). The incremental
  // scanner reads each character once (about 0.1 s in CPython); re-scanning the
  // accumulated text after every chunk is about 10^10 character steps.
  const seed = r.int(1, 1_000_000);
  tests.push({ name: "four long streams in small chunks, in time", args: `_gen_streams(4, 150000, ${seed}, ${level >= 2 ? "True" : "False"})`, limit_s: 8 });

  return {
    vars: {
      escape_rule: level === 1
        ? "In this exercise every escape in the data is one JSON allows, and nothing but whitespace follows a complete response."
        : "After a backslash, only these characters are allowed: a double quote, a backslash, a slash, b, f, n, r, t or u; any other character is invalid at its position. After \\u, four hex digits (0-9, a-f, A-F) must follow; the first character that is not one is invalid. Once the response is complete, only whitespace may follow; any other character is invalid at its position, even in a later chunk.",
      control_rule: level === 3
        ? "A raw control character (code below 32, such as a newline or a tab typed directly rather than escaped) inside a string is invalid at its position. Escapes and the four hex digits of \\u can be split across chunks."
        : "No string in this data contains a raw control character.",
    },
    samples,
    tests,
  };
}
