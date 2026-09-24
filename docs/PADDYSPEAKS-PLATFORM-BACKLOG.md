# PaddySpeaks platform backlog

_As of 2026-09-24. Companion to `docs/PADDYSPEAKS-PLATFORM-IMPLEMENTATION.md`._

## Completed

- [x] P0.1 One source of truth for public statistics (catalog → registry → stamped spans, CI drift check, question bots regenerate it)
- [x] P0.2 Provenance records for all 23 sacred texts, *Sources & Verification* panel, honesty rules in CI
- [x] P0.3 Corrections log (`/corrections/`) seeded with 5 documented corrections
- [x] P0.4 Privacy claims corrected site-wide; `/privacy/` data-flow section; Worker honours GPC; CI wording guard
- [x] P0.5 Privacy policy, terms, disclaimer, copyright and takedown; site-wide footer row
- [x] P0.6 Worker CORS allowlist, constant-time admin auth and throttle, scan-proxy origin check, limits and redirect guard, `X-Forwarded-For` ignored, metered lb report, retention cron; https-only apply URLs; secret scanning, npm audit, Dependabot; `_headers`
- [x] P0.7 Backup and recovery doc, D1 export script, encrypted backup workflow (off by default)
- [x] P0.8 Accessible search dialog, focus ring, reduced motion, skip links, labels, ARIA state, target size, reflow; axe CI with baseline
- [x] P1.1 Five-journey navigation (no URL moved)
- [x] P1.2 Universal search (12 content types, sharded, typed, filtered, tested)
- [x] P1.3 "What did you come here to do?" pathways
- [x] P1.4 Local state layer + storage-key registry + "data in this browser" panel
- [x] P1.5 Continue where you left off (local, clearable)
- [x] P1.6 RSS: all essays, per category, changelog; `/subscribe/`
- [x] P1.7 `/changelog/` + `changelog.xml` + suggest tool
- [x] P1.8 Shared tokens and components in `lib/ps-platform.css`
- [x] P2.1 Knowledge graph with provenance on every edge
- [x] P2.2 *Explore further* with a reason on every item
- [x] P2.3 Atlas: search, concept view, company intent panel
- [x] P2.4 Static `/api/v1/` feeds + conventions

## Requires decision (owner)

| # | Decision | Why it matters | Where |
|---|---|---|---|
| 1 | **Unpublish the community-questions Google Sheet** and switch `ingest_submissions.py` to an authenticated read (a service-account secret) | The sheet is "published to the web" and its URL is in this public repo. The form collects an optional **Name**, so names may be publicly readable. Copy was corrected; the exposure itself was not. | `.github/scripts/ingest_submissions.py:29`, `/privacy-policy/#submissions` |
| 2 | **Analytics retention period** (e.g. 25 months) and whether to keep the referrer search keyword | Nothing expires today. The policy says so honestly. | `analytics/worker/retention.js` (deliberately untouched) |
| 3 | **Cloudflare Access** in front of `/analytics/*`, `/testimonials/admin.html` and the admin API routes | The shared password hash is now throttled and constant-time, but it is still a single shared secret | Cloudflare dashboard |
| 4 | **Security headers**: add the Transform Rule, or move hosting to Cloudflare Pages | `_headers` is ignored by GitHub Pages | `docs/SECURITY.md#static-site-headers` |
| 5 | **A licence** for the original writing (e.g. CC BY-NC) and for the code | `/copyright/` currently says "all rights reserved; ask" | `/copyright/` |
| 6 | **Legal review** of the ⚖ sections | Drafted from the implementation, not by counsel | privacy policy, terms, disclaimer, copyright |
| 7 | **Resumes**: stamp their counts, or treat them as dated snapshots | They say 1,500+ questions, 22 data models and 128 articles | `Paddy_Iyer_Resume*.html/.pdf/.docx` |
| 8 | **Replace the "You Might Also Enjoy" blocks** (113 articles, chosen by filename hash) with graph-driven *Explore further* | Arbitrary recommendations sit next to explained ones | `scripts/add_related_articles.py` |
| 9 | **Unverifiable social proof** "1,472 data engineers · last 90 days" and "~10 min average session" | Hand-typed; not derived from analytics | `interview.app/index.html:491` |
| 10 | **Email newsletter**: whether to offer one, and with which double-opt-in provider | `/subscribe/` says honestly there is none | `/subscribe/#email` |
| 11 | **Hosted privacy removal** (docs/HOSTED-REMOVAL.md) | Planned but gated | — |

## Deferred

- **Sacred-text sources**: record the text source for the 9 `source-not-recorded` texts (Rudram, Sandhyavandanam, Narayaneeyam, Amavasya Tharpanam, Hanuman Chalisa, Bajrang Baan, Subramanya Bhujangam, Bhaja Govindam, Kanda Shashti Kavacham). Then do a verification pass (text against source, dated) to earn `verified`.
- **Abhirami Andhadhi**: finish realigning the English meanings beyond the 17 interpreted verses.
- **Accessibility debt** from `scripts/a11y/baseline.json`: contrast on the Gita, Abhirami, Privacy Console, Interview Studio, Skill Check, the job-posting article and the AI Command Center; Abhirami's `div onclick` verse rows → buttons; focusable figure scrollers; the mandala's mobile layout; JobSignal's JS-only skip link.
- **Analytics collector rate limiting** (a Cloudflare WAF rule on `ps.paddyspeaks.com/api/*`).
- **Turnstile** on contact and testimonials, if spam rises.
- **Enforcing CSP**: move inline scripts and handlers into files page by page, then switch from report-only.
- **Vishnu Sahasranama deep links** (`#name-N`, as Lalitha has), so search can land on the name.
- **Dead files**: 27 orphaned `bhagavad-gita/ch*-v*.js` fragments (data lives in `data.js`); 7 root-level duplicate essays (already `noindex` + canonical); `articles/index.html`, a stale listing; the orphan `ps-sim` storage key; the legacy `interview/html/*` and `interview/ads engineering/*` pages (indexable, no canonical, links to a missing `interview/md/`).
- **Broken internal links** (21): 8 missing `ai-buzzwords-*.png`, `year2025-2028.png`, two uncommitted screenshots, 9 `interview/md/*.md` links, a Cloudflare email-protection leftover.
- **Nav partial on the main site**: the new five-journey nav is on the homepage and platform pages. ~120 older pages still carry the previous hand-written nav, which works but differs. A shared partial, like Interview Studio's `build_nav.py`, would unify them.
- **Leaderboard `/api/lb/report`** could require a token from the same session.

## Future opportunity

- **Atlas synthesis**: an optional, cited, cost-bounded summary of the Atlas's own result set (architecture in `docs/KNOWLEDGE-GRAPH.md`).
- **More concepts** (dharma, bhakti, SCD/late-arriving data, streaming, growth accounting, the interview loop), so more of the 149 essays get explainable connections.
- **Verse-level provenance and citation** for every text, and a `/api/v1/verses/` feed once verified.
- **Optional account sync** via `PSState.setSyncAdapter()` (saved jobs, prep progress, Continue), strictly opt-in.
- **Job-to-skill edges** (`jobRequires`): from JobSignal role families to Interview Studio tracks.
- **Glossary**: Sanskrit/Tamil terms and data-engineering terms as graph nodes with their own search type.
- **Per-page `dateModified`** from the corrections log into each Article's JSON-LD.
