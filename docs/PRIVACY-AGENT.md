# Privacy Agent — design notes

_Added 2026-08-08. Full user-facing documentation lives in
**`privacy-agent/README.md`** — read that first. This file records the decisions
a future session would otherwise have to re-derive, and the ones most likely to
be undone by accident._

## What it is

`privacy-agent/` is a **local-first Node CLI**: an autonomous identity-discovery,
exposure-detection and data-removal agent driving Chromium via Playwright. It
discovers where a person's data is published, verifies which records are really
theirs, files removals, follows confirmation emails, and re-checks that removed
records stay removed.

There is also a **browser front end at `paddyspeaks.com/privacy/`** (`privacy/`).
It is not a demo: `core/` is pure ES modules with no Node dependencies, so the
page imports the *same* files the CLI does. One engine, two front ends, and
therefore no drift between what the CLI scores and what the site scores. **Never
add a Node import (`fs`, `path`, `crypto`) to anything under `core/`** — it
breaks the web app instantly and silently. What the browser cannot do is drive
Chrome or submit forms; that stays in the CLI.

That split is enforced by the platform, not chosen. A page may not fill in or
submit a form on another origin — the same rule that stops any tab you have open
posting from your bank — so the console stops at the submit button and the
removal engine is the CLI. `privacy-agent import <file.json>` carries a console
session across (profile, verified exposures and all) so `run --mission` can file
them for real. See `core/handoff.js`. The bridge is one-directional and refuses
to inherit `pending_removal` or `successfully_removed` from the browser: the
agent must witness a submission itself, because those two states are precisely
what this project will not take on trust. Records the user rejected never cross,
since filing a removal against a stranger is the worst thing this software
could do.

### What must never be centralised

**No identity dossier is ever stored off the user's machine.** Thousands of
people's legal names, home addresses, address histories and relatives in one
database is precisely the asset data brokers already monetise — building it in
order to fight them would be self-defeating. The CLI vault is AES-256-GCM under
a scrypt key on the user's own disk; the browser console keeps everything in
`localStorage` on the origin. There is no account, and no server holds any of it.

**That is a rule about storage, and it is absolute. It is not a rule about
packets.** A browser page cannot fetch third-party sites — CORS forbids it — so
the console does talk to `analytics/worker/scan.js` for two things, and only
these two:

| Route | Sends | Why it cannot be done client-side |
|---|---|---|
| `POST /api/scan` | the search queries (so: the name, and any address/phone entered) | the browser cannot query a search API with a secret key |
| `POST /api/scan/read` | one listing URL (which usually contains the name) | the browser cannot fetch another origin |

The Worker **logs nothing, stores nothing** (it touches no D1 binding and holds
no state) and **caches nothing** (`no-store` on every response). Both routes are
opt-in per action, and both are disclosed on the page in plain words. **If you
change what leaves the browser, change that copy in the same commit.** A tool
that quietly starts transmitting a home address while still promising "nothing
leaves your browser" is doing exactly what the brokers do.

`/api/scan/read` is a fetch proxy on paddyspeaks.com, which makes `isFetchable()`
a security control rather than a convenience check — allowlisted schemes plus a
denylist of loopback, private, link-local and cloud-metadata hosts. Tested in
`analytics/tests/run.mjs`. Do not relax it.

**Still do not give this a database.** No D1 binding, no KV, no R2, no
`index.html` integration. The house rule that `FORMS` is a separate D1 because
it *holds* PII, and the leaderboard DB is separate because it must hold *none*,
extends here: this holds the most PII of anything in the repo, so it holds it
nowhere the repo can reach.

## Non-negotiables (each has a test named for it)

These encode the difference between a useful tool and a harmful one. If a change
makes one of these tests fail, the change is wrong, not the test.

| Invariant | Where | Why |
|---|---|---|
| A name match alone can never confirm | `core/match.js` | Thousands share a name; brokers publish a page for each. Auto-actioning on a name means filing removals against strangers. |
| Absence is not evidence | `core/match.js` | A page that omits a phone number is not a mismatch. Scoring it as one rejects sparse pages that genuinely are the user. |
| `submitted` ≠ `removed` | `core/states.js` | Separate states with a mandatory verification step. Collapsing them is the central dishonesty the product could commit. |
| No hardcoded broker list | `core/queries.js` | Hardcoding finds the famous sites and misses the long tail, which is where the surprising exposure lives. |
| Sensitive fields never auto-fill | `browser/fields.js` | The guard lives in `planFill`, not at call sites, so future code paths inherit it. |
| Payment is never made | `core/states.js`, `removal/execute.js` | `PAYMENT_DEMANDED` has no transition to `REQUEST_SUBMITTED`. |
| Workflow templates carry no PII | `removal/workflows.js`, `store/vault.js` | Allowlist rebuild **plus** a pattern re-scan before write. Two guards because this is the only file meant to leave the machine. |
| Statutes are cited only when supported | `core/jurisdiction.js` | A wrong citation gives the site a clean reason to reject, and teaches the user a right they may not have. |

