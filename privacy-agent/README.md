# privacy-agent

An autonomous privacy operations centre that runs **on your machine**.

You give it your identity once. It works out where your personal information is
published, verifies which of those records are actually yours, files the removal
requests, follows the confirmation emails, and keeps checking that what it
removed stays removed.

## Getting it running

There is **no URL and no hosted app**. It is a program you run on your own
computer, from a terminal, and it never leaves that machine. Requires Node 20+.

```bash
git clone https://github.com/paddyriyer/paddyspeaks.git
cd paddyspeaks/privacy-agent

npm install
npx playwright install chromium     # the browser it drives

node bin/privacy-agent.mjs init     # create the encrypted vault, choose a passphrase
node bin/privacy-agent.mjs onboard  # the identity interview
node bin/privacy-agent.mjs run --review
```

`npm install` may already fetch the browser, depending on your npm settings —
`npx playwright install chromium` is idempotent, so run it either way rather
than finding out mid-run.

That last command prints a dashboard link:

```
Dashboard: http://127.0.0.1:52341/?t=9f3a…
```

A random port on **loopback with a per-session token** — the only URL this
project has. It is not reachable from another machine and there is deliberately
no flag to make it so, because the page renders a home address.

**Run it on a machine you control.** Not a shared server, not a cloud container.
The vault is only as private as the disk under it, and an ephemeral container
would destroy it when reclaimed.

---

## How you give it your information

**A terminal interview — `privacy-agent onboard`.** Not a web form, and
emphatically **not a Google Form**. Nothing you type is submitted anywhere; the
answers go straight into the encrypted vault on your own disk.

A Google Form would put your legal name, home address, address history and
relatives' names into a Google Sheet owned by whoever made the form — creating a
second copy of exactly the dossier you are trying to delete, on infrastructure
you do not control, indexed and backed up beyond your reach. The same objection
applies to any hosted intake: Typeform, a web app, a database. There is no
server in this project to submit anything *to*.

The interview asks in six small groups, explains why each item helps, and every
question is skippable. `assessCoverage` then tells you honestly what skipping
cost you before the run starts.

## Can the information be anonymized?

**No — and it is worth being straight about why, because this is the one privacy
property the tool genuinely cannot offer.**

The job is to decide whether a specific listing describes *you* and not one of
the thousands of other people with your name. That is an identity-matching
problem, and identity matching on anonymized data is a contradiction: hashing
your address makes it useless for recognising your address on a broker page.
Filling in a removal form is worse — the site needs your real name and address
or it cannot find the record to delete.

So the design does not pretend to anonymize. It minimises instead:

- **Skip anything.** Every field is optional. Give a city instead of a street
  address and you will get more "is this you?" questions and fewer confirmed
  matches — a real trade, stated up front rather than discovered later.
- **Year of birth, never the full date.** A year discriminates between people
  almost as well and is far less useful to anyone who misuses it.
- **Relatives' names are used only to recognise your record.** They are never
  searched on their relatives' own behalf and nothing is ever filed about them.
- **Masked everywhere it is displayed.** The dashboard shows `•••-•••-0142` and
  `••• Main Street`. You already know your own phone number; rendering it in
  full into a browser tab only puts it in a page cache.
- **`blindIndex`** gives "have we seen this before" checks without storing the
  value, salted per-vault so two vaults produce incomparable hashes.

## What is kept locally, exactly

Everything, under `~/.privacy-agent/` (override with `PRIVACY_AGENT_HOME`). Every
file is mode `0600` in a `0700` directory:

| File | Contents | Protection |
|---|---|---|
| `vault.json` | Identity profile + identity graph | **AES-256-GCM** |
| `run.json` | Exposures, match evidence, statuses, case numbers | **AES-256-GCM** |
| `evidence/*.png.enc` | Before/after screenshots of listings | **AES-256-GCM** |
| `vault.meta.json` | scrypt salt + passphrase verifier | No secrets in it |
| `workflows.json` | How each site's opt-out form works | **Plaintext, deliberately** — no PII by construction |
| `browser-profile/` | Chromium cookies, history, site data | `0700` only — **see below** |

