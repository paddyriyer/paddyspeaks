# JobSignal — redesign specification

> **Status: design for review. No implementation has started.**
> Produced in response to the redesign brief's §31 (design before code).
> Supersedes the UI and search sections of `docs/JOBSIGNAL.md`; the ingestion,
> verification and age-ledger design in that document stands unchanged.

Every number below is measured against the live board (6,053 roles ingested
2026-09-21T16:10Z), not estimated.

---

## A. Current UX problems

### A1. The page is a newspaper, and the measurements say so

Measured on the deployed `/jobs/search/`:

| | Desktop 1440×900 | Mobile 390×844 |
| --- | --- | --- |
| `.top-bar` | 60 px | 70 px |
| `.masthead` | 370 px | 356 px |
| `.nav-bar` | 70 px | collapsed |
| **Chrome before `<main>`** | **500 px** | **501 px** |
| First filter control at | y = 663 | y = 678 |
| **First job card at** | **y = 722** | **y = 1579** |

On desktop 80% of the first viewport is spent before one job is visible. On
mobile the first result sits **1.9 screen-heights** down: a 356 px masthead,
then a ~900 px filter column, then jobs. The search input is not on this page
at all — it is a filter field inside that column.

This is the article chrome, inherited wholesale. It is correct for an essay and
wrong for a search product.

### A2. The visual language is editorial, not product

- Job titles: Playfair Display 700 at 21 px; page titles `clamp(38px, 6.5vw, 66px)`.
- Every label is `--font-mono`, uppercase, `letter-spacing: .22em`.
- Ten `1px solid` panel borders per screen, plus a dashed empty state.
- The trust badge is uppercase mono with a colour fill, so **VERIFIED LIVE ·
  CHECKED 21 MINUTES AGO** is visually louder than the job title — the exact
  inversion the brief's §12 forbids.

### A3. Search relevance is broken, measurably

Query `data engineer` against the live index, current engine:

- **3,139 results returned**
- **2,393 of them tied at score ≥ 0.90** — no ordering signal remains
- **112 have a plausibly data-engineering title → 3.6% precision**

Root cause, in `jobs/js/search.js`:

```js
relevance() → best = max over terms of (1.0 × weight if term in title)
```

The query tokenises to `data engineer` (w 1.0), `data` (0.9), `engineer` (0.9).
Because the score is a **max**, any title containing `engineer` scores 0.9 —
identical to a real match. `Director, Field Engineering` and
`Staff Workday Integration Engineer` score the same as `Senior Data Engineer`.
Nothing in the pipeline knows that *Sales Engineer* is a different job from
*Data Engineer*; the engine only sees a shared token.

### A4. The corpus is not the product

Role families across the 6,053 live roles:

| | count | |
| --- | ---: | --- |
| unclassified (legal, treasury, facilities, animation, car repair…) | 2,195 | drop |
| go-to-market (account executive, BDR, partner) | 862 | drop |
| sales engineering / solutions / forward-deployed | 640 | drop |
| marketing & comms | 208 | drop |
| support ops | 145 | drop |
| people ops | 72 | drop |
| **software engineering** | 780 | keep |
| **infrastructure** | 275 | keep |
| **security** | 264 | keep |
| **product management** | 255 | keep |
| **ml engineering** | 93 | keep |
| **design / UX** | 88 | keep |
| **data science** | 77 | keep |
| **data engineering** | 55 | keep |
| **analytics** | 44 | keep |

**68% of the board is out of scope.** The pipeline ingests every requisition an
employer publishes; the brief (§20) asked for curated domains. Two employers
dominate the noise: Bosch (500) and Ubisoft (305) publish mostly non-technical
roles.

### A5. Fields too thin to filter on

| field | usable | consequence |
| --- | ---: | --- |
| `employment_type` | 39% | the filter hides 61% of the board |
| `experience_level` | 74% | "Security Engineer 2" → unknown |
| `salary_min` | 20% | the salary filter hides 4 in 5 roles |
| `department` | polluted | 179 roles have department = "Ubisoft"; 488 empty |

### A6. Payload

`index.json` is **8.25 MB raw / 0.51 MB gzipped** for 6,053 roles — parsed
synchronously on the phone that loads it.

### A7. Other defects observed

- Identical titles repeat in results (`AI Engineer - FDE` ×3) with nothing to
  tell them apart, because location is buried mid-card.
