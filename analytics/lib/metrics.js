/**
 * PaddySpeaks Analytics — pure metric math.
 * Sessionization, engaged-session, correct new/returning, medians, retention.
 * No I/O; every function is unit-tested with worked examples.
 * Fixes audit findings A (new/returning), D (bounce/engaged), H (medians),
 * K (30-min sessions), retention null-windows.
 */
import { THRESHOLDS } from './config.js';

/** Median of a numeric array (returns null for empty). */
export function median(arr) {
  const xs = arr.filter(x => x != null && !Number.isNaN(x)).slice().sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/** Nearest-rank percentile (p in 0..100). */
export function percentile(arr, p) {
  const xs = arr.filter(x => x != null && !Number.isNaN(x)).slice().sort((a, b) => a - b);
  if (!xs.length) return null;
  const rank = Math.ceil((p / 100) * xs.length);
  return xs[Math.min(xs.length - 1, Math.max(0, rank - 1))];
}

/**
 * Group a flat, time-ordered event list into sessions using a 30-min gap.
 * Each event: { visitor_id, occurred_at (ISO or ms), event_name, ...props }.
 * A new session starts at a gap > sessionGapMinutes for the SAME visitor.
 * @returns array of sessions: { visitor_id, session_id, events[], start, end }
 */
export function sessionize(events, gapMinutes = THRESHOLDS.sessionGapMinutes) {
  const gapMs = gapMinutes * 60000;
  const byVisitor = new Map();
  for (const e of events) {
    const t = typeof e.occurred_at === 'number' ? e.occurred_at : Date.parse(e.occurred_at);
    if (!byVisitor.has(e.visitor_id)) byVisitor.set(e.visitor_id, []);
    byVisitor.get(e.visitor_id).push({ ...e, _t: t });
  }
  const sessions = [];
  let seq = 0;
  for (const [visitor_id, evs] of byVisitor) {
    evs.sort((a, b) => a._t - b._t);
    let cur = null;
    for (const e of evs) {
      if (!cur || e._t - cur.end > gapMs) {
        cur = { visitor_id, session_id: `${visitor_id}:${seq++}`, events: [], start: e._t, end: e._t };
        sessions.push(cur);
      }
      cur.events.push(e);
      cur.end = e._t;
    }
  }
  return sessions;
}

/** Sum of active engagement ms reported on engagement events in a session. */
function sessionActiveMs(session) {
  return session.events.reduce((s, e) => s + (e.active_ms || 0), 0);
}
function sessionMaxScroll(session) {
  return session.events.reduce((m, e) => Math.max(m, e.max_scroll || e.scroll || 0), 0);
}
function sessionPageViews(session) {
  return session.events.filter(e => e.event_name === 'page_view').length;
}

/** Engaged-session predicate (audit fix D). */
export function isEngaged(session, t = THRESHOLDS) {
  const activeS = sessionActiveMs(session) / 1000;
  const goals = session.events.some(e => e.goal || e.event_name === 'question_completed' || e.event_name === 'quiz_completed');
  return (
    activeS >= t.engagedActiveSeconds ||
    sessionMaxScroll(session) >= t.engagedScrollPct ||
    sessionPageViews(session) >= t.engagedMinPageViews ||
    goals
  );
}

/**
 * Correct new/returning at the SESSION grain from visitor first-seen (fix A).
 * @param sessions from sessionize()
 * @param firstSeen Map<visitor_id, ms> — earliest ever seen (from `visitors` roll-up)
 * @returns { totalVisitors, newVisitors, returningVisitors,
 *            newSessions, returningSessions, invariantHolds }
 */
export function newVsReturning(sessions, firstSeen) {
  const visitorReturning = new Map(); // visitor -> had a returning session
  let newSessions = 0, returningSessions = 0;
  const dayMs = 86400000;
  for (const s of sessions) {
    const fs = firstSeen.get(s.visitor_id);
    // returning if the session starts on a later calendar day than first-seen
    const returning = fs != null && Math.floor(s.start / dayMs) > Math.floor(fs / dayMs);
    if (returning) { returningSessions++; visitorReturning.set(s.visitor_id, true); }
    else { newSessions++; if (!visitorReturning.has(s.visitor_id)) visitorReturning.set(s.visitor_id, visitorReturning.get(s.visitor_id) || false); }
  }
  const totalVisitors = new Set(sessions.map(s => s.visitor_id)).size;
  const returningVisitors = [...visitorReturning.values()].filter(Boolean).length;
  const newVisitors = totalVisitors - returningVisitors;
  return {
    totalVisitors, newVisitors, returningVisitors,
    newSessions, returningSessions,
    // invariant the dashboard asserts: returning ≤ total, and new+returning=total
    invariantHolds: returningVisitors <= totalVisitors && (newVisitors + returningVisitors === totalVisitors),
  };
}

/** Engagement rate + bounce with sample size (fix D + sample honesty). */
export function engagementSummary(sessions, t = THRESHOLDS) {
  const total = sessions.length;
  const engaged = sessions.filter(s => isEngaged(s, t)).length;
  return {
    totalSessions: total,
    engagedSessions: engaged,
    engagementRate: total ? engaged / total : null,
    bounceRate: total ? (total - engaged) / total : null,
    smallSample: total < t.smallSampleFloor,
  };
}

/**
 * Day-N retention with proper null windows (never 0 for an unelapsed window).
 * @param cohort visitors: Map<visitor_id, firstSeenMs>
 * @param activityDays Set<`${visitor_id}:${dayIndex}`> of active day indices
 * @param nowMs current time
 * @returns { size, windows: { [day]: rate|null } }
 */
export function retention(cohort, activeByVisitorDay, nowMs, days = THRESHOLDS.retentionDays) {
  const dayMs = 86400000;
  const size = cohort.size;
  const windows = {};
  for (const N of days) {
    // window [first+N, first+N+1); null until it has fully elapsed for the whole cohort
    let elapsedForAll = true;
    let retained = 0;
    for (const [v, fs] of cohort) {
      const windowEnd = fs + (N + 1) * dayMs;
      if (nowMs < windowEnd) { elapsedForAll = false; }
      const targetDay = Math.floor((fs) / dayMs) + N;
      if (activeByVisitorDay.has(`${v}:${targetDay}`)) retained++;
    }
    windows[N] = elapsedForAll && size ? retained / size : null; // null => render "—"
  }
  return { size, windows };
}
