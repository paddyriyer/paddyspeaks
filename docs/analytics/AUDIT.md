# PaddySpeaks Analytics — Audit Findings

_Audit date: 2026-07-24. Scope: the self-hosted analytics pipeline
(`lib/ps.js` tracker → Cloudflare Worker `analytics/worker/worker.js` → D1
`page_views`) and the dashboard (`analytics/index.html`). This document is
descriptive only — no runtime behaviour was changed while producing it._

## 1. Technology inventory

| Layer | Technology | File(s) |
|---|---|---|
| Tracker (client) | Hand-rolled vanilla JS beacon, cookie-free | `lib/ps.js` (v3, **live**, on 249 pages) |
| Stale tracker | Old ~1KB beacon, **not referenced by any page** | `analytics/tracker.js` (dead code — safe to delete) |
| Ingest + API | Cloudflare Worker (ES module), edge-cached 60s | `analytics/worker/worker.js` |
| Database | Cloudflare **D1** (SQLite) `paddyspeaks-analytics`, single `page_views` table + `excluded_visitors` | `schema.sql` + `migrate-v2..v5` |
| Dashboard | Single-page HTML, **Chart.js** (doughnuts + line), Bearer-token auth | `analytics/index.html` |
| Leaderboard (separate) | Cloudflare Worker + **separate** D1 `paddyspeaks-leaderboard` | `analytics/worker/leaderboard.js` |

Two endpoints accept collection: `/collect` (legacy) and `/api/v` (current).
The live tracker posts to `https://ps.paddyspeaks.com/api/v`.

## 2. Current metric definitions (as implemented)

| Term | How it is actually computed today | File:line |
|---|---|---|
| Page view | One row inserted in `page_views` per page load | `worker.js:101` |
| Visitor (dashboard "unique visitors") | `COUNT(DISTINCT session_id)` — this is **sessions**, not people | `worker.js:191` |
| "unique_people" | `COUNT(DISTINCT visitor_id)` — computed but **not surfaced** on the dashboard | `worker.js:191` |
| Session | `session_id` = `crypto.randomUUID()` in **sessionStorage**; new tab ⇒ new session; no inactivity timeout | `ps.js:15-23` |
| New vs returning | `is_new` set **per page view** from `localStorage._ps_vid` presence; overview sums `is_new=1` / `is_new=0` **page views** and labels them "new/returning visitors" | `ps.js:30-39`, `worker.js:191` |
| Bounce | Session with exactly one `page_views` row, regardless of time/scroll | `worker.js:215` |
| Engaged session | **Does not exist** | — |
| Time on page | Wall-clock `Date.now()-startTime` at first `visibilitychange:hidden` | `ps.js:128-146` |
| Scroll depth | Max scroll % reached, sent with the exit beacon | `ps.js:107-125` |

## 3. Confirmed defects (ranked)

### 🔴 A. "Returning visitors" is a page-view count, mislabeled as people
`new_visitors`/`returning_visitors` sum `is_new` across **page views**
(`worker.js:191`) but are rendered beside `unique_visitors` (sessions) as if
they were visitor counts (`index.html:779-780`). Because `is_new` is stamped
per view, a single returning person browsing 8 pages adds 8 to
"returning visitors." **Result: returning can exceed total unique visitors** —
the exact impossibility the brief calls out. _Fix: derive new/returning at the
session grain from first-seen visitor timestamps._

### 🔴 B. Exit beacon UPDATE is likely a no-op on D1 → missing time & scroll
The exit handler runs `UPDATE page_views SET duration=?, scroll_depth=? WHERE
session_id=? AND page=? ORDER BY id DESC LIMIT 1` (`worker.js:86-95`).
**SQLite/D1 does not support `ORDER BY`/`LIMIT` on `UPDATE`** unless compiled
with `SQLITE_ENABLE_UPDATE_DELETE_LIMIT` (D1 is not). The statement throws and
the `.catch()` swallows it. This is the leading explanation for **"time and
scroll missing for some visits."** Even where it parses, matching on
`session_id + page` with no view id means re-visiting the same path in one
session updates the **wrong** row. _Fix: send the page-view `id` (or a
client event id) to the client and update by primary key; or move engagement
to its own event keyed by `event_id`._

### 🔴 C. No engagement/active-time model; duration counts idle time
`duration` is wall-clock from load to the **first** tab-hide. If the visitor
switches away and back, the next hide overwrites with a larger span that
**includes background time** (`ps.js:130-146`). There is no visibility/focus
pause, so "time on page" overstates real attention. Mobile tab-close and
bfcache often fire **no** `visibilitychange:hidden` at all → no exit beacon →
null duration/scroll (compounds finding B). _Fix: accumulate active time only
while visible+focused; flush on `pagehide` and `visibilitychange` via
`sendBeacon`._