- No company logos, no skills on the card, no reason-for-match.
- `opens boards.greenhouse.io` is printed next to every Apply button.
- Ranking sorts by `status` first, but all 6,053 roles are `live` — so the
  primary sort key is constant and does nothing.
- Every role scored `high` confidence (6,053/6,053): a signal that never varies.

---

## B. Redesigned information architecture

JobSignal becomes a standalone product surface inside PaddySpeaks, not a
section of the journal.

```
/jobs/                  Search home — search box, popular roles, Fresh 72 entry
/jobs/search/           Results — the working surface
/jobs/job/?id=          Detail — two column, sticky apply panel
/jobs/company/?c=       Employer — roles + hiring activity
/jobs/saved/            Saved · Applied · Interviewing · Offer (local)
/jobs/alerts/           Saved searches
/jobs/methodology/      What "verified" means
/jobs/health/           Pipeline health (noindex)
```

### Product header — replaces the masthead

```
┌──────────────────────────────────────────────────────────────────┐
│  PaddySpeaks ▸ JobSignal          Saved   Alerts   Applications  │
└──────────────────────────────────────────────────────────────────┘
   64 px desktop · 56 px mobile · sticky
```

- `PaddySpeaks` links back to `/`; `JobSignal` is the product mark.
- The journal nav (Philosophy, Sacred Texts, Technology, Testimonials…) does
  not appear. It belongs to the site, not to a job search.
- On results pages the header collapses into a **sticky search bar** on scroll,
  so the query is always editable.

**Chrome budget: 64 px, down from 500 px.** First result target: **above the
fold on both breakpoints** (≤ 420 px desktop, ≤ 560 px mobile).

---

## C. Search architecture

Four stages, all judgement computed in Python at ingest and shipped as data —
the browser scores but never classifies. (Same rule as today, for the same
reason: one implementation, under test.)

```
  query string
      │
      ▼
 ┌──────────────────┐   role, level, location, remote, salary,
 │ 1. Query parser  │──▶ industry, skills, residual text
 └──────────────────┘
      │
      ▼
 ┌──────────────────┐   HARD GATE: candidate set = jobs whose
 │ 2. Family gate   │──▶ role_family == intent family, plus
 └──────────────────┘   adjacent families that pass an evidence test
      │
      ▼
 ┌──────────────────┐   structured predicates: level, location,
 │ 3. Filters       │──▶ remote, salary, freshness, verification
 └──────────────────┘
      │
      ▼
 ┌──────────────────┐   weighted score, threshold, sort
 │ 4. Ranking       │──▶ below threshold → excluded, not down-ranked
 └──────────────────┘
```

**The family gate is the fix.** Today relevance is a similarity score over
tokens; a shared word is enough. In the new model a query resolves to a role
family, and a job that is not in that family (or a genuinely adjacent one) is
**not a candidate at all**. `Sales Engineer` can never appear for
`data engineer`, regardless of token overlap.

### Role families

Assigned at ingest, stored as `role_family` on each record.

| family | canonical members |
| --- | --- |
| `data_engineering` | Data Engineer, Senior/Staff Data Engineer, Data Platform Engineer, Analytics Engineer, ETL Engineer, Data Infrastructure Engineer, Data Architect |
| `data_science` | Data Scientist, Applied Scientist, Research Scientist, ML Scientist |
| `ml_engineering` | Machine Learning Engineer, ML Platform Engineer, AI Engineer, MLOps Engineer |
| `analytics` | Data Analyst, Business Analyst, BI Developer, Analytics Manager |
| `software_engineering` | Software Engineer, Backend, Frontend, Full Stack, Mobile, iOS, Android, SDET |
| `infrastructure` | SRE, Platform Engineer, DevOps, Cloud, Network, Systems, Observability |
| `security` | Security Engineer, Cybersecurity Engineer, Security Analyst, AppSec, Threat Intel, IR |
| `product_management` | Product Manager, Technical PM, Product Owner, Growth PM, AI PM |
| `design_ux` | Product Designer, UX Designer, UX Researcher, UI Designer, Content Designer |

Recognised **in order to exclude** — naming them is what stops them matching:

`sales_engineering` (Sales Engineer, Solutions Architect, Forward Deployed,
Customer Engineer) · `go_to_market` · `marketing_comms` · `people_ops` ·
`support_ops` · `other`

#### Head-noun assignment, not substring

Validating the prototype against real titles exposed a trap:

> `Senior Product Manager - Observability Data Platform` was assigned
> `data_engineering`, because "data platform" appeared anywhere in the string.

