/**
 * PaddySpeaks Analytics — Phase 1 test suite (dependency-free).
 * Run: node analytics/tests/run.mjs
 * Mirrors the repo convention (cf. interview.app/tests/*.mjs).
 */
import { median, percentile, sessionize, isEngaged, newVsReturning, engagementSummary, retention } from '../lib/metrics.js';
import { canonicalPath, normalizeReferrer, sourceOf, botScore, contentGroup, domainOf } from '../lib/classify.js';

let pass = 0, fail = 0;
const fails = [];
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; } else { fail++; fails.push(`✗ ${msg}\n    expected ${e}\n    got      ${a}`); }
}
function ok(cond, msg) { if (cond) pass++; else { fail++; fails.push(`✗ ${msg}`); } }

const D = 86400000, M = 60000;
const day0 = Date.parse('2026-07-01T09:00:00Z');

/* ── median / percentile ── */
eq(median([1, 2, 3, 4]), 2.5, 'median even');
eq(median([1, 2, 3]), 2, 'median odd');
eq(median([]), null, 'median empty → null');
eq(percentile([1,2,3,4,5,6,7,8,9,10], 75), 8, 'p75 nearest-rank');
eq(percentile([], 50), null, 'percentile empty → null');

/* ── sessionize: 30-min gap splits ── */
const evs = [
  { visitor_id: 'A', occurred_at: day0, event_name: 'page_view' },
  { visitor_id: 'A', occurred_at: day0 + 10 * M, event_name: 'page_view' },
  { visitor_id: 'A', occurred_at: day0 + 50 * M, event_name: 'page_view' }, // gap 40m > 30 → new session
  { visitor_id: 'B', occurred_at: day0, event_name: 'page_view' },
];
const sessions = sessionize(evs);
eq(sessions.filter(s => s.visitor_id === 'A').length, 2, 'A splits into 2 sessions at 40-min gap');
eq(sessions.filter(s => s.visitor_id === 'B').length, 1, 'B has 1 session');

/* ── engaged session (fix D) ── */
ok(isEngaged({ events: [{ event_name: 'page_view', active_ms: 95000 }] }), 'single long read is engaged (90s)');
ok(!isEngaged({ events: [{ event_name: 'page_view', active_ms: 4000, max_scroll: 10 }] }), 'quick bounce is not engaged');
ok(isEngaged({ events: [{ event_name: 'page_view', max_scroll: 80 }] }), 'deep scroll is engaged');
ok(isEngaged({ events: [{ event_name: 'page_view' }, { event_name: 'page_view' }] }), '2 page views is engaged');
ok(isEngaged({ events: [{ event_name: 'quiz_completed' }] }), 'goal makes session engaged');

/* ── new vs returning at session grain (fix A: returning ≤ total) ── */
const firstSeen = new Map([['A', day0], ['B', day0]]);
const nvrEvents = [
  { visitor_id: 'A', occurred_at: day0, event_name: 'page_view' },              // new
  { visitor_id: 'A', occurred_at: day0 + 2 * D, event_name: 'page_view' },      // returning (later day)
  { visitor_id: 'A', occurred_at: day0 + 2 * D + 5 * M, event_name: 'page_view' },
  { visitor_id: 'B', occurred_at: day0, event_name: 'page_view' },              // new only
];
const nvr = newVsReturning(sessionize(nvrEvents), firstSeen);
eq(nvr.totalVisitors, 2, 'nvr total visitors');
eq(nvr.returningVisitors, 1, 'nvr returning visitors (only A returned)');
eq(nvr.newVisitors, 1, 'nvr new visitors');
ok(nvr.invariantHolds, 'INVARIANT: returning ≤ total and new+returning=total');
ok(nvr.returningVisitors <= nvr.totalVisitors, 'returning never exceeds total');

/* ── engagement summary + small-sample flag ── */
const es = engagementSummary(sessionize(nvrEvents));
ok(es.smallSample === true, 'small sample flagged below floor');
ok(es.engagementRate >= 0 && es.engagementRate <= 1, 'engagement rate in [0,1]');

/* ── retention: null until window elapses (never 0) ── */
const cohort = new Map([['A', day0], ['B', day0]]);
const active = new Set([`A:${Math.floor(day0 / D) + 1}`]); // A active on day1
const now = day0 + 5 * D;
const ret = retention(cohort, active, now, [1, 7, 30]);
eq(ret.windows[1], 0.5, 'Day1 retention = 1/2 (A returned, B did not)');
eq(ret.windows[7], null, 'Day7 window not elapsed → null (not 0)');
eq(ret.windows[30], null, 'Day30 window not elapsed → null (not 0)');

/* ── path canonicalization (fix I) ── */
eq(canonicalPath('/Foo/index.html'), '/foo', 'strip index.html + trailing slash + lower');
eq(canonicalPath('/a/b/'), '/a/b', 'strip trailing slash');
eq(canonicalPath('/'), '/', 'root stays root');
eq(canonicalPath('/x?utm=1#h'), '/x', 'strip query + hash');

/* ── referrer normalization (fix E: privacy, no query kept) ── */
eq(normalizeReferrer('https://www.google.com/search?q=secret+terms'), { domain: 'google.com', path: '/search' }, 'referrer drops query, keeps domain+path');
eq(domainOf('https://sub.linkedin.com/feed'), 'sub.linkedin.com', 'domainOf keeps subdomain, strips www');

/* ── source classification ── */
eq(sourceOf({ referrer: 'https://www.linkedin.com/feed/' }), 'linkedin', 'linkedin referral');
eq(sourceOf({ referrer: 'https://chatgpt.com/' }), 'ai_assistant', 'ChatGPT → ai_assistant');
eq(sourceOf({ referrer: 'https://www.google.com/search?q=x' }), 'organic_search', 'google search → organic');
eq(sourceOf({ referrer: 'https://t.co/abc' }), 'social', 't.co → social');
eq(sourceOf({ referrer: '', utm_source: '' }), 'direct', 'empty → direct');
eq(sourceOf({ referrer: 'https://ps.paddyspeaks.com/x' }), 'internal', 'own domain → internal');
eq(sourceOf({ referrer: 'https://someblog.example/post', utm_source: '' }), 'referral', 'other → referral');
eq(sourceOf({ referrer: '', utm_source: 'newsletter', utm_medium: 'email' }), 'email', 'utm email');

/* ── bot scoring (fix F: flag, don't drop) ── */
eq(botScore({ ua: 'Mozilla/5.0 (compatible; Googlebot/2.1)' }).class, 'bot', 'googlebot → bot');
ok(botScore({ ua: 'Mozilla/5.0 Chrome/120', asOrg: 'Amazon AWS', pageViews: 4, interactions: 0 }).class === 'suspected', 'datacenter+zero-interaction → suspected');
eq(botScore({ ua: 'Mozilla/5.0 (iPhone) Safari', interactions: 5, pageViews: 3 }).class, 'human', 'normal visitor → human');
ok(botScore({ ua: 'x', pageViews: 10, sessionSeconds: 3 }).reasons.includes('impossibly_fast'), 'impossibly fast flagged');

/* ── content grouping (fix I: replaces buggy CASE) ── */
eq(contentGroup('/'), 'homepage_navigation', 'root → homepage');
eq(contentGroup('/bhagavad-gita/chapter-1'), 'spirituality_sacred_texts', 'gita → sacred');
eq(contentGroup('/interview.app/evaluate/'), 'interview_prep', 'studio → interview_prep');
eq(contentGroup('/articles/the-new-language-of-data.html'), 'data_engineering', 'data article → data_engineering');

/* ── report ── */
console.log(fails.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
