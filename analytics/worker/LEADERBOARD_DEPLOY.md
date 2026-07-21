# Anonymous Leaderboard — Deploy Checklist

The leaderboard ships **dormant**. The frontend is live but every API call returns
`503 "leaderboard not configured"` until you complete the steps below. Nothing about
the existing analytics worker changes until you opt in.

## What it is (and isn't)

- **Anonymous by design.** No name, email, phone, IP, user-agent, session id, exact
  timestamp (day-bucket only), or submitted code is ever stored. Entries show a
  random alias like `Query Falcon #238`.
- **Motivational, not a credential.** Scores are graded in the user's browser
  (PGlite/Pyodide), so the server *cannot* recompute them. Defense-in-depth is in
  place (signed single-use attempt tokens, server-measured duration, plausibility →
  integrity states, k-anonymity suppression `< 5`, per-device deletion tokens), but a
  determined user can still forge a raw score. This is documented, not hidden — see
  the header comment in `leaderboard.js`.
- **Separate D1 database** from analytics — deliberately no PII crossover.

## Provision (you run these — I can't touch your Cloudflare account)

```bash
cd analytics/worker

# 1. Create the SEPARATE leaderboard database
wrangler d1 create paddyspeaks-leaderboard
#    → copy the printed database_id

# 2. Paste that id into wrangler.toml and UNCOMMENT the [[d1_databases]] LB block:
#    [[d1_databases]]
#    binding = "LB"
#    database_name = "paddyspeaks-leaderboard"
#    database_id = "<paste here>"

# 3. Create the tables
wrangler d1 execute paddyspeaks-leaderboard --file=leaderboard-schema.sql

# 4. Set the HMAC signing key for attempt tokens (32+ random bytes)
#    e.g.  openssl rand -base64 48
wrangler secret put LB_SIGNING_KEY

# 5. Deploy
wrangler deploy
```

## Verify it's live

```bash
# Should now return an empty/suppressed board (200), not 503:
curl https://ps.paddyspeaks.com/api/lb?period=week
# → {"suppressed":true,"min":5,"entries":[]}   (until 5+ valid entries exist)
```

Then take a Skill Check on `/interview.app/evaluate/?section=sql`, finish it, and the
opt-in card appears on the results screen. Tick consent → your alias joins the board.

## Endpoints (mounted by `worker.js` on `/api/lb/*`)

| Method | Path             | Purpose                                             |
|--------|------------------|-----------------------------------------------------|
| POST   | `/api/lb/token`  | Issued at test **start**; signed, single-use, 3h TTL |
| POST   | `/api/lb/submit` | Consent-gated; verifies token, stores entry, returns rank + browser-only deletion token |
| GET    | `/api/lb`        | Public board; k-anon suppressed below 5 entries     |
| GET    | `/api/lb/stats`  | Non-identifying weekly start/completion aggregates   |
| DELETE | `/api/lb/entry`  | Delete own entry via browser-held deletion token     |
| POST   | `/api/lb/report` | Flag an entry `under_review`                         |

## Rollback

Comment the `LB` binding back out (or `wrangler secret delete LB_SIGNING_KEY`) and
redeploy — the routes go back to `503` and the opt-in card disappears. Existing rows
stay in the leaderboard DB untouched.

## Config knobs (`leaderboard.js` → `CFG`)

`tokenTtlMs` (3h) · `minDurationS` (10s plausibility floor) · `suppressBelow` (5, the
k-anonymity threshold — consider raising to 10 once traffic allows) · `retentionMonths`
(12) · `diffMult` / `firstAttemptMult` (ranking normalization, ranking-only; the board
shows the raw %).

## Deferred (not in this MVP)

Rate limiting (would need an IP-hash with a daily-rotating salt — flagged for privacy
review before adding), a suspicious-entry quarantine/admin view, percentiles/badges,
and retention cron jobs. All are additive and don't block launch.
