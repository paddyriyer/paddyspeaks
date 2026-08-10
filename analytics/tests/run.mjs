/**
 * PaddySpeaks Analytics — Phase 1 test suite (dependency-free).
 * Run: node analytics/tests/run.mjs
 * Mirrors the repo convention (cf. interview.app/tests/*.mjs).
 */
import { median, percentile, sessionize, isEngaged, newVsReturning, engagementSummary, retention } from '../lib/metrics.js';
import { canonicalPath, normalizeReferrer, sourceOf, botScore, contentGroup, domainOf } from '../lib/classify.js';
import { generateInsights, classifyContent, classifySources } from '../lib/insights.js';
import {
  cleanText, escapeHtml, isEmail, isOptionalUrl, textLen, validateContact,
  validateTestimonial, deriveDisplayName, toPublicTestimonial,
  CONTACT_REASONS, RELATIONSHIPS, DISPLAY_PREFS, LIMITS,
} from '../lib/forms.js';
import { redactEmails } from '../worker/forms-util.js';
import { isFetchable, linksOf } from '../worker/scan.js';

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

/* ── insight engine: fires above floor, silent below (no fabricated insights) ── */
const bigStudio = generateInsights({
  current: { sessions: 400, engagementRate: 0.5 },
  previous: { sessions: 300, engagementRate: 0.5, studioVisitors: 100 },
  studio: { visitors: 140, completionRate: 0.19, prevCompletionRate: 0.34, abandonStep: 'before the first answer on mobile' },
});
ok(bigStudio.some(i => i.id === 'studio_completion_drop' && i.priority === 'high'), 'studio completion-drop insight fires (high)');
ok(bigStudio.every(i => i.confidence), 'every emitted insight has a confidence');
ok(bigStudio.length <= 5, 'at most 5 insights');

const tiny = generateInsights({
  current: { sessions: 12, engagementRate: 0.2 },
  previous: { sessions: 4, engagementRate: 0.6 },
  studio: { visitors: 5, completionRate: 0.1, prevCompletionRate: 0.5 },
});
eq(tiny.length, 0, 'below small-sample floor → NO insights (never fabricate)');

const dqInsight = generateInsights({ current: {}, previous: {}, dataQuality: { durationCoverage: 0.3 } });
ok(dqInsight.some(i => i.id === 'dq_duration_coverage'), 'low duration coverage raises a trust flag');

// anomaly detection: a spike day well outside the norm
const anom = generateInsights({ current: {}, previous: {},
  dailySeries: [10,12,11,9,13,10,12,11,10,12,11,13,10,55].map(s => ({ sessions: s })) });
ok(anom.some(i => i.id === 'anomaly_daily' && i.priority === 'high'), 'daily spike flagged as anomaly');
const noAnom = generateInsights({ current: {}, previous: {},
  dailySeries: [10,12,11,9,13,10,12,11].map(s => ({ sessions: s })) });
eq(noAnom.filter(i => i.id === 'anomaly_daily').length, 0, 'steady series → no anomaly');

/* ── content 2×2 ── */
const cc = classifyContent([
  { path: '/a', readers: 100, engagementRate: 0.8 }, // winner
  { path: '/b', readers: 5, engagementRate: 0.9 },   // hidden gem
  { path: '/c', readers: 120, engagementRate: 0.1 }, // click magnet
  { path: '/d', readers: 4, engagementRate: 0.1 },   // needs attention
]);
eq(cc.find(c => c.path === '/a').class, 'winner', 'winner classified');
eq(cc.find(c => c.path === '/b').class, 'hidden_gem', 'hidden gem classified');
eq(cc.find(c => c.path === '/c').class, 'click_magnet', 'click magnet classified');
eq(cc.find(c => c.path === '/d').class, 'needs_attention', 'needs attention classified');

/* ── source value classes ── */
const sc = classifySources([
  { source: 'linkedin', visitors: 500, engagementRate: 0.2 },
  { source: 'ai_assistant', visitors: 40, engagementRate: 0.9 },
  { source: 'direct', visitors: 100, engagementRate: 0.5 },
  { source: 'social', visitors: 60, engagementRate: 0.4 },
]);
eq(sc.find(s => s.source === 'linkedin').class, 'high_volume_low_value', 'high-volume/low-value source');
eq(sc.find(s => s.source === 'ai_assistant').class, 'low_volume_high_value', 'low-volume/high-value source');

/* ═══════════════════════════════════════════════════════════════════
   Contact + Testimonials — validation, sanitization, display preference
   ═══════════════════════════════════════════════════════════════════ */

