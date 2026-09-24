# Security baseline

P0.6 of the platform plan. What is protected, how, what is still open, and the
few switches that live outside the repository.

## Threat model in one paragraph

PaddySpeaks is a static site plus one Cloudflare Worker
(`ps.paddyspeaks.com`). There are no user accounts. What can go wrong:

- the Worker being driven from someone else's site (CORS);
- the Worker's paid or abusable routes being burned or misused (the privacy
  scan proxy is an outbound fetcher);
- the shared admin password being guessed (analytics and testimonial moderation);
- personal data in D1 (testimonials) leaking;
- a script injected into a page, through an href built from outside data;
- a credential being committed.

## Controls in place

| Area | Control | Where | Tested by |
|---|---|---|---|
| CORS | Allowlist: `https://paddyspeaks.com`, `https://www.paddyspeaks.com`, `http://localhost:*`, `http://127.0.0.1:*`. Any other Origin gets no `Access-Control-Allow-Origin`. `Allow-Credentials` is never sent. | `analytics/worker/security.js` | `analytics/tests/run.mjs` |
| Admin auth | Constant-time compare against the `ADMIN_PASSWORD_HASH` secret; never equal when the secret is unset. Failed attempts are throttled: 10 per 15 minutes per IP, then HTTP 429. | `security.js`, `worker.js`, `testimonials.js` | run.mjs |
| Scan proxy | Requires an allowlisted `Origin` (a curl or bot request is refused). Per-IP limits: 30 scans/h and 60 page reads/h, **fail-closed**. Every redirect hop is re-checked by the SSRF guard (`isFetchable`). No logging, no storage, `no-store`. | `analytics/worker/scan.js` | run.mjs |
| Forms | Honeypots; per-IP limits (contact 5/h, testimonials 3/h); duplicate suppression; validation shared with the browser (`analytics/lib/forms.js`); all email fields HTML-escaped. | `contact.js`, `testimonials.js` | run.mjs |
| Rate-limit identity | `CF-Connecting-IP` only. `X-Forwarded-For` is ignored because a client can set it. | `forms-util.js` | run.mjs |
| Leaderboard | HMAC-signed tokens, single-use nonces, k-anonymity (hidden below 5 entries), and a metered `/api/lb/report` (10/h/IP). | `leaderboard.js` | run.mjs |
| Privacy signal | `Sec-GPC: 1` means nothing is recorded by the pixel or the collectors. | `worker.js` | run.mjs |
| Retention | A daily cron deletes expired leaderboard entries, nonces older than 24h, and expired rate-limit rows. | `retention.js`, `wrangler.toml` | run.mjs |
| XSS: JobSignal | All text goes through `textContent` (a test enforces this). `href` values are limited to `http(s)`/site/`#`/`?`/`mailto:`/`blob:`. `apply_url` must be `https` at ingest. | `jobs/js/dom.js`, `jobsignal/pipeline/normalize.py` | `test_pipeline.py` |
| XSS: Privacy Console | Result links pass `safeUrl()` (http(s) only) before `esc()`. | `privacy/app.js` | — |
| XSS: platform components | DOM APIs and `textContent` only; links limited to http(s) and same-origin paths. | `lib/ps-sources.js`, `lib/ps-search.js`, `lib/ps-related.js` | `lib/tests/*.mjs` |
| Secrets | Every Worker credential is a Cloudflare Secret, never in the repo. `scripts/platform_build/secret_scan.py` scans the tree and full history in CI. `.gitignore` blocks `.env`, keys and `.dev.vars`. | `.github/workflows/security.yml` | CI |
| Dependencies | Dependabot for GitHub Actions and `privacy-agent`; `npm audit --audit-level=high` weekly and on PRs. | `.github/dependabot.yml`, `security.yml` | CI |

## Static-site headers

`_headers` at the repository root carries the intended headers: HSTS,
`nosniff`, Referrer-Policy, Permissions-Policy, frame protection, COOP, and a
**report-only** CSP. **GitHub Pages does not honour `_headers`.** The
Privacy Console code records that the site is served from GitHub Pages. Until
hosting changes, set the same headers at Cloudflare, if `paddyspeaks.com` is
proxied through it (orange cloud):

1. Cloudflare dashboard → the `paddyspeaks.com` zone → **Rules → Transform
   Rules → Modify Response Header → Create rule**.
2. When: *Hostname equals `paddyspeaks.com`* (add `www.paddyspeaks.com` with OR).
3. Then **Set static** each header from `_headers`, copying the values exactly.
4. Deploy, then check with `curl -sI https://paddyspeaks.com/ | grep -iE 'strict|nosniff|referrer|permissions|content-security'`.

If the zone is **not** proxied (grey cloud straight to GitHub), headers
cannot be set at all without moving hosting. That is a decision recorded in
the backlog.

**Why report-only:** 256 pages carry inline `<script>` blocks and 102 carry
inline event handlers. An enforcing CSP would need `'unsafe-inline'` and
would protect little. The report-only policy shows exactly what a strict
policy would block, so it can be tightened page by page.

## Still open (see the backlog)

- **Admin auth is a shared password hash.** It is now throttled and compared in
  constant time, but the right fix is **Cloudflare Access** (Zero Trust, free
  for small teams) in front of `/analytics/*`, `/testimonials/admin.html` and
  the admin API routes. That needs a dashboard change.
- The analytics collectors (`/api/v`, `/api/e`, `/api/px.gif`) are not
  rate-limited per IP. That is deliberate, since metering every page view costs
  D1 writes, but a flood would inflate numbers and write costs. Cloudflare's
  WAF rate-limiting rule on `ps.paddyspeaks.com/api/*` is the cheap control.
- Contact and testimonial limits fail **open** when D1 is unavailable (so a
  message is never lost). The scan proxy and admin sign-in fail closed.
- Turnstile is not used. Honeypots plus rate limits have been enough so far.
- The community-questions Google Sheet is published to the web. See the
  privacy policy and the backlog.

## If a secret leaks

1. **Rotate first.** Cloudflare dashboard → Workers → `paddyspeaks` →
   Settings → Variables and Secrets. For `ADMIN_PASSWORD_HASH`, set the
   SHA-256 of a new password. For `LB_SIGNING_KEY`, rotating invalidates
   in-flight leaderboard tokens only. Rotate `RESEND_API_KEY`,
   `BRAVE_SEARCH_API_KEY` and `GOOGLE_CSE_KEY` at their providers.
   `ANTHROPIC_API_KEY` and `ADZUNA_*` are GitHub Actions secrets: rotate at
   the provider, then update in repo settings.
2. Then remove the value from the repository (history keeps it, which is why
   step 1 comes first).
3. Run `python3 scripts/platform_build/secret_scan.py --history`.
