// ════════════════════════════════════════════════════════════
// Anonymous Leaderboard — browser client
// Talks to the Cloudflare Worker at ps.paddyspeaks.com/api/lb/*.
// Deletion tokens are stored ONLY here (localStorage) — never sent anywhere
// except to authorise deleting your own entry.
// ════════════════════════════════════════════════════════════

const LB_BASE = "https://ps.paddyspeaks.com";
const LS_ENTRIES = "ps-lb-entries"; // your own submissions + their private deletion tokens

async function jpost(path, body) {
  const r = await fetch(`${LB_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || `HTTP ${r.status}`); e.status = r.status; throw e; }
  return data;
}

// Call at test START — returns a signed attempt token to hold until submit.
export async function lbStart({ category, difficulty, test_id }) {
  const { token } = await jpost("/api/lb/token", { category, difficulty, test_id });
  return token;
}

// Call at test COMPLETE, only if the user opted in.
export async function lbSubmit({ token, raw_percentage, first_attempt }) {
  const data = await jpost("/api/lb/submit", {
    token, raw_percentage, first_attempt: !!first_attempt, consent: true,
  });
  saveEntry({
    id: data.id, deletion_token: data.deletion_token,
    alias: data.alias, category: data.category, difficulty: data.difficulty,
    raw: data.raw_percentage, rank: data.rank,
  });
  return data;
}

export async function lbList({ category, period = "week", limit = 25, offset = 0 } = {}) {
  const u = new URL(`${LB_BASE}/api/lb`);
  if (category) u.searchParams.set("category", category);
  u.searchParams.set("period", period);
  u.searchParams.set("limit", limit);
  u.searchParams.set("offset", offset);
  const r = await fetch(u);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function lbStats() {
  const r = await fetch(`${LB_BASE}/api/lb/stats`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export function myEntries() {
  try { return JSON.parse(localStorage.getItem(LS_ENTRIES) || "[]"); } catch { return []; }
}
function saveEntry(e) {
  const a = myEntries();
  a.push({ ...e, ts: Date.now() });
  try { localStorage.setItem(LS_ENTRIES, JSON.stringify(a.slice(-50))); } catch (_) {}
}
export async function lbDelete(id) {
  const e = myEntries().find((x) => x.id === id);
  if (!e) throw new Error("No deletion token for that entry on this device.");
  const r = await fetch(`${LB_BASE}/api/lb/entry`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, deletion_token: e.deletion_token }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  try { localStorage.setItem(LS_ENTRIES, JSON.stringify(myEntries().filter((x) => x.id !== id))); } catch (_) {}
  return true;
}
export async function lbReport(id) {
  try { await jpost("/api/lb/report", { id }); return true; } catch { return false; }
}