/* ── email shape ── */
ok(isEmail('paddy@paddyspeaks.com'), 'valid email accepted');
ok(isEmail('a.b+tag@sub.domain.co.uk'), 'valid email with tag/subdomain accepted');
ok(!isEmail('bad@'), 'email missing domain rejected');
ok(!isEmail('no-at-sign.com'), 'email missing @ rejected');
ok(!isEmail('two@@at.com'), 'double @ rejected');
ok(!isEmail('a@b..com'), 'consecutive dots rejected');
ok(!isEmail('has space@x.com'), 'space in email rejected');
ok(!isEmail(''), 'empty email rejected');
ok(!isEmail('a@' + 'x'.repeat(250) + '.com'), 'oversized email rejected');

/* ── optional URL ── */
ok(isOptionalUrl(''), 'blank optional URL allowed');
ok(isOptionalUrl('https://linkedin.com/in/paddyiyer'), 'https URL allowed');
ok(isOptionalUrl('http://example.org/x'), 'http URL allowed');
ok(!isOptionalUrl('javascript:alert(1)'), 'javascript: URL rejected');
ok(!isOptionalUrl('ftp://x.com'), 'ftp URL rejected');
ok(!isOptionalUrl('notaurl'), 'bare string rejected as URL');

/* ── sanitization ── */
eq(cleanText('  hello  '), 'hello', 'cleanText trims');
eq(cleanText('a\x01b'), 'ab', 'cleanText strips control chars');
eq(cleanText('a\r\nb'), 'a\nb', 'cleanText normalizes CRLF');
eq(cleanText(null), '', 'cleanText handles null');
eq(cleanText(undefined), '', 'cleanText handles undefined');
eq(escapeHtml('<script>alert("x")</script>'),
  '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;', 'escapeHtml neutralizes script tags');
eq(escapeHtml("O'Brien & Co <b>"), 'O&#39;Brien &amp; Co &lt;b&gt;', 'escapeHtml escapes quotes/amp/lt');
eq(textLen('  abc  '), 3, 'textLen counts trimmed code points');
eq(textLen('😀😀'), 2, 'textLen counts astral chars as 1 each');

/* ── contact validation ── */
const goodContact = {
  name: 'Priya Nair', email: 'priya@example.com', reason: 'article_feedback',
  subject: 'Loved the Gita piece', message: 'This changed how I think about dharma at work. Thank you for writing it.',
};
ok(validateContact(goodContact).valid, 'valid contact passes');
ok(!validateContact({ ...goodContact, name: '' }).valid, 'contact requires name');
ok(!validateContact({ ...goodContact, email: 'nope' }).valid, 'contact requires valid email');
ok(!validateContact({ ...goodContact, reason: '' }).valid, 'contact requires reason');
ok(!validateContact({ ...goodContact, reason: 'not_a_real_reason' }).valid, 'contact rejects unknown reason (enum enforced)');
ok(!validateContact({ ...goodContact, subject: 'ab' }).valid, 'contact rejects too-short subject');
ok(!validateContact({ ...goodContact, subject: 'x'.repeat(161) }).valid, 'contact rejects oversized subject');
ok(!validateContact({ ...goodContact, message: 'too short' }).valid, 'contact rejects too-short message');
ok(!validateContact({ ...goodContact, message: 'x'.repeat(4001) }).valid, 'contact rejects oversized message');
eq(Object.keys(validateContact({}).errors).sort(),
  ['email', 'message', 'name', 'reason', 'subject'], 'empty contact reports every required field');
ok(validateContact({ ...goodContact, sendCopy: 'on' }).data.sendCopy === true, 'sendCopy checkbox "on" coerces to true');
ok(validateContact({ ...goodContact }).data.sendCopy === false, 'sendCopy absent coerces to false');
// injection attempt survives as inert text, never as markup
const injected = validateContact({ ...goodContact, name: '<img src=x onerror=alert(1)>' });
ok(injected.valid, 'HTML-looking name still validates (escaped at render time)');
ok(escapeHtml(injected.data.name).indexOf('<img') === -1, 'HTML in name is escaped, not executable');

