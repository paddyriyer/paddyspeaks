# AI Mock Interview (NS-2) — deploy checklist

The AI Mock tool at `/interview.app/mock-ai/` calls the Worker route
`POST /api/mock`, which grades a candidate's answer with the Anthropic API.

**Until you complete the two steps below, the route returns `503 not_configured`
and the page shows a friendly "not live yet" state — so shipping the frontend
changes nothing on the live site.** This mirrors the leaderboard's dormant
behaviour.

## 1. Set the API key (required to go live)

```bash
cd analytics/worker
wrangler secret put ANTHROPIC_API_KEY      # paste your Anthropic API key
```

That's the only secret needed. The route reads `env.ANTHROPIC_API_KEY`; if it's
absent the endpoint stays dormant.

## 2. Create the rate-limit table (recommended)

```bash
wrangler d1 execute paddyspeaks-analytics --file=analytics/worker/mock-schema.sql
```

This adds `mock_usage` (anonymised daily IP hash + a per-day count) to the
existing **analytics** D1. The route **fails open** if the table is missing —
so the tool works without it, but the per-IP daily cap (`CFG.dailyCap`, 20)
won't be enforced until you run this.

## 3. Deploy

Pushing to `main` auto-deploys via Workers Builds (same as the leaderboard).
Or: `wrangler deploy`.

## Cost & model — your call

`mock.js` defaults to **`claude-opus-4-8`** for the best feedback quality.
For a free public tool at volume this costs real money per critique
($5 / $25 per Mtok). The model is a **one-line change** at the top of
`mock.js` (`const MODEL`):

- `claude-haiku-4-5` — ~5× cheaper, still strong for short critiques.
- `claude-sonnet-5` — a middle option.

Other cost levers already in place: `CFG.maxTokens` (output ceiling),
`CFG.effort` (`medium`), and `CFG.dailyCap` (per-IP daily cap).

## Privacy

The candidate's answer is sent to Anthropic to be graded, then discarded. The
only thing stored is the anonymised, daily-rotating IP hash + count in
`mock_usage` (no answers, no transcripts, no PII). The page discloses this
plainly above the answer box.

## Rollback

Remove the `ANTHROPIC_API_KEY` secret (`wrangler secret delete ANTHROPIC_API_KEY`)
and the route goes dormant again — the page reverts to its "not live yet" state
with no code change.