## Architecture

```
src/core/        pure, dependency-free — all the judgement lives here
src/discover/    pluggable search providers, page extraction
src/browser/     Playwright session (persistent profile), field classification
src/removal/     opt-out discovery, execution, learned workflows, email
src/store/       AES-256-GCM vault under a scrypt key
src/ui/          loopback-only dashboard
src/onboarding/  the interview script
```

Keeping `src/core/` pure is what lets `node privacy-agent/tests/run.mjs` cover
the decisions that matter (147 assertions) without mocking a browser. Follow
that split: new judgement goes in `core/`, new I/O wraps it.

### Things that cost a round to discover

- **`registrableDomain` must special-case IP literals.** Without it `127.0.0.1`
  becomes `0.1`, silently merging unrelated hosts in the graph, the dedupe groups
  and the workflow cache. Found via the end-to-end smoke test, not the unit tests.
- **Phones dedupe on the literal string, not `norm()`.** `(415) 555-0142` and
  `415-555-0142` normalize identically but are different things to type into a
  form and different things to search for. `dedupeLiteral` exists for this.
- **The browser context must be persistent.** `launchPersistentContext` is what
  makes pause-and-resume work for CAPTCHA/MFA — a fresh context loses the session
  cookie and the half-filled form.
- **The graph's corroboration bonus applies to `baseConfidence`, not the running
  value.** Compounding it let a node climb to 1.0 through repetition alone; a
  hundred sites copying one wrong record is still one wrong record.
- **Evidence screenshots must be written by the vault, never by Playwright.**
  `page.screenshot({ path })` writes through the process umask — on a default
  022 system that produces mode-644 PNGs of the user's home address, i.e. the
  one artefact showing everything is the one artefact unprotected. Fixed by
  having `screenshotBuffer()` return bytes and `vault.saveEvidence()` own the
  write (AES-256-GCM, 0600). Test: "EVIDENCE SCREENSHOTS ARE ENCRYPTED AND 0600".
- **`browser-profile/` cannot be encrypted** — Chromium needs it readable. It
  holds cookies/history for visited brokers. Mitigated by 0700, `destroy`, and
  the `forget-browser` command. Do not try to "fix" this by encrypting it.
- **`extract.js` filters emails on the site's own registrable domain.** Correct
  behaviour, but it means test fixtures must not put the subject's email on the
  broker's domain.
- **The search function is injected (`options.searchFn`), not imported.** ES
  module namespaces are frozen, so a directly-imported `search` cannot be swapped
  by tests or by a custom provider.

## State: what is done

Everything in the 45-point brief is implemented and the pipeline is verified end
to end against a local fixture site with a real opt-out form (real Chromium, real
form submission, real confirmation parsing):

```
confirmed_exposure → removal_method_found → form_in_progress
                   → request_submitted → pending_removal → successfully_removed
```

The same run also verified: opt-out path discovered by *reading the site's
footer and privacy policy* (not URL guessing), CCPA detected as acknowledged by
the site's own policy, case number and processing window parsed from the
confirmation page, evidence screenshots captured before and after, and the SSN
field correctly blocking auto-submission and escalating to the user.

## Not done / deliberate gaps

- **No mail provider is wired in.** `removal/email.js` defines the
  `MailConnector` interface and all the matching logic (which is the hard part —
  confirmations arrive with wildly varying subjects), but no concrete Gmail/IMAP
  backend ships. Add one by passing `{ search, getMessage }` to the constructor.
- **Postal and email-request workflows are detected and drafted, not sent.**
  Sending mail on someone's behalf is a different consent conversation than
  clicking a form they can watch.
- **No search API key is bundled** (obviously). Manual mode is the honest
  fallback; result-page scraping is refused on purpose.
- **`prune()` runs on every run** with a 365-day default retention. There is no
  UI for changing it yet; edit `retentionDays` in `vault.meta.json`.

## Intake: why there is no form

Onboarding is a terminal interview writing straight into the encrypted vault, or
— in the browser console — a set of grouped questions written straight to
`localStorage`. There is deliberately **no Google Form, no hosted intake, no
submitted web form**. Any of those would create a second copy of the user's
dossier on infrastructure they do not control — the exact asset the tool exists
to delete. The console's fields post nowhere; adding a server-side intake would
be a regression, not a convenience.

**The data cannot be anonymized**, and the docs say so plainly rather than
implying otherwise. Deciding whether a listing describes *this* person is
identity matching; hashed values cannot match, and a removal form needs the real
name and address or it cannot locate the record. The design minimises instead:
everything skippable, birth *year* not full date, relatives used only for
recognition and never acted on, masked in the dashboard, `blindIndex` where a
presence check is all that is needed.
