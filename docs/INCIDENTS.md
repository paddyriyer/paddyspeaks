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
