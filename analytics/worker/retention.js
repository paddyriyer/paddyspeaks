/**
 * PaddySpeaks Worker — scheduled retention (P0.6 / P0.7).
 *
 * Runs from the cron trigger in wrangler.toml. It enforces retention promises
 * the schemas already made but nothing carried out:
 *
 *   leaderboard_entries  expires_at was written (+12 months) and never acted on
 *   used_nonces          replay guard; a token lives 3 hours, so a nonce older
 *                        than a day can never be replayed and need not be kept
 *   rate_limits          expired windows (was only pruned when a form was sent)
 *
 * Analytics tables are deliberately NOT touched: how long page-view history is
 * kept is an owner decision recorded in docs/PADDYSPEAKS-PLATFORM-BACKLOG.md,
 * not something to change silently in a cron job.
 *
 * Every statement is independent and best-effort; one failing never stops the
 * others, and the result is returned so a test (or a log) can see what ran.
 */
export const NONCE_KEEP_HOURS = 24;

export async function runRetention(env, now = new Date()) {
  const iso = now.toISOString();
  const nonceCutoff = new Date(now.getTime() - NONCE_KEEP_HOURS * 3600e3).toISOString();
  const jobs = [];
  if (env.LB) {
    jobs.push(['leaderboard_entries', env.LB, 'DELETE FROM leaderboard_entries WHERE expires_at < ?', [iso]]);
    jobs.push(['used_nonces', env.LB, 'DELETE FROM used_nonces WHERE used_at < ?', [nonceCutoff]]);
  }
  if (env.FORMS) {
    jobs.push(['rate_limits', env.FORMS, 'DELETE FROM rate_limits WHERE expires_at < ?', [iso]]);
  }
  const result = {};
  for (const [name, db, sql, args] of jobs) {
    try {
      const r = await db.prepare(sql).bind(...args).run();
      result[name] = (r && r.meta && typeof r.meta.changes === 'number') ? r.meta.changes : 'ok';
    } catch (e) {
      result[name] = 'error: ' + (e && e.message);
    }
  }
  return result;
}