The passphrase is never stored. Retention defaults to 365 days and `prune()`
runs every session, deleting closed exposures and their evidence. `destroy`
removes the lot.

### The one thing that is not encrypted

**`browser-profile/`.** Chromium needs its profile readable to run, so it cannot
be encrypted at rest. It accumulates cookies and history for the sites the agent
visited — which is a record of *which brokers listed you*, though not your
identity data itself. It is `0700`, wiped by `destroy`, and can be cleared any
time with `privacy-agent forget-browser`. If that residue matters to you, run
that command after each session.

Evidence screenshots **were** a second gap — Playwright's `path:` option writes
through the process umask, producing world-readable PNGs of your address. They
now go through the vault's encryption instead, at `0600`, with a test asserting
it.

## What leaves your machine

Only three things, and nothing else:

1. **Search queries** to whichever search API you configured — these contain
   your name, phone, address etc., because that is what searching for them
   means. Choose the provider accordingly.
2. **Page visits** to the sites being checked, from your own IP.
3. **The removal requests themselves** — your name and address typed into a
   broker's opt-out form, which is the entire point.

There is no telemetry, no analytics, no account, no sync, and no outbound call
to anything belonging to this project. `workflows.json` is shareable but is
never transmitted automatically — moving it is a manual act.

## Why it runs locally

The vault holds a person's legal name, home address, address history, phone
numbers and relatives' names. That is a dossier, and it is exactly the thing the
tool exists to get *off* the internet. So:

- **Nothing is uploaded.** There is no account, no server, no telemetry. The
  only outbound traffic is search queries and the removal requests themselves.
- **Everything at rest is encrypted** with AES-256-GCM under a scrypt-derived
  key from a passphrase only you have. Forget it and the vault is gone — which
  is the correct trade for a file containing your home address.
- **The dashboard binds to 127.0.0.1 only**, with a per-session token. There is
  deliberately no `--host` flag.
- **Logs are redacted** through two independent layers: known identity values
  are tokenised, and email/phone/SSN/address patterns are scrubbed generically
  so that *other people's* data picked up from scraped pages never lands in a
  log file either.

This is why it is a local CLI and not a feature of the website. A static site on
GitHub Pages cannot drive Chrome, and a hosted version would mean centralising
thousands of people's identity dossiers in one database — building the exact
asset that data brokers already profit from.

## What it does, in order

1. **Onboarding.** A guided interview in small groups, not a giant form. Every
   question explains why it helps and can be skipped; `assessCoverage` tells you
   honestly what skipping it costs before the run starts.
2. **Normalization.** Names expand into orderings, initials, nicknames and
   punctuation variants; phones into every written format; emails into aliases;
   addresses into abbreviated and expanded forms. Every derived value carries a
   confidence that *decays* with distance from what you actually said.
3. **Identity graph.** Names, addresses, phones, emails, usernames, employers,
   relatives, domains and profiles, linked by why we believe they connect. Every
   newly discovered identifier becomes another search input.
4. **Discovery.** Dynamic web search across identifier-only queries (phone-only,
   email-only, address-only, username), contextual combinations, documents
   (`filetype:pdf`), directories and rosters. Recursive: new identifiers trigger
   new searches until several rounds produce nothing new.
5. **Matching.** Every result is scored against the graph. A name match alone
   can never confirm — see below.
6. **Removal.** For each confirmed exposure, the site is *read* to find its
   actual opt-out mechanism, then Chromium fills and submits the form.
7. **Verification.** After the site's stated processing window, the listing is
   re-checked. Only then does it become "removed".
8. **Recheck.** The sharpest original searches are re-run to catch mirrors,
   caches and republished copies.

## The four rules that shape the code

**A name match alone is never enough.** Thousands of people share most names,
and brokers publish a page for all of them. `scoreMatch` clamps a name-only
result below the confirmation threshold no matter how perfect the name is. The
score is carried by corroborating attributes — address, phone, email, relatives,
age. There is a test named for this, and it should never be relaxed.

**Absence is not evidence.** A listing that simply doesn't print a phone number
is not a mismatch. Only attributes actually present on the page are scored, so a
sparse page about you outscores a dense page about someone else.

