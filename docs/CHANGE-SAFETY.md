# Change Safety — how to ship a major rework without breaking production

_Written after 2026-09-24/25, when a security rework of the analytics Worker
silently stopped every JS page view for ~28 hours. Nothing in CI failed; a test
actually asserted the broken behaviour. Read this before any change that
touches more than one system, and before any change to `analytics/worker/`,
`lib/ps.js`, headers, or hosting._

## 1. Know what a merge deploys

| Merging to `main` deploys… | How | Notice |
|---|---|---|
| The website (all static pages) | GitHub Pages | Minutes. No preview of the live domain. |
| The analytics/forms/leaderboard Worker (`ps.paddyspeaks.com`) | Cloudflare Workers Builds (the "Workers Builds: paddyspeaks" check) | Immediate. Every PR also gets a **branch preview URL** from the Cloudflare bot. |

There is no staging environment. **Merging is deploying.**

## 2. Know the silent failures

These break production without an error anyone sees:

- **`navigator.sendBeacon()` returns `true` even when the browser drops the
  request.** A refused CORS preflight is only visible in the visitor's DevTools.
- **Beacons are always credentialed.** Any Worker response to the site's origin
  needs `Access-Control-Allow-Origin: <origin>` **and**
  `Access-Control-Allow-Credentials: true`, or no page view is recorded.
- **The pixel (`/api/px.gif`) is blocked by common ad blockers**
  (`ERR_BLOCKED_BY_CLIENT`), so it undercounts and is not a full backstop.
- **A green test can encode the bug.** The 2026-09-24 test said "CORS never
  allows credentials" — correct for security in general, wrong for this client.
  A test that asserts a platform rule must name the platform behaviour it relies on.

## 3. Before merging a major rework

1. **Split it.** Content, infrastructure and security changes go in separate PRs.
   The 2026-09-24 change bundled privacy copy, legal pages and Worker hardening,
   so the one risky line hid among hundreds of safe ones.
2. **Run every local guardrail**:
   `node analytics/tests/run.mjs` (includes the browser CORS contract),
   `python .github/scripts/validate_content.py`, `python scripts/check_handbook.py`,
   `python3 scripts/platform_build/build.py check`, `python3 -m jobsignal.tests.test_pipeline`.
3. **If the Worker changed, check the PR's branch preview before merging**:
   `ANALYTICS_BASE=https://<branch>-paddyspeaks.paddy-iyer.workers.dev python scripts/analytics_smoke.py`
   (the URL is in the Cloudflare bot's PR comment). It must print OK.
4. **Write down the rollback before merging**: normally "revert the PR on GitHub",
   which redeploys the previous Worker and pages automatically.

## 4. Within 15 minutes of merging

- **Analytics Health** (`.github/workflows/analytics-health.yml`) runs on its own
  after a Worker change, and every hour after that. It must be green. A failure
  emails the repository owner.
- Open the site in a normal browser window, open DevTools → Console, and confirm
  there are **no CORS errors** from `ps.paddyspeaks.com`. In the Network tab,
  `/api/v` should return `204`.
- Check the dashboard's realtime view shows your visit (unless you have excluded
  yourself).

## 5. If something broke

1. Revert first, diagnose second. A revert is one click and redeploys itself.
2. Record the outage window. `analytics/queries/estimate-gap-sessions.sql` shows
   how to estimate sessions from the pixel for a gap. Keep estimates out of `page_views`.
3. Add the guardrail that would have caught it before closing the incident.