### 🟠 D. Bounce ignores engaged single-page reads
Any one-page session is a bounce (`worker.js:215`), so a 6-minute, 90%-scroll
read of a long article counts identically to an instant back-button. This
punishes exactly the long-form content the site is built on. _Fix: introduce
**engaged session** (≥ N active seconds OR ≥ S scroll OR ≥ 2 pages OR a goal)
and report **engagement rate = 1 − bounce**, with engaged single-page sessions
excluded from bounce._

### 🟠 E. Referrer rows fragment; full URL stored (privacy + dedup)
`referrer` stores the **full** `document.referrer` URL (`ps.js:80`,
`worker.js:107`) and the dashboard groups by the exact string
(`worker.js:199`). The same source appears as many rows (query strings, UTM
echoes, deep paths), and full URLs can carry PII in query params. _Fix: split
into `referrer_domain` + normalized `referrer_path` (query stripped, allow-list
kept); aggregate by domain with drill-down to path._

### 🟠 F. Bot filtering is user-agent-only
Collection drops UAs matching a small regex and also unfilters social unfurlers
(`worker.js:79`). `asn`/`as_org` are captured but **never used** for
classification. No datacenter/headless/behavioral signals; nothing is stored as
"suspected bot" for review — matches are dropped silently, so raw records
cannot be audited. _Fix: multi-signal bot score (crawler UA, datacenter ASN,
headless hints, impossibly fast navigation, zero interaction); **flag, don't
delete**; expose a diagnostic view._

### 🟠 G. Do Not Track is not honored
The **old** tracker checked `navigator.doNotTrack` (`analytics/tracker.js:14`);
the **live** `lib/ps.js` does **not**. The brief explicitly requires respecting
DNT. _Fix: early-return on DNT/GPC in `ps.js`._

### 🟡 H. Means distorted by outliers; no medians/percentiles
`avg_duration`/`avg_scroll` use `AVG` (`worker.js:191`), capped at 3600s/100%.
A handful of long sessions skews the headline. _Fix: report **median** and p75;
keep mean only as a secondary._

### 🟡 I. Path normalization gaps → duplicate content rows
`page` is raw `location.pathname`. `/x`, `/x/`, `/x/index.html` are distinct
rows; the content-group `CASE` (`worker.js:213`) has an operator-precedence bug
(`AND … OR …` without parentheses) that mis-buckets philosophy vs technology
articles. _Fix: canonicalize path (strip trailing slash + `index.html`, lower-
case) at ingest; store `content_group` explicitly; rewrite grouping in code._

### 🟡 J. One-point line chart
The daily line chart renders even for a single day (`1d` period), drawing a
"trend" from one point (`index.html:849`). _Fix: fall back to a KPI/table when
`< 2` time points._

### 🟡 K. Session model has no timeout
A tab left open for days remains one `session_id`; a returning visit in a new
tab is always a "new session." No 30-minute inactivity boundary. _Fix: standard
30-min inactivity sessionization (client heartbeat + server-side derivation)._

### ⚪ L. Interview Studio has **zero** product instrumentation
Only page views are collected. **None** of `interview_studio_opened`,
`answer_submitted`, `quiz_completed`, etc. exist anywhere in the codebase
(verified: no custom event emitter in `lib/` or `interview.app/js`). Every
Interview Studio funnel/retention ask in the brief needs the event layer built
from scratch (Phase 3). This is the single largest gap.

### ⚪ M. Minor / notes
- `analytics/tracker.js` is dead code that contradicts the live tracker — delete to avoid confusion.
- Admin auth is an **unsalted client-side SHA-256** used directly as the bearer (`index.html:579`, `worker.js:382`); the hash is password-equivalent. Acceptable for a personal dashboard but worth a note.
- No full IP is stored (geo comes from Cloudflare `request.cf`) — **good**, keep it that way.
- `duration`/`scroll` capped server-side (`worker.js:91-92`) — keep as sane bounds.

## 4. What is working and MUST be preserved
- Cookie-free, first-party, no full-IP storage — the privacy posture is sound.
- Rich dimensions already captured (geo, ASN/org, device, UTM, viewport, load time, 404, search query, page number).
- Date filters, drill-down filters, CSV export, "Exclude Me", realtime — all functional; keep the endpoints and historical `page_views` rows intact.
- The separate leaderboard pipeline is unrelated — **do not touch** it.

## 5. Correction summary (maps to `METRIC-DICTIONARY.md`)
| Defect | Correction | Phase |
|---|---|---|
| A new/returning | Session-grain, first-seen based | 1 |
| B exit UPDATE | Update by id / event-keyed | 1 |
| C active time | Visibility/focus accumulator + pagehide beacon | 1 |
| D bounce | Engaged-session definition; engagement rate | 1–2 |
| E referrer | domain + normalized path | 1 |
| F bots | Multi-signal score, flag-not-delete | 1 |
| G DNT | Honor DNT/GPC | 1 |
| H means | Median/percentiles | 2 |
| I paths | Canonicalize + explicit content_group | 1 |
| J 1-point chart | KPI fallback | 2 |
| K sessions | 30-min inactivity model | 1 |
| L IS events | Build event layer + funnels | 3 |