**"Submitted" is not "removed".** These are separate states with a verification
step between them, enforced by the state machine — `discovered` cannot reach
`successfully_removed` without going through an actual recheck. Reporting a
filed request as a completed removal is the central dishonesty this product
could commit, so the type system prevents it.

**Stop rather than guess.** CAPTCHA, SMS codes and MFA pause and hand you the
live browser tab, resuming from the same state. Government ID, SSN, licence and
passport fields are never auto-filled — the agent explains what is being asked
and waits. Payment is never made; a site that charges is recorded and a free
route is sought instead.

## No hardcoded broker list

There is no list of data brokers anywhere in this repository, and adding one
would be a regression (there is a test asserting its absence). Hardcoding the
well-known sites finds the well-known sites and misses the long tail — the
regional directory, the church newsletter PDF, the HOA roster — which is usually
where the genuinely surprising exposure lives.

The agent searches for *the person* and lets discovery reveal which sites exist.

## Search backend

Discovery needs a search API. Set one of:

| Variable | Service |
|---|---|
| `BRAVE_SEARCH_API_KEY` | Brave Search API — independent index, generous free tier |
| `SERPER_API_KEY` | Serper.dev — Google coverage |
| `SERPAPI_KEY` | SerpAPI — multi-engine |
| `BING_SEARCH_KEY` | Bing Web Search |

Without one, the agent runs in **manual mode**: you paste result URLs and it does
everything else. It will not scrape Google or Bing result pages — that breaks
their terms and tends to get your home IP blocked partway through a run.

## Modes

| Mode | Behaviour |
|---|---|
| `run --review` | Discover everything, then approve each removal individually. |
| `run --mission` | Approve the mission once; routine confirmed removals proceed unattended. Still stops for ambiguity, sensitive documents, payment, CAPTCHA, MFA and account deletion. |
| `discover` | Find everything, remove nothing. |

## Shared workflows, private data

When a removal succeeds the site's workflow is saved to `workflows.json` — the
navigation path, field *shapes*, confirmation behaviour and typical processing
time. This is the one file kept in plaintext, because it is meant to be
shareable, and it contains **no personal data by construction**:
`sanitizeTemplate` rebuilds it from an allowlist of structural keys (a denylist
would leak whatever field someone adds next year), and `assertNoPii` re-scans the
serialised output for email/phone/address/SSN patterns before it touches disk.
Two independent guards, because this is the only file intended to leave the
machine.

## Commands

```
init        create the encrypted vault
onboard     the guided identity interview
run         discover and remove   [--review | --mission] [--headless] [--verbose]
discover    discovery only
status      what state each exposure is in
verify      re-check pending removals, hunt for reappearances
report      the full summary
workflows   inspect the learned (PII-free) site templates
destroy     delete the vault and everything in it
```

## Layout

```
src/core/        pure logic — identity, graph, matching, risk, dedupe,
                 states, redaction, jurisdiction, removability, queries
src/discover/    search providers, page extraction
src/browser/     Playwright session, form-field classification
src/removal/     opt-out discovery, execution, workflows, email confirmation
src/store/       encrypted vault
src/ui/          local dashboard
src/onboarding/  the interview script
```

Everything in `src/core/` is pure and dependency-free. That is where the
judgement lives, and it is why `node tests/run.mjs` covers the decisions that
matter without mocking a browser.

## Tests

```bash
node tests/run.mjs     # 147 assertions, no dependencies
```

## Honest limits

- **It cannot delete what is not deletable.** Court records, government records
  and journalism are classified as such and reported honestly rather than being
  bulk-mailed with removal demands they have no obligation to honour.
- **Discovery is only as good as the search index.** Pages behind logins,
  paywalls or `robots.txt` exclusions will not be found.
- **Removals are requests, not guarantees.** The agent verifies outcomes rather
  than assuming them, which means some records will sit at "pending" or
  "failed", and it says so.
- **Some sites block automation outright.** Where that happens the honest
  outcome is `manual_action_required`. There is no fingerprint spoofing or
  CAPTCHA-solving path in this codebase, and adding one would be out of scope
  in the wrong direction.
