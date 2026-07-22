/**
 * PaddySpeaks — AI Mock Interview route (NS-2, Phase 1: single-turn critique)
 * Mounted by worker.js on POST /api/mock.
 *
 * SAFE-DEGRADE: returns 503 "not configured" until env.ANTHROPIC_API_KEY is
 * set as a Worker secret — so deploying this changes nothing about the live
 * site until you opt in (mirrors the leaderboard's dormant behaviour).
 *
 * PRIVACY: the candidate's answer is sent to the Anthropic API to be graded,
 * then discarded. Nothing is persisted except an anonymised per-day request
 * counter (for rate-limiting). No account, no transcript storage.
 *
 * COST LEVER: MODEL below defaults to Opus 4.8 for the best feedback quality.
 * For a free public tool at volume, claude-haiku-4-5 (~5x cheaper) or
 * claude-sonnet-5 change the math — it's a one-line change here. That's a
 * deliberate product/cost decision, left to the owner.
 */

const MODEL = "claude-opus-4-8";

const CFG = {
  dailyCap: 20,          // AI critiques per anonymised IP per UTC day
  maxQuestionChars: 4000,
  maxAnswerChars: 8000,
  maxTokens: 1200,       // a critique is short; hard ceiling on output
  effort: "medium",      // output_config.effort — balances quality vs cost
};

const ALLOWED_ORIGINS = [
  "https://paddyspeaks.com",
  "https://www.paddyspeaks.com",
];

const te = new TextEncoder();

function json(obj, status, ch) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { ...ch, "Content-Type": "application/json" },
  });
}
async function sha256Hex(str) {
  const d = await crypto.subtle.digest("SHA-256", te.encode(str));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function dayUTC(t) { return new Date(t).toISOString().slice(0, 10); }

function originOk(request) {
  const o = request.headers.get("Origin") || "";
  if (ALLOWED_ORIGINS.includes(o)) return true;
  // Cloudflare branch/commit preview hosts, e.g. *.paddy-iyer.workers.dev
  return /^https:\/\/[a-z0-9-]+\.paddy-iyer\.workers\.dev$/.test(o);
}

/**
 * Anonymised, daily-rotating per-IP counter. The salt rotates each UTC day and
 * is derived from LB_SIGNING_KEY when present, so the stored hash can't be
 * reversed to an IP. Fails OPEN on any DB error (the feature keeps working even
 * before the migration is run) — run mock-schema.sql to enable the cap.
 */
async function rateLimited(request, env) {
  const db = env.DB;
  if (!db) return false;
  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  const day = dayUTC(Date.now());
  const salt = (env.LB_SIGNING_KEY || "ps-mock") + ":" + day;
  const ipHash = await sha256Hex(salt + ":" + ip);
  try {
    await db
      .prepare(
        "INSERT INTO mock_usage (ip_hash, day, n) VALUES (?1, ?2, 1) " +
          "ON CONFLICT(ip_hash, day) DO UPDATE SET n = n + 1"
      )
      .bind(ipHash, day)
      .run();
    const row = await db
      .prepare("SELECT n FROM mock_usage WHERE ip_hash = ?1 AND day = ?2")
      .bind(ipHash, day)
      .first();
    return row && row.n > CFG.dailyCap;
  } catch (_e) {
    return false; // fail open — don't break the tool if the table is missing
  }
}

const CRITIQUE_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["strong", "solid", "partial", "off_track"] },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
    followup: { type: "string" },
  },
  required: ["verdict", "summary", "strengths", "gaps", "followup"],
  additionalProperties: false,
};

function buildMessages({ question, answer, language, difficulty, schema }) {
  const ctx = [
    `QUESTION (${language || "general"}${difficulty ? ", " + difficulty : ""}):`,
    question,
    schema ? `\nSCHEMA / SIGNATURE:\n${schema}` : "",
    `\nCANDIDATE'S ANSWER:\n${answer}`,
  ]
    .filter(Boolean)
    .join("\n");
  return [{ role: "user", content: ctx }];
}

const SYSTEM = `You are a senior data & AI engineering interviewer running a focused mock interview.
You are given one interview QUESTION and the CANDIDATE'S ANSWER. Assess the answer the way a real interviewer would:
- Judge correctness and approach, not just syntax. If the answer is code, reason about what it actually returns and its edge cases (NULLs, ties, duplicates, empty input, performance).
- Be specific and concrete — cite the exact part of their answer you mean. No filler, no praise-sandwiching.
- "strengths" and "gaps": 1-4 short, concrete bullet points each (gaps may be empty if the answer is strong).
- "followup": one probing follow-up question a real interviewer would ask next to push deeper.
- "verdict": strong (interview-passing), solid (good, minor gaps), partial (right idea, real gaps), off_track (wrong approach).
Return only the structured object.`;

async function callAnthropic(env, payloadMessages) {
  const body = {
    model: MODEL,
    max_tokens: CFG.maxTokens,
    system: SYSTEM,
    thinking: { type: "adaptive" },
    output_config: { effort: CFG.effort, format: { type: "json_schema", schema: CRITIQUE_SCHEMA } },
    messages: payloadMessages,
  };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return r;
}

export async function routeMock(request, env, url, ch) {
  if (url.pathname !== "/api/mock" || request.method !== "POST") return null;

  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "not_configured", message: "AI mock is not set up yet." }, 503, ch);
  }
  if (!originOk(request)) {
    return json({ error: "forbidden" }, 403, ch);
  }

  let data;
  try {
    data = await request.json();
  } catch (_e) {
    return json({ error: "bad_request", message: "Invalid JSON." }, 400, ch);
  }

  const question = (data.question || "").toString().trim();
  const answer = (data.answer || "").toString().trim();
  if (!question || !answer) {
    return json({ error: "bad_request", message: "Both a question and an answer are required." }, 400, ch);
  }
  if (question.length > CFG.maxQuestionChars || answer.length > CFG.maxAnswerChars) {
    return json({ error: "too_large", message: "Question or answer is too long." }, 413, ch);
  }

  if (await rateLimited(request, env)) {
    return json(
      { error: "rate_limited", message: `Daily limit reached (${CFG.dailyCap} critiques). Try again tomorrow.` },
      429,
      ch
    );
  }

  const messages = buildMessages({
    question,
    answer,
    language: (data.language || "").toString().slice(0, 40),
    difficulty: (data.difficulty || "").toString().slice(0, 40),
    schema: (data.schema || "").toString().slice(0, 2000),
  });

  let r;
  try {
    r = await callAnthropic(env, messages);
  } catch (_e) {
    return json({ error: "upstream", message: "Couldn’t reach the grader. Try again." }, 502, ch);
  }

  if (r.status === 429) {
    return json({ error: "busy", message: "The grader is busy — try again in a moment." }, 429, ch);
  }
  if (!r.ok) {
    return json({ error: "upstream", message: `Grader error (${r.status}).` }, 502, ch);
  }

  const out = await r.json().catch(() => null);
  if (!out) return json({ error: "upstream", message: "Bad grader response." }, 502, ch);

  if (out.stop_reason === "refusal") {
    return json({ error: "declined", message: "The grader declined this one. Try a different question." }, 200, ch);
  }

  const textBlock = (out.content || []).find((b) => b.type === "text");
  let critique;
  try {
    critique = JSON.parse(textBlock.text);
  } catch (_e) {
    return json({ error: "parse", message: "Couldn’t read the grader’s feedback." }, 502, ch);
  }

  return json({ ok: true, critique }, 200, ch);
}
