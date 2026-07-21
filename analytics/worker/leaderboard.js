/**
 * PaddySpeaks — Anonymous Leaderboard routes (MVP)
 * Mounted by worker.js on /api/lb/*. Uses a SEPARATE D1 binding `env.LB`
 * (paddyspeaks-leaderboard) and an HMAC secret `env.LB_SIGNING_KEY`.
 *
 * INTEGRITY CEILING (documented, not hidden): scores are graded in the user's
 * browser (PGlite/Pyodide), so the server CANNOT recompute them. The signed
 * single-use token prevents replay/duplicates and lets the server own the
 * difficulty multipliers + measure real elapsed time — but a determined user
 * can still forge a raw score. This board is motivational, not a credential.
 */

// ── config (all tunable) ──
const CFG = {
  tokenTtlMs: 3 * 60 * 60 * 1000,   // 3h — a quiz session can be long
  minDurationS: 10,                  // faster than this = implausible → suspicious
  suppressBelow: 5,                  // k-anonymity: hide a view with < N valid entries
  retentionMonths: 12,
  perPageMax: 100,
  diffMult: { easy: 1.0, medium: 1.05, hard: 1.12, expert: 1.20 },
  firstAttemptMult: 1.05,
};

const ADJ = ["Quiet", "Nimble", "Lucid", "Amber", "Cobalt", "Verdant", "Swift", "Clever",
  "Window", "Schema", "Query", "Pipeline", "Vector", "Lambda", "Recursive", "Atomic",
  "Indexed", "Sharded", "Streaming", "Cached", "Partitioned", "Idempotent"];
const NOUN = ["Python", "Falcon", "Monk", "Sage", "Panda", "Otter", "Heron", "Lynx",
  "Wizard", "Architect", "Ranger", "Owl", "Marmot", "Badger", "Kestrel", "Dolphin",
  "Analyst", "Cartographer", "Navigator", "Sentinel", "Warden", "Scout"];