Assignment therefore runs against the **role head**, derived by stripping
seniority prefixes and trailing qualifiers:

```
"Senior Product Manager - Observability Data Platform"
  → strip seniority        → "Product Manager - Observability Data Platform"
  → cut at - , ( |         → "Product Manager"
  → match families         → product_management ✓
```

Full-title and department matching remain as a **fallback only** when the head
is ambiguous. Each assignment carries `role_family_confidence`
(`head` > `title` > `context`), and the ranker discounts weaker provenance.

#### Adjacency, with evidence

Adjacency is asymmetric and never free:

| query family | adjacent | penalty | evidence required |
| --- | --- | --- | --- |
| `data_engineering` | `software_engineering` | ×0.55 | ≥2 of spark/kafka/airflow/dbt/snowflake/etl/warehouse in skills or description |
| `data_engineering` | `analytics`, `ml_engineering` | ×0.65 | ≥1 pipeline/warehouse skill |
| `ml_engineering` | `data_science` | ×0.70 | ≥1 of pytorch/tensorflow/llm/model |
| `design_ux` | — | — | never software_engineering |
| `product_management` | — | — | never program/project management without "product" |

`Backend Engineer, Data Platform` is exactly the brief's POSSIBLE case: it
enters as `software_engineering` adjacent to `data_engineering`, at ×0.55, and
only if the description evidences pipeline work.

---

## D. Desktop wireframe

### `/jobs/` — search home

```
┌────────────────────────────────────────────────────────────────────────┐
│ PaddySpeaks ▸ JobSignal                   Saved   Alerts   Applications│ 64px
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│            Find a job worth applying to.                               │  40px semibold sans
│                                                                        │
│   ┌──────────────────────────────┬───────────────────┬──────────┐      │
│   │ 🔍 Job title, skill or company│ 📍 Location       │  Search  │      │  56px tall
│   └──────────────────────────────┴───────────────────┴──────────┘      │
│                                                                        │
│   Verified directly against employer hiring systems.                   │  14px muted
│                                                                        │
│   ⚡Fresh 72   Remote   Entry level   $150K+   Visa   Direct apply      │  pill row
│                                                                        │
│   Popular   Product Manager · Data Engineer · UX Designer ·            │
│             Data Scientist · Cybersecurity · AI Engineer               │
└────────────────────────────────────────────────────────────────────────┘
```

No statistics band. No trust-bar. No marketing copy. Search is the product.

### `/jobs/search/` — results

```
┌────────────────────────────────────────────────────────────────────────┐
│ PaddySpeaks ▸ JobSignal    🔍 data engineer      📍 Remote US   [Search]│ 64px sticky
├────────────────────────────────────────────────────────────────────────┤
│ Date posted ▾  Experience ▾  Remote ▾  Salary ▾  Company ▾  ⚙ More     │ 48px
│ ⌫ Remote ×   ⌫ $150K+ ×   ⌫ Posted < 7 days ×            Clear all     │ chips
├────────────────────────────────────────────────────────────────────────┤
│ Data Engineer                                     Sort: Best match ▾   │
│ 41 verified jobs · Remote, United States · updated 12 min ago          │
│ ─────────────────────────────────────────────────────────────────────  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ⬛  Senior Data Engineer                              ♡           │  │
│  │     Coinbase                                                     │  │
│  │     Remote · United States                    $180K – $240K      │  │
│  │     Python · Spark · Kafka · Snowflake                           │  │
│  │     ● Verified 18m   ·   Posted 2 days ago   ·   Direct apply    │  │
│  │                              [ View details ]  [ Apply at Coinbase ↗ ]│
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  … 24 more, then "Load more" (virtualised beyond 50)                   │
└────────────────────────────────────────────────────────────────────────┘
```

**No permanent left filter column.** Filters are a horizontal bar; everything
else lives in a right-hand drawer behind `⚙ More`.

### Filter drawer (`⚙ More`)

```
  Filters                                            ✕
  ──────────────────────────────────────────────────
  Job type          [Full-time] [Contract] [Intern]
  Experience        [Entry] [Mid] [Senior] [Manager] [Director+]
  Work arrangement  [Remote] [Hybrid] [Onsite]
  Location radius   ( ) 10  (•) 25  ( ) 50  ( ) 100 miles
  Salary            ├────●──────────┤  $150K+
  Industry          ▾
  Company           ▾ (typeahead)
  Company size      ▾
  Visa sponsorship  ☐ mentioned
  Education         ▾
  Security clearance ☐ exclude roles requiring one
  Verification      ☑ verified in last 6h
  Posting age       ▾
  Repost history    ☐ hide previously reposted
  ──────────────────────────────────────────────────
  Clear all                          [ Show 127 jobs ]
```

