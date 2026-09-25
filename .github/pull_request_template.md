## What changed

<!-- One or two lines. What does this PR do and why? -->

## Type

- [ ] New article
- [ ] Edit to an existing article
- [ ] Site / styling / infrastructure

## Deploy impact

Merging to `main` deploys immediately (site via GitHub Pages; analytics Worker via Cloudflare). See `docs/CHANGE-SAFETY.md` and `docs/INCIDENTS.md`.

- [ ] This PR does **not** touch `analytics/worker/`, `lib/ps.js`, headers, CORS, hosting or data collection — **or** it touches only those, in a PR of its own, with:
  - [ ] `node analytics/tests/run.mjs` passing (includes the browser CORS contract)
  - [ ] `scripts/analytics_smoke.py` run against this PR's Cloudflare branch preview
  - [ ] Rollback written down (usually: revert this PR)
- [ ] After merge: Analytics Health green and no CORS errors in the browser console (for Worker / tracker changes)

## Checklist

- [ ] If adding an article: `article_metadata.json` updated (newest entry first)
- [ ] If adding an article: added to `index.html` (Latest list + deck grid); filter counts are stamped by `build.py`
- [ ] No index-generation scripts were run (`index.html` is hand-crafted — see CLAUDE.md)
- [ ] The **Validate Content** check is green
