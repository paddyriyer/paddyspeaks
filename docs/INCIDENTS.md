# Incidents — runbook and log

_Read this at the start of any session that touches production code, and
immediately when something looks wrong on the live site or in analytics. It is
the controlling document for production incidents on paddyspeaks.com. Prevention
lives in [`CHANGE-SAFETY.md`](CHANGE-SAFETY.md); this file covers what to do when
prevention fails, and what was learned each time._

## 1. Standing rules (apply to every session, human or Claude)

1. **Merging to `main` is deploying.** It deploys the site (GitHub Pages) and the
   analytics / forms / leaderboard Worker (`ps.paddyspeaks.com`, Cloudflare Workers
   Builds). There is no staging. Treat every merge as a release.
2. **Never bundle production-behaviour changes with content.** A change to
   `analytics/worker/`, `lib/ps.js`, security headers, CORS, hosting or anything
   that collects data goes in its own small PR, with its own verification.
3. **A green test is not proof.** Before trusting a test that asserts a platform
   rule (CORS, caching, cookies, browser APIs), check that it encodes the
   platform's actual behaviour, not our assumption about it.
4. **Verify in production after every merge that changes behaviour.** For the
   analytics Worker, the **Analytics Health** workflow must be green and the
   browser console must show no CORS errors from `ps.paddyspeaks.com`.
5. **When production is broken: revert first, diagnose second.** A revert of the
   offending PR on GitHub redeploys the previous version automatically.
6. **Every incident gets an entry in the log below and at least one new
   guardrail.** An incident is closed only when the guardrail is merged.
7. **Say plainly what happened, including who made the change.** Incidents caused
   by a Claude session are recorded as such. The point is to fix the system, not
   to assign blame, and that requires accurate records.

## 2. When something looks wrong

| Step | Do | Done when |
|---|---|---|
| **Detect** | Symptoms: dashboard drop, "JS tracking may be broken" warning, red Analytics Health, reader report, CI red on `main`. | You can state the symptom and when it started. |
| **Scope** | What is affected (site, analytics, forms, leaderboard, jobs)? Since when? Is data being lost right now? | One sentence: "X has been broken since T, losing Y." |
| **Find the change** | `git log origin/main --since=<start> -- <area>`; check what deployed near the start time. | A suspect commit/PR, or "not a deploy". |
| **Stop the bleeding** | Revert the suspect PR (GitHub → PR → Revert), or ship the smallest possible fix. Prefer revert when unsure. | Symptom gone in production, verified, not assumed. |
| **Verify** | Analytics Health green; browser console clean; dashboard realtime shows a fresh visit. | Evidence, not "should be fixed". |
| **Record** | Add a log entry (template below) the same day. | Entry merged. |
| **Prevent** | Add the guardrail that would have caught it (test, check, doc rule), and update `CHANGE-SAFETY.md` if the lesson is general. | Guardrail merged; follow-ups listed with owners. |

**Data recovery:** lost data cannot be re-collected. Estimate from surviving
sources where possible, label estimates as estimates, and never write them into
the primary tables. Example: `analytics/queries/estimate-gap-sessions.sql`.

## 3. Log entry template

```
### YYYY-MM-DD — <one-line title>
- Impact:        what broke, for whom, how much data lost
- Window:        start – end (UTC), how it was measured
- Detected by:   who/what, and how long after it started
- Cause:         the change (commit/PR, author incl. "Claude session <id>"), and the mechanism
- Why it wasn't caught: tests, review, monitoring gaps
- Fix:           PR(s), verification evidence
- Guardrails added: PR(s)
- Follow-ups:    open items, with owner
```

## 4. Log