/* ── testimonial validation ── */
const body70 = 'Interview Studio helped me land my first data engineering role after weeks of practice.';
const goodT = {
  name: 'Arjun Rao', email: 'arjun@example.com', relationship: 'studio_user',
  body: body70, displayPref: 'first_initial', consent: true,
};
ok(validateTestimonial(goodT).valid, 'valid testimonial passes');
ok(!validateTestimonial({ ...goodT, consent: false }).valid, 'testimonial requires consent');
ok(!validateTestimonial({ ...goodT, consent: undefined }).valid, 'missing consent rejected');
ok(!validateTestimonial({ ...goodT, body: 'way too short' }).valid, 'testimonial rejects body under 60 chars');
ok(validateTestimonial({ ...goodT, body: 'x'.repeat(60) }).valid, 'testimonial accepts exactly 60 chars');
ok(validateTestimonial({ ...goodT, body: 'x'.repeat(700) }).valid, 'testimonial accepts exactly 700 chars');
ok(!validateTestimonial({ ...goodT, body: 'x'.repeat(701) }).valid, 'testimonial rejects 701 chars');
ok(!validateTestimonial({ ...goodT, relationship: 'bogus' }).valid, 'testimonial rejects unknown relationship');
ok(!validateTestimonial({ ...goodT, displayPref: 'bogus' }).valid, 'testimonial rejects unknown display preference');
ok(!validateTestimonial({ ...goodT, displayPref: '' }).valid, 'testimonial requires display preference');
ok(!validateTestimonial({ ...goodT, verifyUrl: 'javascript:alert(1)' }).valid, 'testimonial rejects javascript: verify URL');
ok(validateTestimonial({ ...goodT, verifyUrl: '' }).valid, 'blank verify URL allowed');
ok(validateTestimonial({ ...goodT, role: '', organization: '' }).valid, 'role/organization are optional');
ok(!validateTestimonial({ ...goodT, role: 'x'.repeat(121) }).valid, 'oversized role rejected');

/* ── display preference (privacy contract) ── */
eq(deriveDisplayName('Priya Nair', 'full'), 'Priya Nair', 'full pref shows full name');
eq(deriveDisplayName('Priya Nair', 'first_initial'), 'Priya N.', 'first_initial pref abbreviates surname');
eq(deriveDisplayName('Priya Devi Nair', 'first_initial'), 'Priya N.', 'first_initial uses LAST surname');
eq(deriveDisplayName('Priya', 'first_initial'), 'Priya', 'single-word name has no initial to add');
eq(deriveDisplayName('Priya Nair', 'anonymous'), 'Anonymous', 'anonymous pref hides the name entirely');
eq(deriveDisplayName('', 'full'), 'Anonymous', 'empty name falls back to Anonymous');
eq(deriveDisplayName('Priya Nair', 'anonymous', 'Owner Override'), 'Owner Override', 'owner override wins');
eq(deriveDisplayName('Priya Nair', 'full', '   '), 'Priya Nair', 'blank override is ignored');

/* ── public shaping: email must NEVER leak, prefs respected ── */
const row = {
  id: 't1', full_name: 'Priya Nair', email: 'priya@example.com', role: 'Staff Engineer',
  organization: 'Acme', relationship: 'reader', body: 'Original text.', edited_body: null,
  verify_url: 'https://linkedin.com/in/x', display_pref: 'full', display_name: null,
  status: 'approved', featured: 1, created_at: '2026-07-20T10:00:00Z', ip_hash: 'abc',
};
const pubFull = toPublicTestimonial(row);
ok(!('email' in pubFull), 'public testimonial omits email');
ok(!('verify_url' in pubFull), 'public testimonial omits verify URL');
ok(!('ip_hash' in pubFull), 'public testimonial omits ip_hash');
ok(!('status' in pubFull), 'public testimonial omits status');
ok(JSON.stringify(pubFull).indexOf('priya@example.com') === -1, 'email absent from serialized public payload');
eq(pubFull.name, 'Priya Nair', 'full pref keeps name');
eq(pubFull.role, 'Staff Engineer', 'full pref keeps role');
eq(pubFull.organization, 'Acme', 'full pref keeps organization');
eq(pubFull.date, '2026-07-20', 'public date is day-precision only');

const pubAnon = toPublicTestimonial({ ...row, display_pref: 'anonymous' });
eq(pubAnon.name, 'Anonymous', 'anonymous pref hides name publicly');
eq(pubAnon.role, '', 'anonymous pref suppresses role');
eq(pubAnon.organization, '', 'anonymous pref suppresses organization');

const pubInitial = toPublicTestimonial({ ...row, display_pref: 'first_initial' });
eq(pubInitial.name, 'Priya N.', 'first_initial pref abbreviates publicly');
eq(pubInitial.role, '', 'first_initial pref suppresses role');
eq(pubInitial.organization, '', 'first_initial pref suppresses organization');

