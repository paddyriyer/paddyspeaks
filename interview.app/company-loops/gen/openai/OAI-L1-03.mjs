/* OAI-L1-03 — Context-window overflow in multi-turn conversations (SQL).
   Simulated practice scenario. All data is generated from the seed.

   generate(r, level) -> { vars, setup, tables, expected, diagnostics }   (see OAI-L1-01.mjs)
   level: 1 Medium   one model; sessions split by an inactivity gap; a gap of exactly
                     the limit and a session that reaches exactly the window
          2 Hard     + several models with different windows; two messages with the same
                     sent_at straddle the overflow (the message_id tie-break decides)
          3 Very Hard + a per-conversation system prompt that re-enters the context at the
                     start of every session

   The schema is the same at every level (one reference query serves all of them):
   at levels 1 and 2 system_tokens is 0. */
import { insertSQL } from "../../js/rng.js";

export const kind = "sql";

const MODEL_NAMES = ["chat-mini", "chat-standard", "chat-long", "reasoning-pro"];
const WINDOWS = [8000, 12000, 16000, 24000, 32000];
const BASE_MS = Date.UTC(2026, 8, 21, 7, 0, 0);          // fixed instant; never the clock

export function generate(r, level) {
  const gap = r.pick([20, 30, 45, 60]);                  // minutes
  const G = gap * 60;                                    // seconds
  const nModels = level === 1 ? 1 : r.int(2, 3);
  const modelNames = r.sample(MODEL_NAMES, nModels).sort();
  const windows = r.sample(WINDOWS, nModels);
  const models = modelNames.map((m, i) => ({ model: m, window: windows[i] }));
  const nConv = level === 1 ? 3 : level === 2 ? 4 : 5;

  // Conversation ids: same width, so text order is the same under any collation.
  const convIds = r.sample([...Array(80)].map((_, i) => "conv_" + (1100 + i * 37)), nConv).sort();
  const convs = convIds.map((id) => {
    const m = r.pick(models);
    return { id, model: m.model, window: m.window, system: level === 3 ? r.int(15, 60) * 20 : 0 };
  });

  // Plan sessions. At least two overflowing sessions; the planted edge cases go into them.
  const sessions = [];                                   // {conv, kind, exact, tie}
  for (const c of convs) {
    const n = r.int(1, level === 1 ? 2 : 3);
    for (let s = 0; s < n; s++) sessions.push({ conv: c, kind: r.chance(0.45) ? "overflow" : "fits" });
  }
  const forced = r.sample(sessions.map((_, i) => i), Math.min(3, sessions.length));
  for (const i of forced) sessions[i].kind = "overflow";
  const over = sessions.filter((s) => s.kind === "overflow");
  over[0].exact = true;                                  // reaches exactly the window, then exceeds it
  if (level >= 2) over[over.length > 1 ? 1 : 0].tie = true;
  const fits = sessions.filter((s) => s.kind === "fits");
  if (fits.length) fits[0].touch = true;                 // ends at exactly the window: never overflows

  // Build messages, conversation by conversation.
  const msgs = [];                                       // {conv, t, tokens, k}
  let exactGapPlanted = false, plusOnePlanted = false;
  for (const c of convs) {
    let t = r.int(0, 6 * 3600);
    let k = 0;
    const mine = sessions.filter((s) => s.conv === c);
    mine.forEach((s, si) => {
      if (si > 0) {
        if (level >= 2 && !plusOnePlanted) { t += G + 1; plusOnePlanted = true; }   // one second over: a new session
        else t += G + r.int(60, 4 * 3600);
      }
      const budget = c.window - c.system;
      const toks = sessionTokens(r, s, budget);
      toks.forEach((tok, j) => {
        if (j > 0) {
          if (s.tie && j === s.cross) t += 0;                                      // same second as the previous message
          else if (!exactGapPlanted && j >= 1 && s.kind === "overflow") { t += G; exactGapPlanted = true; }   // exactly the limit: same session
          else t += r.pick([3, 20, 45, 90, 300, 600, Math.max(5, G - 1 - r.int(0, 120))]);
        }
        msgs.push({ conv: c, t, tokens: tok, k: k++ });
      });
    });
  }

  // Message ids increase with time (ties keep the planned order); gaps between ids.
  msgs.sort((a, b) => a.t - b.t || (a.conv.id < b.conv.id ? -1 : a.conv.id > b.conv.id ? 1 : 0) || a.k - b.k);
  let id = 500000 + r.int(0, 400000);
  for (const m of msgs) m.id = (id += r.int(1, 9));

  // ---- Oracle -------------------------------------------------------------
  const compute = (o = {}) => {
    const out = [];
    for (const c of convs) {
      const list = msgs.filter((m) => m.conv === c).sort((a, b) => a.t - b.t || a.id - b.id);
      let session = 0, run = 0, turn = 0, done = false, prevT = null;
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        const isNew = prevT === null || (!o.noSessions && (o.gapInclusive ? m.t - prevT >= G : m.t - prevT > G));
        prevT = m.t;
        if (isNew) { session += 1; run = 0; turn = 0; done = false; }
        turn += 1;
        run += m.tokens;
        let shown = run;
        if (o.rangePeers) {                               // default RANGE frame: peers share a total
          for (let j = i + 1; j < list.length && list[j].t === m.t; j++) {
            const brk = !o.noSessions && (o.gapInclusive ? list[j].t - list[j - 1].t >= G : list[j].t - list[j - 1].t > G);
            if (brk) break;
            shown += list[j].tokens;
          }
        }
        const ctx = (o.noSystem ? 0 : c.system) + shown;
        if (!done && (o.inclusive ? ctx >= c.window : ctx > c.window)) {
          out.push([c.id, session, turn, m.id, ctx, c.window]);
          done = true;
        }
      }
    }
    return out;
  };
  const rows = compute();

  const diagnostics = [
    { message: `Messages were not split into sessions, so the running total never resets. A gap of more than ${gap} minutes starts a new session with an empty context.`, rows: compute({ noSessions: true }) },
    { message: `A gap of exactly ${gap} minutes started a new session. Only a gap of MORE than ${gap} minutes does.`, rows: compute({ gapInclusive: true }) },
    { message: "A context exactly equal to the window still fits. The first overflowing turn is the first one strictly greater than context_window.", rows: compute({ inclusive: true }) },
  ];
  if (level >= 2) diagnostics.push({ message: "The running SUM used the default window frame (RANGE … CURRENT ROW) ordered by sent_at alone, so messages with the same sent_at share one total. Order by sent_at, message_id and use ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW.", rows: compute({ rangePeers: true }) });
  if (level === 3) diagnostics.push({ message: "The system prompt was left out. Its tokens re-enter the context at the start of every session.", rows: compute({ noSystem: true }) });

  const fmt = (sec) => new Date(BASE_MS + sec * 1000).toISOString().replace("T", " ").replace(".000Z", "+00");
  const msgCols = ["message_id", "conversation_id", "role", "sent_at", "tokens"];
  const roleOf = new Map();
  for (const c of convs) msgs.filter((m) => m.conv === c).forEach((m, i) => roleOf.set(m, i % 2 ? "assistant" : "user"));
  const msgRows = msgs.map((m) => [m.id, m.conv.id, roleOf.get(m), fmt(m.t), m.tokens]);
  const convCols = ["conversation_id", "model", "system_tokens"];
  const convRows = convs.map((c) => [c.id, c.model, c.system]);
  const modCols = ["model", "context_window"];
  const modRows = models.map((m) => [m.model, m.window]);
  const setup =
    "SET TIME ZONE 'UTC';\n" +
    "CREATE TABLE models (\n  model TEXT PRIMARY KEY,\n  context_window INT NOT NULL\n);\n" +
    "CREATE TABLE conversations (\n  conversation_id TEXT PRIMARY KEY,\n  model TEXT NOT NULL REFERENCES models,\n  system_tokens INT NOT NULL\n);\n" +
    "CREATE TABLE messages (\n  message_id BIGINT PRIMARY KEY,\n  conversation_id TEXT NOT NULL REFERENCES conversations,\n  role TEXT NOT NULL CHECK (role IN ('user','assistant')),\n  sent_at TIMESTAMPTZ NOT NULL,\n  tokens INT NOT NULL CHECK (tokens > 0)\n);\n" +
    insertSQL("models", modCols, modRows) + insertSQL("conversations", convCols, convRows) + insertSQL("messages", msgCols, msgRows);

  return {
    vars: {
      gap,
      messages: msgs.length,
      models_rule: level === 1
        ? `Every conversation in this sample uses the same model (context window ${models[0].window} tokens).`
        : "Conversations use different models, each with its own context window.",
      ties_rule: level === 1
        ? "No two messages in a conversation share a sent_at in this sample, but your query must still order deterministically."
        : "Two messages in a conversation can share a sent_at; break the tie by message_id.",
      system_rule: level === 3
        ? "A conversation's system prompt (`system_tokens`) is sent again at the start of every session, so every session's context starts at system_tokens."
        : "`system_tokens` is 0 for every conversation in this sample; the rule still applies.",
    },
    setup,
    tables: [
      { name: "models", columns: modCols, rows: modRows },
      { name: "conversations", columns: convCols, rows: convRows },
      { name: "messages", columns: msgCols, rows: msgRows },
    ],
    expected: { columns: ["conversation_id", "session_no", "turn_no", "message_id", "context_tokens", "context_window"], rows },
    diagnostics: diagnostics.filter((d) => JSON.stringify(d.rows) !== JSON.stringify(rows)),
  };
}