---

## E. Mobile wireframe (390 px — designed first)

```
┌──────────────────────────────┐
│ ▸JobSignal          ☰        │ 56px sticky
├──────────────────────────────┤
│ 🔍 data engineer         ✕   │ 48px
├──────────────────────────────┤
│ ⚡Fresh  Remote  $150K+  ⚙   │ ← horizontal scroll chips
├──────────────────────────────┤
│ Data Engineer                │
│ 41 verified · updated 12m    │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │ ⬛ Senior Data Engineer  │ │  title 17px semibold
│ │    Coinbase           ♡  │ │
│ │    Remote · US           │ │
│ │    $180K – $240K         │ │
│ │    Python · Spark · Kafka│ │
│ │    ● Verified 18m        │ │
│ │  [ Apply at Coinbase ↗ ] │ │  48px touch target
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ …                            │
└──────────────────────────────┘
│  🔍 Search      ⚙ Filters    │ ← sticky bottom bar
└──────────────────────────────┘
```

First card target: **y ≤ 560 px** (today: 1579 px).
The filter drawer is a full-height sheet, never a reproduced sidebar.

---

## F. Job card design

Visual weight, strictly in the brief's §12 order:

| element | treatment |
| --- | --- |
| 1. Job title | 17–18 px, 600, near-black, the only strong element |
| 2. Company | 15 px, 500, muted, with 36–40 px logo tile |
| 3. Location · Salary | 14 px, regular; salary right-aligned, tabular numerals |
| 4. Matching skills | 13 px chips, **only skills that matched the query** |
| 5. Freshness | 13 px, `Posted 2 days ago`; `⚡Fresh 72` earns a badge |
| 6. Verified | 13 px, small green dot + `Verified 18m`, clickable → popover |
| 7. Apply | primary button, `Apply at Coinbase ↗` |

Removed: `opens boards.greenhouse.io` (the button names the destination);
uppercase mono metadata; the coloured status pill; the per-card repost banner
(moves into the verification popover unless reposts ≥ 2).

**Logos**: `https://logo.clearbit.com/{company_domain}` with a lazy `<img>`,
falling back to initials on a neutral tile. `company_domain` is already stored
and verified. No logo is fetched at ingest; no third-party script is added.

### Verification popover (progressive disclosure, §20)

```
  ● Verified
  ────────────────────────────
  Employer        Coinbase
  Source          Employer career system (Greenhouse)
  Last checked    18 minutes ago
  First observed  Sep 19
  Employer posted Sep 19
  Requisition     82715
  Reposts         None detected
  ────────────────────────────
  How verification works →
```

### Match explanation (§14)

Shown on the detail page and on hover/expand in results — never fabricated,
derived only from job content and the user's own query:

```
  Strong match
  ✓ Data engineering role
  ✓ Python, Spark, Snowflake
  ✓ Remote
  ✓ Senior
  ○ Kafka — not mentioned in this posting
```

A percentage is deliberately **not** shown. A "92% match" implies a precision
the data does not support, and this product's whole argument is against
numbers that look more certain than they are.

---

## G. Ranking algorithm

Candidates have already passed the family gate and structured filters.

```
score = 0.40 · title_match
      + 0.25 · role_match
      + 0.15 · skills_match
      + 0.08 · freshness
      + 0.07 · verification
      + 0.05 · location_match
```

| component | definition |
| --- | --- |
| `title_match` | 1.00 exact head match (`Data Engineer`); 0.85 head + seniority (`Senior Data Engineer`); 0.70 canonical member (`Analytics Engineer`); 0.45 head present with other qualifiers; 0 otherwise |
| `role_match` | 1.00 same family via `head`; 0.85 via `title`; 0.60 via `context`; adjacency penalty applied (§C) |
| `skills_match` | &#124;query skills ∩ job skills&#124; / &#124;query skills&#124;; 0.5 neutral when the query names none |
| `freshness` | 1.0 < 72 h; 0.8 < 7 d; 0.6 < 30 d; 0.35 < 60 d; 0.15 beyond — from `posted_at_original`, else `first_seen_at` |
| `verification` | 1.0 ≤ 6 h; 0.7 ≤ 24 h; 0.4 older; 0 unverified |
| `location_match` | 1.0 exact city / requested remote; 0.7 same region; 0.4 same country; 0 mismatch |