// light edit is published in preference to the original
eq(toPublicTestimonial({ ...row, edited_body: 'Lightly edited text.' }).body,
  'Lightly edited text.', 'edited_body wins over body when present');
eq(toPublicTestimonial({ ...row, edited_body: '   ' }).body,
  'Original text.', 'whitespace-only edited_body falls back to original');

/* ── enum surfaces are closed sets ── */
eq(CONTACT_REASONS.length, 7, 'seven contact reasons exactly as specified');
eq(RELATIONSHIPS.length, 6, 'six relationship options exactly as specified');
eq(DISPLAY_PREFS, ['full', 'first_initial', 'anonymous'], 'three display preferences');
eq(LIMITS.testimonial, { min: 60, max: 700 }, 'testimonial bounds are 60–700 as specified');

/* ── email-error redaction (no address may ever reach a log) ── */
ok(!/@/.test(redactEmails('You can only send to your own address (paddy@example.com)')),
  'redactEmails strips an address from a provider error');
eq(redactEmails('{"statusCode":401,"message":"API key is invalid"}'),
  '{"statusCode":401,"message":"API key is invalid"}', 'redactEmails leaves address-free text intact');
ok(!/@/.test(redactEmails('to: a@b.com, cc: c.d+tag@sub.example.co.uk')),
  'redactEmails strips multiple addresses including tagged/subdomain forms');
eq(redactEmails('Invalid `from` field'), 'Invalid `from` field', 'redactEmails preserves the diagnostic wording');
eq(redactEmails(null), '', 'redactEmails handles null');
ok(redactEmails('x@y.com').includes('[redacted-email]'), 'redactEmails substitutes a visible placeholder');

/* ── scan proxy: SSRF guard ── */

for (const bad of [
  'http://localhost/x', 'http://127.0.0.1/', 'http://10.1.2.3/', 'http://192.168.0.1/',
  'http://172.16.5.5/', 'http://169.254.169.254/latest/meta-data/', 'http://metadata.google.internal/',
  'http://[::1]/', 'http://[fd00::1]/', 'http://box.internal/', 'http://printer.local/',
  'file:///etc/passwd', 'gopher://x/', 'not a url', '',
]) {
  ok(!isFetchable(bad), `isFetchable rejects ${bad || '(empty)'}`);
}
for (const good of ['https://records-finder.test/p/x', 'http://example.com/opt-out']) {
  ok(isFetchable(good), `isFetchable allows ${good}`);
}

/* ── scan proxy: link extraction ── */

const HTML = `<html><body>
  <a href="/opt-out">Do Not Sell My <b>Personal</b> Information</a>
  <a href='https://elsewhere.test/dsar'>Privacy request</a>
  <a href=/privacy-policy>Privacy Policy</a>
  <a href="#top">Back to top</a>
  <a href="javascript:void(0)">Menu</a>
  <a href="tel:+15555550142">Call us</a>
  <a href="mailto:privacy@records-finder.test">Privacy team</a>
  <a href="/opt-out">Opt out</a>
  <a href="/x#frag">Fragment</a>
</body></html>`;
const links = linksOf(HTML, 'https://records-finder.test/p/someone');
const hrefs = links.map((l) => l.href);

ok(hrefs.includes('https://records-finder.test/opt-out'), 'linksOf resolves relative hrefs to absolute');
ok(hrefs.includes('https://elsewhere.test/dsar'), 'linksOf keeps off-site links');
ok(hrefs.includes('https://records-finder.test/privacy-policy'), 'linksOf reads unquoted href attributes');
ok(hrefs.includes('mailto:privacy@records-finder.test'), 'linksOf keeps mailto: — often the only removal route');
ok(!hrefs.some((h) => h.startsWith('#')), 'linksOf drops in-page anchors');
ok(!hrefs.some((h) => /javascript:/i.test(h)), 'linksOf drops javascript: hrefs');
ok(!hrefs.some((h) => /^tel:/i.test(h)), 'linksOf drops tel: links');
eq(hrefs.filter((h) => h.endsWith('/opt-out')).length, 1, 'linksOf deduplicates repeated hrefs');
ok(!hrefs.some((h) => h.includes('#frag')), 'linksOf strips fragments so one page is not listed twice');
eq(links.find((l) => l.href.endsWith('/opt-out')).text,
  'Do Not Sell My Personal Information', 'linksOf flattens nested markup in the link text');
eq(linksOf('<p>no links here</p>', 'https://x.test/').length, 0, 'linksOf handles a page with no links');

/* ── report ── */
console.log(fails.join('\n'));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