### 2026-10-05 — Privacy Command Center: each click redrew twice as often as the last; pop-ups opened off the screen
- Impact:        Every view added in #917 and #918 (Products, Every layer, Sensors, Future, AI / agents, Reviews, Everyday arrows, Evidence) slowed down with use: the *n*th click on a control redrew the page 2^(n−1) times. Measured locally on Paddy's reported URL (`#sensors?…&sf=network`): 1, 2, 4 … 512 redraws per click, about 2 s per click by the tenth, and the tab soon froze. Separately, the *Views* menu opened off the left edge of the window whenever the header wrapped (every width below ~1150px; at 390px its left edge was −30px), and the *concerns* pop-up could push the page wider than the window (at 1100px the page became 1230px wide). No data was lost; the page is static.
- Window:        redraws from the #917 merge (2026-10-04 06:15 UTC) to this fix; the pop-up placement since v1 shipped (#893, 2026-09-30 20:41 UTC).
- Detected by:   Paddy, 2026-10-05 ("The pages are having serious performance issues"; then a screenshot of the Views menu off-screen: "Drop down lists fail pathetically"). About 40 hours after the redraw bug shipped. No test or monitor caught either.
- Cause:         Claude session (the one that wrote #917/#918). `app.js` rendered each mode into `#main` and then called `MP.mount(#main)`; the mode views in `modes.js` and `sensors.js` bound `root.addEventListener('click', …)` to that root. `#main` survives every render, so each render added one more listener, and each listener re-rendered. The pop-ups were absolutely positioned against their button (`right:0` / `left:0`) with nothing keeping them inside the window.
- Why it wasn't caught: every test loaded a view and clicked once or twice; none counted redraws or clicked repeatedly. The phone-width checks ran with the pop-ups closed.
- Fix:           this PR. Mode views mount on a fresh wrapper (`<div class="mp">`, `display: contents`) that is replaced on every render, so its listeners die with it. Pop-ups are shifted back inside the window when they open (`inView()` in `app.js`), and the header toolbar sits at the right edge (`.tbar { margin-left: auto }`). Verified locally: one redraw per click on all eleven routes; the Views menu at [566, 846] in a 1000px window and [8, 288] at 390px, with no sideways scroll. Production check after merge: Paddy's URL, click any control ten times — each click instant; open Views at a narrow window — fully visible.
- Guardrails added: this PR. `privacy-command-center/tests/sync.test.mjs` — *one click, one redraw* (eleven routes, eight alternating clicks, fails when any click redraws `#main` more than once; it reported 1 → 128 without the fix) and *pop-ups open inside the window at every width* (seven widths × three routes, both pop-ups; it reported the −30px and 1230px cases without the fix). Both run in the Accessibility workflow.
- Follow-ups:    a new view in `modes.js`/`sensors.js` must bind to the root it is given and nothing older (comment in `app.js` `render()`); owner: any session adding a view.

### 2026-10-03 — Retention cohorts inflated by launch-day `first_seen` stamps

- **Impact:** Dashboard only — no data collection affected. The Journeys →
  Retention cohort for the week of 2026-09-14 showed **1,166 visitors at ~0%
  retention** when only **93** were actually active in `page_views` that week. The
  bad cohort made retention look broken for that week and skewed returning-rate
  reasoning. Raw `page_views`/`events` were always correct; the error was confined
  to the derived `visitors` roll-up.
- **Window:** since the events/visitors system went live in the 2026-09-14 week;
  surfaced 2026-10-03 while reviewing the 30-day retention table.
- **Detected by:** Paddy, who flagged the anomalous flat cohort; confirmed with two
  COUNT queries (`cohort_from_visitors=1166` vs `actually_active_that_week=93`).
- **Cause:** when the event path first populated `visitors`, it stamped
  `first_seen = datetime('now')` (≈ launch date) on a backlog of visitor ids. The
  #908 `backfill-visitors.sql` could not correct them: it only moves `first_seen`
  EARLIER from `page_views`, and these ids either have no `page_views` at all
  (events-only traffic, or a bot hitting `/e/i`) or their true first page view is
  LATER than the launch stamp. A page-based retention cohort then counted ~1,073
  visitors that were never actually new — or never browsed — that week.
- **Why it wasn't caught:** the roll-up's `first_seen` was trusted as a true
  first-visit date; nothing asserted that a cohort member must have real page-view
  activity, so event-only / stamped rows flowed straight into the cohort.
- **Fix:**
  - Code (durable): `cohortWeeks()` in `analytics/lib/metrics.js` builds cohorts
    from visitors with page-view activity only; `/api/journeys` uses it (no extra
    D1 reads — it reuses the activity query already in the batch). This also stops
    a future `/e/i` bot flood from inflating a cohort.
  - Data (one-time): `analytics/worker/fix-launch-firstseen.sql` re-anchors each
    real visitor's `first_seen` to their true earliest page view (overwriting the
    launch stamp even when later) and removes roll-up rows with no page view ever.
    Verified in `node:sqlite`: a Sep-14 cohort of 3 collapses to the 1 real
    browser; a visitor whose real first view post-dates the stamp is corrected.