**Weights are a starting point, tuned against the acceptance tests in §I —
not shipped blind.**

### Hard rules above the score

1. **Level filter, not penalty.** When the query states a level, roles at other
   levels are excluded. `entry level product manager` cannot return
   `Director of Product` at any score (§26 TEST 2).
2. **Threshold.** `score < 0.35` → excluded. Zero results with an explanation
   beats 500 junk results (§16).
3. **Location is a filter when named.** `data engineer pittsburgh` does not
   silently include Remote; it offers it (§17, §26 TEST 5).
4. **Nothing purchasable enters this function.** No sponsorship parameter
   exists — the absence is structural, as in the current `confidence.py`.

### Sort tabs

`Best match` (default) · `Newest` (by `posted_at_original`) · `⚡Fresh 72` ·
`Highest salary` (salary-disclosed only, stated in the empty state).

---

## H. Query understanding

`"remote senior data engineer fintech 180k"` →

```json
{
  "role_family": "data_engineering",
  "level": "senior",
  "remote": true,
  "industry": "fintech",
  "min_salary": 180000,
  "skills": [],
  "residual": ""
}
```

Parsed left to right, longest match first, each matched span consumed:

| signal | patterns |
| --- | --- |
| level | `intern`, `new grad`/`entry`/`junior`, `mid`, `senior`/`sr`, `staff`/`principal`, `manager`/`lead`, `director`/`VP`/`head of` |
| remote | `remote`, `wfh`, `work from home`, `distributed`; `hybrid`; `onsite`/`in office` |
| salary | `150k`, `$150k`, `150,000`, `over 150k`, `180k+` |
| location | gazetteer of cities/regions/metros + aliases (`bay area`, `NYC`, `SF`) |
| industry | fintech, healthtech, gaming, ecommerce, security, devtools… |
| skills | the existing `SKILL_VOCAB`, matched as whole tokens |
| role | the family matcher, on the residual |

### Abbreviations (§8) — narrow by construction

`PM → product_management` · `TPM → technical program/product manager` ·
`SWE → software_engineering` · `DE → data_engineering` ·
`ML → ml_engineering` · `UX → design_ux` · `cyber → security` ·
`new grad → level:entry`

Expansion maps to **a family**, not to a bag of synonym tokens. This is why it
cannot flood results the way today's `SYNONYMS` does: `PM` selects one family,
it does not add the word "manager" to a token soup.

### Spelling

Damerau-Levenshtein ≤ 1, applied **only to the role head against family
member names** (`prodcut manager` → `product manager`), never to free tokens.
Words under 5 characters are never fuzzy-matched — that is what turns
`designer` into `engineer`.

### Autocomplete (§7)

Served from a precomputed `suggest.json` (roles, companies, skills, each with
a live count), ≤ 8 suggestions, debounced 120 ms, grouped:

```
  data eng│
  ─────────────────────────────────
  ROLES     Data Engineer            41
            Senior Data Engineer     18
            Data Platform Engineer    9
            Analytics Engineer        7
  COMPANIES Databricks              874
            Snowflake                 —  (source currently failing)
  SKILLS    Spark · Snowflake · dbt
```

### Zero results (§17) — never silently broadened

```
  No verified Staff Data Engineer roles within 25 miles of Pittsburgh.

  [ Include Remote (34) ]
  [ Expand to 50 miles (6) ]
  [ Include Senior Data Engineer (18) ]

  Each option says exactly what it adds. Nothing widens on its own.
```

---

## I. Relevance acceptance tests

Executable, run in CI against the **live committed index**, so a corpus change
that degrades relevance fails the build. New file:
`jobsignal/tests/test_relevance.py`.

| # | query | assertion |
| --- | --- | --- |
| 1 | `data engineer` | ≥ 90% of top 20 in `data_engineering`; **zero** results from `sales_engineering`, `security`, `go_to_market`; `Frontend Engineer` absent |
| 2 | `entry level product manager` | no result with level ∈ {senior, staff, manager, director_plus}; all in `product_management` |
| 3 | `ux designer` | ≥ 90% of top 20 in `design_ux`; zero `software_engineering` |
| 4 | `remote cybersecurity` | all in `security`; all `remote_status == remote` |
| 5 | `data engineer pittsburgh` | every result Pittsburgh-located; remote excluded unless opted in; the broadening affordance is offered |
| 6 | `engineer` (bare) | does **not** return the whole board; either asks to disambiguate between families or returns the threshold-passing subset, and never exceeds 200 results |
| 7 | `prodcut manager` | resolves to `product_management` (typo tolerance) |
| 8 | `PM` | resolves to `product_management`, not to every title containing "manager" |
| 9 | any query | no result below the 0.35 threshold appears |
| 10 | precision floor | for each of tests 1–4, measured precision@20 ≥ 0.85 |