// ── small helpers ──
const te = new TextEncoder();
function json(obj, status, ch) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { ...ch, "Content-Type": "application/json" },
  });
}
function b64url(bytes) {
  let s = btoa(String.fromCharCode(...new Uint8Array(bytes)));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function sha256Hex(str) {
  const d = await crypto.subtle.digest("SHA-256", te.encode(str));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randInt(max) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % max;
}
function makeAlias() {
  return `${ADJ[randInt(ADJ.length)]} ${NOUN[randInt(NOUN.length)]} #${String(randInt(1000)).padStart(3, "0")}`;
}
function dayUTC(t) { return new Date(t).toISOString().slice(0, 10); }
function mondayUTC(t) {
  const x = new Date(t);
  const off = (x.getUTCDay() + 6) % 7; // days since Monday
  x.setUTCDate(x.getUTCDate() - off);
  return x.toISOString().slice(0, 10);
}
function addMonthsISO(t, m) {
  const x = new Date(t); x.setUTCMonth(x.getUTCMonth() + m); return x.toISOString();
}
function normalize(raw, difficulty, firstAttempt) {
  const dm = CFG.diffMult[difficulty] || 1.0;
  const fa = firstAttempt ? CFG.firstAttemptMult : 1.0;
  return Math.round(raw * dm * fa * 100) / 100;
}

// ── HMAC attempt tokens (mini-JWT: base64url(payload).base64url(sig)) ──
async function hmacKey(env) {
  return crypto.subtle.importKey("raw", te.encode(env.LB_SIGNING_KEY),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function signToken(env, payload) {
  const body = b64url(te.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(env), te.encode(body));
  return `${body}.${b64url(sig)}`;
}
async function verifyToken(env, token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(env), fromB64url(sig), te.encode(body));
    if (!ok) return null;
    const obj = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    if (!obj || typeof obj.exp !== "number" || obj.exp < Date.now()) return null;
    return obj;
  } catch { return null; }
}

const CATS = new Set(["sql", "python"]);
const DIFFS = new Set(["easy", "medium", "hard", "expert"]);

// ── POST /api/lb/token  — issued at test START ──
async function handleToken(request, env, ch) {
  let d; try { d = await request.json(); } catch { return json({ error: "bad json" }, 400, ch); }
  const category = String(d.category || "").toLowerCase();
  const difficulty = String(d.difficulty || "").toLowerCase();
  const testId = String(d.test_id || "").slice(0, 64);
  if (!CATS.has(category) || !DIFFS.has(difficulty)) return json({ error: "invalid category/difficulty" }, 400, ch);
  const now = Date.now();
  const nonce = crypto.randomUUID();
  const token = await signToken(env, { cat: category, diff: difficulty, tid: testId, iat: now, exp: now + CFG.tokenTtlMs, nonce });
  // fire-and-forget: count a "start" in the non-identifying daily aggregate
  try {
    await env.LB.prepare(
      `INSERT INTO daily_metrics (metric_date, category, test_id, starts, completions)
       VALUES (?,?,?,1,0)
       ON CONFLICT(metric_date, category, test_id) DO UPDATE SET starts = starts + 1`
    ).bind(dayUTC(now), category, testId).run();
  } catch (_) { /* metrics are best-effort */ }
  return json({ token }, 200, ch);
}

// ── POST /api/lb/submit ──
async function handleSubmit(request, env, ch) {
  let d; try { d = await request.json(); } catch { return json({ error: "bad json" }, 400, ch); }
  if (d.consent !== true) return json({ error: "consent required" }, 400, ch);
  const claim = await verifyToken(env, d.token);
  if (!claim) return json({ error: "invalid or expired token" }, 401, ch);

  const raw = Math.max(0, Math.min(100, Math.round(Number(d.raw_percentage))));
  if (!Number.isFinite(raw)) return json({ error: "invalid score" }, 400, ch);
  const firstAttempt = d.first_attempt === true ? 1 : 0;
  const now = Date.now();
  const durationS = Math.round((now - claim.iat) / 1000);

  // replay / duplicate: nonce is single-use
  try {
    await env.LB.prepare(`INSERT INTO used_nonces (nonce, used_at) VALUES (?, ?)`)
      .bind(claim.nonce, new Date(now).toISOString()).run();
  } catch (_) {
    return json({ error: "already submitted" }, 409, ch);
  }

  // plausibility → integrity
  let integrity = "valid";
  if (durationS < CFG.minDurationS) integrity = "suspicious";

  const id = crypto.randomUUID();
  const normalized = normalize(raw, claim.diff, firstAttempt);
  const periodKey = "w:" + mondayUTC(now);
  const createdDay = dayUTC(now);
  const expiresAt = addMonthsISO(now, CFG.retentionMonths);

  // deletion token: returned to the browser ONLY; we store just its hash
  const deletionToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  const deletionHash = await sha256Hex(deletionToken);

  // best-effort unique alias within the current week
  let alias = makeAlias();
  for (let i = 0; i < 5; i++) {
    const clash = await env.LB.prepare(
      `SELECT 1 FROM leaderboard_entries WHERE public_alias = ? AND period_key = ? LIMIT 1`
    ).bind(alias, periodKey).first();
    if (!clash) break;
    alias = makeAlias();
  }

  await env.LB.prepare(
    `INSERT INTO leaderboard_entries
       (id, public_alias, category, difficulty, raw_percentage, normalized_score,
        first_attempt, duration_s, period_key, integrity_status, deletion_token_hash,
        nonce, created_day, expires_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, alias, claim.cat, claim.diff, raw, normalized, firstAttempt, durationS,
    periodKey, integrity, deletionHash, claim.nonce, createdDay, expiresAt).run();

  // roll the non-identifying completion aggregate
  try {
    await env.LB.prepare(
      `INSERT INTO daily_metrics (metric_date, category, test_id, completions, score_sum, score_count, duration_sum, valid, invalid)
       VALUES (?,?,?,1,?,1,?,?,?)
       ON CONFLICT(metric_date, category, test_id) DO UPDATE SET
         completions = completions + 1, score_sum = score_sum + ?, score_count = score_count + 1,
         duration_sum = duration_sum + ?, valid = valid + ?, invalid = invalid + ?`
    ).bind(createdDay, claim.cat, claim.tid || "", raw, durationS,
      integrity === "valid" ? 1 : 0, integrity === "valid" ? 0 : 1,
      raw, durationS, integrity === "valid" ? 1 : 0, integrity === "valid" ? 0 : 1).run();
  } catch (_) { /* best-effort */ }

  // rank among valid entries of the same category this week
  let rank = null;
  if (integrity === "valid") {
    const r = await env.LB.prepare(
      `SELECT COUNT(*) AS c FROM leaderboard_entries
       WHERE category = ? AND period_key = ? AND integrity_status = 'valid'
         AND normalized_score > ?`
    ).bind(claim.cat, periodKey, normalized).first();
    rank = (r?.c ?? 0) + 1;
  }

  return json({
    id, alias, category: claim.cat, difficulty: claim.diff,
    raw_percentage: raw, rank, period: "week",
    deletion_token: deletionToken,   // browser must store this; we keep only the hash
    integrity_status: integrity,
  }, 200, ch);
}

// ── GET /api/lb?category=&period=&limit= ──
async function handleList(request, env, url, ch) {
  const category = (url.searchParams.get("category") || "").toLowerCase();
  const period = (url.searchParams.get("period") || "week").toLowerCase();
  const limit = Math.min(CFG.perPageMax, Math.max(1, parseInt(url.searchParams.get("limit") || "25", 10)));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

  const where = ["integrity_status = 'valid'"];
  const bind = [];
  if (CATS.has(category)) { where.push("category = ?"); bind.push(category); }
  if (period === "week") { where.push("created_day >= ?"); bind.push(mondayUTC(Date.now())); }
  else if (period === "month") { where.push("created_day >= ?"); bind.push(new Date().toISOString().slice(0, 7) + "-01"); }
  // period === "all" → no date filter
  const w = "WHERE " + where.join(" AND ");

  // k-anonymity: suppress a sparse board entirely
  const cnt = await env.LB.prepare(`SELECT COUNT(*) AS c FROM leaderboard_entries ${w}`).bind(...bind).first();
  if ((cnt?.c ?? 0) < CFG.suppressBelow) {
    return json({ suppressed: true, min: CFG.suppressBelow, entries: [] }, 200, ch);
  }

  const rows = await env.LB.prepare(
    `SELECT public_alias, category, difficulty, raw_percentage, normalized_score
     FROM leaderboard_entries ${w}
     ORDER BY normalized_score DESC, raw_percentage DESC
     LIMIT ? OFFSET ?`
  ).bind(...bind, limit, offset).all();

  const entries = (rows.results || []).map((r, i) => ({
    rank: offset + i + 1,
    alias: r.public_alias,
    category: r.category,
    difficulty: r.difficulty,
    percentage: r.raw_percentage,   // raw % shown prominently; normalized is ranking-only
  }));
  return json({ suppressed: false, total: cnt.c, entries }, 200, ch);
}

// ── GET /api/lb/stats  — bucketed, non-identifying ──
async function handleStats(env, ch) {
  const since = mondayUTC(Date.now());
  const q = await env.LB.prepare(
    `SELECT category,
            SUM(starts) AS starts, SUM(completions) AS completions,
            SUM(score_sum) AS score_sum, SUM(score_count) AS score_count
     FROM daily_metrics WHERE metric_date >= ? GROUP BY category`
  ).bind(since).all();
  const out = { period: "week", sql: null, python: null };
  for (const r of (q.results || [])) {
    out[r.category] = {
      started: r.starts || 0,
      completed: r.completions || 0,
      completion_rate: r.starts ? Math.round((r.completions / r.starts) * 100) : null,
      avg_score: r.score_count ? Math.round(r.score_sum / r.score_count) : null,
    };
  }
  return json(out, 200, ch);
}

// ── DELETE /api/lb/entry  — by browser-held deletion token ──
async function handleDelete(request, env, ch) {
  let d; try { d = await request.json(); } catch { return json({ error: "bad json" }, 400, ch); }
  if (!d.id || !d.deletion_token) return json({ error: "id and deletion_token required" }, 400, ch);
  const hash = await sha256Hex(String(d.deletion_token));
  const res = await env.LB.prepare(
    `DELETE FROM leaderboard_entries WHERE id = ? AND deletion_token_hash = ?`
  ).bind(String(d.id), hash).run();
  const deleted = (res.meta && res.meta.changes) || 0;
  if (!deleted) return json({ error: "not found or wrong token" }, 404, ch);
  return json({ deleted: true }, 200, ch);
}

// ── POST /api/lb/report  — flag for review ──
async function handleReport(request, env, ch) {
  let d; try { d = await request.json(); } catch { return json({ error: "bad json" }, 400, ch); }
  if (!d.id) return json({ error: "id required" }, 400, ch);
  await env.LB.prepare(
    `UPDATE leaderboard_entries SET integrity_status = 'under_review'
     WHERE id = ? AND integrity_status = 'valid'`
  ).bind(String(d.id)).run();
  return json({ ok: true }, 200, ch);
}

// ── dispatcher (returns a Response, or null to let worker.js fall through) ──
export async function routeLeaderboard(request, env, url, ch) {
  const p = url.pathname;
  const m = request.method;
  if (!p.startsWith("/api/lb")) return null;
  if (!env.LB || !env.LB_SIGNING_KEY) return json({ error: "leaderboard not configured" }, 503, ch);
  if (p === "/api/lb/token" && m === "POST") return handleToken(request, env, ch);
  if (p === "/api/lb/submit" && m === "POST") return handleSubmit(request, env, ch);
  if (p === "/api/lb" && m === "GET") return handleList(request, env, url, ch);
  if (p === "/api/lb/stats" && m === "GET") return handleStats(env, ch);
  if (p === "/api/lb/entry" && m === "DELETE") return handleDelete(request, env, ch);
  if (p === "/api/lb/report" && m === "POST") return handleReport(request, env, ch);
  return json({ error: "not found" }, 404, ch);
}

// exported for unit tests
export const _test = { makeAlias, normalize, signToken, verifyToken, sha256Hex, mondayUTC, CFG };