- **Guardrails added:** `cohortWeeks()` + 3 new assertions in
  `analytics/tests/run.mjs` (236 passing); this log entry; the standing rule below.
  - **Standing rule:** the `visitors` roll-up's `first_seen` is a derived field,
    not ground truth. Any cohort or first-visit metric must be computed over
    visitors with real `page_views` activity — never over raw roll-up rows, which
    can be created by events alone (including bots on `/e/i`).
- **Follow-ups:**
  - [ ] **Paddy:** run `analytics/worker/fix-launch-firstseen.console.sql` once in
    the D1 Console (after the read quota resets). The code guard already hides the
    inflation; this cleans the stored dates so the numbers match at the source.

### 2026-10-02 — D1 free-tier daily "rows read" limit exceeded; reads blocked

- **Impact:** Cloudflare blocked all D1 **reads** account-wide once the free-tier
  daily cap (5,000,000 rows read) was hit. The analytics dashboard (and any live
  feature that reads D1 — leaderboard, testimonials) could not load until the
  quota reset at 00:00 UTC. **No data lost:** D1 **writes** are a separate quota,
  so the page-view beacon and the no-JS pixel kept recording throughout.
- **Window:** ~2026-10-02, during a long interactive debugging session; auto-reset
  at 2026-10-03 00:00 UTC.
- **Detected by:** Cloudflare usage notification ("daily operations reached 70%",
  then "temporarily blocked"), relayed by Paddy.
- **Cause:** the two Phase-2/4 dashboard endpoints `/api/insights` and
  `/api/journeys` each **full-scanned `page_views`** to derive every visitor's
  first-seen date (`SELECT visitor_id, MIN(created_at) … GROUP BY visitor_id`),
  on **every cold load**. They were also not edge-cached at first. A day of
  intensive manual dashboard use (dozens of loads across tabs, periods and date
  ranges) multiplied those full scans into millions of rows read. The hourly
  Analytics Health check was NOT a factor — it only hits write/pixel endpoints.
- **Why it wasn't caught:** the new endpoints shipped without read-cost review;
  no per-query row-read budget or alert existed below Cloudflare's own 70% notice.
- **Fix:**
  - #907 — edge-cache `/api/insights` and `/api/journeys` (then raised, with
    `/api/stats`, to 10–30 min TTLs).
  - #<this PR> — the heavy endpoints now read first-seen from the `visitors`
    roll-up table (one indexed row per visitor) instead of scanning `page_views`;
    a one-time `analytics/worker/backfill-visitors.sql` fills historical
    visitors (run after the quota reset); realtime polling slowed to 60s and
    pauses on a hidden tab.
- **Guardrails added:**
  - Roll-up reads + backfill (above); this log entry; the rule below.
  - **Standing rule:** any new `/api/*` aggregation that scans `page_views` or
    `events` must be edge-cached AND must not scan a whole table per request
    (derive from a roll-up, or bound by the period). Treat D1 **rows read** as a
    budget, not just rows written.