**Current baseline for test 1: 3.6% precision, 3,139 results.**
**Target: ≥ 85% precision@20, ~41 results.**

---

## Corpus and field work this depends on

Relevance cannot be fixed in the browser alone. Landing with the redesign:

1. **Curation** — publish only target families. 6,053 → ~1,931 roles (−68%),
   and `index.json` roughly 8.25 MB → ~2.5 MB raw.
2. **`role_family` + `role_head` + `role_family_confidence`** on every record.
3. **Field repair** — `employment_type` (61% unknown), `experience_level`
   ("Engineer 2", "L5"), `department` (drop when it equals the company name).
4. **Index diet** — the search index carries only what search and the card
   need; description, requirements and history stay in the detail shards.
   Target ≤ 200 bytes/role.
5. **`suggest.json`** — precomputed autocomplete source.

Employer selection matters as much as role filtering: Bosch (500) and Ubisoft
(305) contribute mostly non-technical requisitions. Recommendation — keep them,
since curation removes the noise, and revisit if they crowd the index.

---

## Deliberate deviations from the brief

Stated plainly rather than quietly skipped:

| brief | decision | why |
| --- | --- | --- |
| §23 server-side search | **Client-side over a trimmed index for now** | The site is static on GitHub Pages; a server needs the Worker + D1. At ~1,900 curated roles a gated linear scan is ~5 ms, well inside the 500 ms target. `docs/JOBSIGNAL.md` §2 already defines the migration trigger — revised down to **> 15k roles or > 1.2 MB gzipped**, since measured density is worse than projected. |
| §14 "92% MATCH" | **Qualitative match, no percentage** | A number implies precision the data cannot support, and contradicts this product's own argument. The checklist is kept. |
| §25 analytics | **Phase 2** | Needs the Worker route. The `Not relevant` control ships disabled-with-explanation rather than pretending to record. |
| §13 logos | **Clearbit with initials fallback** | No logo asset pipeline, no third-party JS; a failed load degrades to the tile. |

---

## Component inventory (§30)

`ProductHeader` · `JobSearchBar` · `SearchAutocomplete` · `FilterBar` ·
`FilterChip` · `FilterDrawer` · `ResultsToolbar` · `JobCard` · `CompanyLogo` ·
`VerificationBadge` · `VerificationPopover` · `FreshnessBadge` ·
`MatchExplanation` · `SaveButton` · `ApplyButton` · `EmptyState` ·
`ZeroResultsBroadening` · `SearchSkeleton`

Vanilla ES5-safe JS with the existing `JSDom.el` builder, one module per
component under `jobs/js/ui/`. No framework, no build step — consistent with
the rest of the site. No component exceeds ~150 lines; there is no
search-page god module.

---

## Accessibility (§29)

- WCAG AA verified with a computed-contrast audit over every text node, the
  same method used for the Data Lab dashboards (`scratchpad/contrast.mjs`).
- Status never by colour alone: `● Verified` pairs dot + text; `⚡Fresh 72`
  pairs glyph + text.
- Full keyboard path: `/` focuses search; `↑↓`/`Enter`/`Esc` drive
  autocomplete; the drawer traps focus and restores it on close.
- Filters are real `<fieldset>`/`<legend>` with visible focus rings.
- Results region is `aria-live="polite"`; the count is announced on change.

---

## Suggested build order

1. Pipeline: role families, curation, field repair, index diet, `suggest.json`
2. `test_relevance.py` — write the acceptance tests **before** the new ranker
3. Search core: query parser, family gate, ranker (tune weights against 2)
4. Product header + search home
5. Results: toolbar, filter bar, drawer, card, skeletons
6. Detail page two-column + sticky apply
7. Autocomplete, zero-results broadening, verification popover
8. Accessibility audit, mobile pass, performance measurement

Stages 1–3 are where the user-visible win is: they are what turns 3.6%
precision into a usable search. Stages 4–6 are what stop it looking like a blog.