// Token counts for one session against a budget (window − system prompt).
// overflow: turns 1..cross-1 total at most the budget (exactly it when s.exact), turn `cross` exceeds it.
// fits:     the session total stays within the budget (exactly it when s.touch).
function sessionTokens(r, s, budget) {
  if (s.kind === "overflow") {
    const cross = r.int(3, 7);
    s.cross = cross - 1;                                 // 0-based index of the crossing message
    const slack = s.exact ? 0 : r.int(1, Math.floor(budget / 12));
    const before = split(r, budget - slack, cross - 1);
    const toks = [...before, slack + r.int(1, Math.floor(budget / 6))];
    for (let i = r.int(0, 2); i > 0; i--) toks.push(r.int(40, Math.floor(budget / 8)));
    return toks;
  }
  const n = r.int(2, 5);
  const total = s.touch ? budget : r.int(Math.floor(budget * 0.3), Math.floor(budget * 0.9));
  return split(r, total, n);
}

// `n` positive integers summing to `total`, none tiny.
function split(r, total, n) {
  const w = [...Array(n)].map(() => r.int(2, 10));
  const sw = w.reduce((a, b) => a + b, 0);
  const out = w.map((x) => Math.max(10, Math.floor((total * x) / sw)));
  out[out.length - 1] += total - out.reduce((a, b) => a + b, 0);
  return out;
}