- **Follow-ups:**
  - [x] **Paddy:** run `analytics/worker/backfill-visitors.sql` once after the
    read quota resets, so returning-visitor/cohort history is complete. Done
    2026-10-03 (this also exposed the launch-stamp artifact — see 2026-10-03 above).
  - [ ] **Paddy (optional):** if the dashboard is used heavily, the Workers Paid
    plan ($5/mo) removes these daily caps entirely.

### 2026-09-24 — Analytics stopped recording JS page views for ~28 hours

- **Impact:** No JavaScript page views, sessions or events were recorded
  site-wide. The no-JS tracking pixel (`server_hits`) kept counting page loads.
  Data before 14:33 UTC on 24 Sep is intact. Sessions in the window are lost;
  pixel page loads survive, and sessions can be estimated with
  `analytics/queries/estimate-gap-sessions.sql`.
- **Window:** about 14:33 UTC 2026-09-24 (merge and auto-deploy of `1a564d2`) to
  about 18:15 UTC 2026-09-25 (merge and auto-deploy of #861). Confirmed live by the
  first Analytics Health run at 18:24 UTC.
- **Detected by:** Paddy, who noticed "only two sessions today", about 27 hours
  after the break. No automated signal existed.
- **Cause:** commit `1a564d2` ("P0.4/P0.5/P0.6 (Worker): privacy claims match the
  code, legal pages, API hardening"), authored by a Claude Code session
  (`session_019yiLK7XDwz7nSPDc9bs8Fg`). It replaced "echo any Origin with
  credentials" CORS with an allowlist, which was correct, and also removed
  `Access-Control-Allow-Credentials`, which was wrong.
  - `navigator.sendBeacon` always sends in credentials mode `include`, and
    `lib/ps.js` beacons are `application/json`, so every page view is preflighted.
  - A credentialed preflight without that header is refused, and the browser drops
    the beacon silently. `sendBeacon()` still returns `true`.
- **Why it wasn't caught:**
  1. The risky line sat inside a large mixed PR (privacy copy, legal pages and
     Worker security).
  2. The accompanying test asserted `CORS never allows credentials`, encoding the
     bug as a rule, so CI was green.
  3. No production check existed. The failure is invisible in the browser unless
     DevTools is open.
  4. The dashboard tile attributed the gap to "ad blockers / incognito", so a 90%
     gap looked like normal behaviour.
- **Fix:** #861 restored `Access-Control-Allow-Credentials: true` for allowlisted
  origins only. Foreign origins are still refused. It was reproduced first in
  Chromium: 0 of 1 beacons delivered before the fix, 1 of 1 after.
- **Guardrails added:**
  - #862: a browser-CORS contract test that drives the real Worker `fetch()` and
    fails 8 assertions if the regression returns.
  - #862: the **Analytics Health** workflow, which checks production after each
    Worker push and hourly.
  - #862: `docs/CHANGE-SAFETY.md` and a `CLAUDE.md` rule.
  - #864: the dashboard tile relabelled "pixel-only", with a "JS tracking may be
    broken" warning.
  - This runbook, and the PR template's deploy-impact checklist.
- **Follow-ups:**
  - [ ] **Paddy:** require the `worker` and `validate` status checks on `main`
    (Settings → Branches), so a red contract test blocks the merge instead of
    advising.
  - [x] **Claude:** confirm Analytics Health's hourly schedule is firing. Done
    2026-09-25: the first scheduled run
    ([36193171479](https://github.com/paddyriyer/paddyspeaks/actions/runs/36193171479))
    ran at 21:44 UTC and passed. GitHub started the new cron late; later runs
    follow the hourly schedule.
  - [ ] **Paddy:** after a few normal days, note the usual pixel-only share so the
    dashboard warning threshold (60%) can be tightened.
