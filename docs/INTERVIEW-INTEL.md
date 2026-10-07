# Interview Intelligence — the interview question discovery engine

> **Promise:** an interview intelligence engine, not a LinkedIn mirror —
> built on existing infrastructure, with no new service and no new spend.
> We organise interview knowledge people have shared publicly. We keep the
> link, never the post; we never invent a question, a company or a date; and
> nothing reaches the site until a person has approved it.

Read this before touching `interviewintel/`, `interview.app/reported/` or
`admin/interview-discovery/`.

| Path | What it is |
| --- | --- |
| `interviewintel/pipeline/` | The pipeline (Python 3.12 stdlib; the `anthropic` SDK is imported only by `llm.py`) |
| `interviewintel/pipeline/feeds.py` | The free sources: community form, Hacker News, Stack Exchange, DEV, Medium |
| `interviewintel/data/ledger.json` | **The interview database**: canonical questions and every report of them, any status |
| `interviewintel/data/seen.json` | Every URL ever processed, and why it was or wasn't used |
| `interviewintel/data/health.json` | What the last run did |
| `interviewintel/decisions/*.json` | Review decisions, one file per batch, applied once |
| `interview.app/reported/` | Public pages: questions, trending, companies, how it works |
| `interview.app/reported/data/` | Public JSON — **approved material only** |
| `admin/interview-discovery/` | The review page (`noindex`) and `queue.json` |
| `.github/workflows/interview-intel.yml` | Weekly run; also runs (publish mode) when a decision file or the pipeline code is pushed |
| `interviewintel/tests/test_pipeline.py` | The guardrails (also in Validate Content) |

## Cost: existing infrastructure only

At the owner's request (2026-10-07) this runs on what PaddySpeaks already has:

| Need | What it uses | New cost |
| --- | --- | --- |
| Sources | Free, keyless public APIs and feeds + the existing community form's published sheet | none |
| Judgement | The existing `ANTHROPIC_API_KEY`, on **Claude Haiku 4.5** (the model the other question bots use) | cents per run |
| Compute | GitHub Actions, **weekly** (+ on each pushed decision file) | none |
| Hosting | GitHub Pages | none |

Per-run caps (`config.py`): ≤ 30 classifications, ≤ 15 extractions, ≤ 10
tie-breaks, ≤ 10 enrichments, ≤ 60 requests to the free APIs, ≤ 4,000
characters of source text per model call. Community-form rows skip the
classifier entirely, and the free-source prefilter drops anything that is not
about an interview before a model reads it. Each URL is read by a model once,
ever (`seen.json`). At Haiku's list price ($1 / $5 per million input / output
tokens) a full-cap run is roughly 150k input and 60k output tokens — about
$0.45, and a typical run far less. `health.json` (and the review page) records
the calls and tokens of every run, so the real figure is visible.

No paid search API is used. Adapters for Exa, Tavily, Brave and Google CSE
remain in `providers.py`, dormant: they run only if someone sets
`INTEL_SEARCH_PROVIDER` and a key, and the workflow passes neither (a test
checks). A larger model can be chosen with `INTEL_MODEL` — also a cost decision.

## Sources

| Source | How it is read | Why it is allowed |
| --- | --- | --- |
| Community form (`/interview.app/submit/`) | Its published CSV — the same one `ingest_submissions.py` reads | Candidates submit questions to PaddySpeaks to be published; the name column is never read |
| Hacker News | `hn.algolia.com/api/v1/search_by_date` | Public, documented, keyless API |
| Stack Exchange | `api.stackexchange.com/2.3/search/advanced` (Stack Overflow, Software Engineering, Data Science, Cross Validated) | Public API, keyless quota; content CC BY-SA, so we link to it |
| DEV | `dev.to/api/articles` by tag | Public, documented, keyless API |
| Medium | `medium.com/feed/tag/<tag>` | Public RSS feeds |

**LinkedIn** has no free public API or feed, and we never visit it. A
LinkedIn interview experience reaches PaddySpeaks when its author submits it
through the community form — the organic route, with consent.

## Architecture

```
FREE SOURCES          feeds.py       community form · HN · Stack Exchange · DEV · Medium
  ↓                                  (optional, off: providers.py paid search APIs)
URL DISCOVERY         discover.gather  canonical URL, de-duplicated across sources
  ↓                   sources.py     blocked domains, source type, personal data
SOURCE FILTER                        scrubbed, repost fingerprint (class E)
  ↓                   classify_rules.py (free prefilter: must be about an interview)
AI CLASSIFIER         + llm.classify A first-person · B list · C advice · D promo · E dup · F irrelevant
  ↓                                  (community rows are class A without a call)
QUESTION EXTRACTOR    llm.extract    questions WITH verbatim evidence spans
  ↓                   extract.py     evidence must be in the source; attribution needs its own
NORMALIZER                           evidence + an interview cue; copying flagged
  ↓                   dedupe.py      lexical similarity; borderline pairs → llm.same
SEMANTIC DEDUPLICATION
  ↓                   normalize.py   companies, roles, stages, categories, technologies
COMPANY/ROLE/TOPIC CLASSIFICATION
  ↓                   confidence.py  a computed score with its breakdown
CONFIDENCE SCORE
  ↓                   ledger.json (pending) → queue.json → /admin/interview-discovery/
ADMIN REVIEW                         → decisions/*.json → review.py
  ↓                   enrich.py      AI preparation material for approved questions only
PADDYSPEAKS INTERVIEW DATABASE
  ↓                   publish.py     questions.json · trending.json · intel.json
INTERVIEW PRACTICE UI                /interview.app/reported/ (formats and filters only)
```

**Modularity.** A new source is a class in `feeds.py` (free) or
`providers.py` (paid, optional) with one method, `collect(today, errors)`. Neither touches the ledger,
whose shape is source-independent: a report is (URL, what the source supports,
review status), and a question is the canonical practice question. All
judgement lives in Python and ships as data; the JavaScript formats and
filters (the JobSignal rule — one implementation of every judgement).

## The rules (each is a test)

1. **No crawling, no LinkedIn access, no login, no new spend.** `http.py` talks
   only to the hosts in `ALLOWED_HOSTS` — the free APIs and feeds above (on
   `dev.to`, `medium.com` and `docs.google.com` only their API / feed paths)
   and the dormant paid search APIs; nothing else opens a connection; there
   is no cookie handling. A source's web page is never fetched. Pages behind a
   login (Glassdoor, Blind), job boards and personal profiles
   (`linkedin.com/in/`) are blocked domains.
2. **Never invent a question.** The model must quote a verbatim span of the
   source for every question; `extract.check` drops the question when that
   span is not in the source text.
3. **Never invent an attribution.** Company, role and stage each need their own
   verbatim span, which must be in the source and name the thing attributed.
   A company also needs an interview cue in its span ("interview", "onsite",
   "asked", "round"…): "I use Google Sheets" is a mention, not attribution.
   A year must appear in the source. Anything that fails becomes UNKNOWN, and
   the reason goes into the report's notes for the reviewer.
4. **Transform, do not copy.** The practice question is a rewrite; one that
   shares more than `COPY_RUN_LIMIT` (10) consecutive words with its source is
   flagged `too_close_to_source` and loses 10 confidence points. Evidence spans
   are capped at 200 characters, kept for the reviewer, and **never published**.
5. **No personal data.** Emails, phone numbers, @handles and links are scrubbed
   before any text is sent to the model or stored. Social-post titles (which
   carry the author's name) are replaced with "Public LinkedIn post"; bylines
   are stripped from other titles. Provider author fields are dropped in the
   source parser (authors, usernames, the form's name column). A practice
   question containing personal data is rejected.
6. **Auto-approval at 70+, everything else reviewed.** Discovery writes
   `pending` reports. On every run, `review.auto_publish` approves pending
   reports scoring ≥ `AUTO_PUBLISH_MIN_CONFIDENCE` (70: the strong and clear
   bands — the owner's decision, 2026-10-07) that carry **no flag** and **no
   possible duplicate**; it never goes below 50. Everything else waits for a
   person. Auto-approved reports are listed on the review page
   (*Auto-approved, live*) and can be unpublished there (a `reject` decision);
   a rejection is final. Only approved reports of approved questions reach
   `interview.app/reported/data/`.
7. **Three kinds of text, always labelled.** *Reported in an interview* / *From
   a public question list* (source-derived) · *PaddySpeaks practice question*
   (our rewrite) · *AI-generated* preparation material and *AI-generated similar
   question*. Enrichment that claims to come from the candidate or interviewer
   is rejected (`enrich.CLAIMS`).
8. **No seeded questions, ever.** The board shipped empty and fills from reviewed
   runs. Test data never reaches the ledger.
9. **Old questions are kept.** Nothing is deleted; questions are labelled
   RECENT, RECURRING or HISTORICAL.

## Data model

`ledger.json`:

```
questions[q-…]  id, title, question, concept_key, category, subcategory, difficulty,
                technology[], status (pending|approved|rejected|merged), merged_into,
                created, edited, prep (AI material) | null, prep_for (hash of the text it was written for)
reports[r-…]    id, question_id, status (pending|approved|rejected),
                url, source_type, source_title, source_date, discovered, last_seen, provider, query,
                classification{class, reason, seo_list, selling_course, recruiting_ad, states_specific_questions},
                proposed{question, title, concept_key, category, subcategory, difficulty, technology},
                asked_in_interview, evidence,
                company, company_name, company_evidence, role, role_name, role_evidence,
                interview_stage, stage_evidence, interview_year,
                confidence, confidence_parts[], band, flags[], notes[],
                possible_duplicates[], bank_matches[], decided_at, decided_by, decision_note
applied_decisions[]  decision files already applied
```

The brief's per-question record maps onto this: `source_url/title/date/type`,
`discovered_date`, `confidence`, `verification_status` (= report `status`) and
`notes` live on the report; the rest on the question. Published questions add
`companies_reported`, `roles_reported`, `interview_stages`, `years`,
`source_count` (distinct public sources, all time), `reported_frequency`
(approved reports dated in the last 90 days), `first_seen`, `last_seen`,
`latest_source_date` and `freshness`.

## Confidence (computed, never asked of the model)

| Fact | Points |
| --- | --- |
| class A (first-person) / B (list) / D (promo with specific questions) | 60 / 50 / 35 |
| the source says it was asked in an interview | +15 |
| company / role / stage attributed with evidence | +8 / +6 / +4 |
| source date known / interview year stated | +4 / +3 |
| mass-produced list, sells a course, too close to the source | −10 each |

90–100 clear · 70–89 strong, some metadata missing · 50–69 needs review ·
below 50 never auto-published · below 30 not queued at all.

## Deduplication

`normalize.similarity` = mean of Jaccard and containment over content words
(stopwords like "write a query to find" removed, synonyms folded: *highest →
max*, *salaries → salary*, *orders → purchase*…), taking the better of the
question text and the model's `concept_key`.

* ≥ 0.86 and same category → the report attaches to the existing question.
* 0.55–0.86 → the model is asked whether they test the same problem
  (`llm.same`, capped per run). Yes → attach. No, or no model → shown to the reviewer
  as a possible duplicate with a one-click merge.
* "Find the second highest salary" and "Write SQL to return the employee with
  the second-highest salary" score 0.875 and group; "second" vs "third highest"
  goes to the tie-break. Both are tests.

Matches against the existing 1,500-question bank are recorded as information
("Already in the Question Bank") and power "Practice similar".

## Review

`/admin/interview-discovery/` reads `queue.json` and shows, per pending report:
the practice question (and what this report proposed, if it attaches to an
existing question), company / role / stage each with its quoted evidence, the
original source, the classifier's reason, the confidence and its breakdown,
flags, extraction notes, possible duplicates and bank matches.

Actions: **Approve**, **Edit** (approve with edits), **Reject**, **Merge
duplicate** — one at a time, or in bulk: tick reports (or **Select all**,
**Select none**, **Select 70+**) and **Approve / Reject selected**. The
*Auto-approved, live* tab lists what was published automatically, with
**Unpublish** (single or bulk). The page cannot change the site. Decisions are drafted in the
browser (`ps-intel-review-draft`), then **Commit decisions on GitHub** opens
GitHub's new-file page with the decision file filled in (or download it and
commit it). The push runs the workflow in `publish` mode, which applies the
file, writes AI material for newly approved questions and republishes. The
authority to publish is the authority to commit, and `git log` names the
reviewer.

The queue is a committed file in a public repository: it contains only
rewritten questions, public URLs, short evidence quotes and our metadata —
never personal data (rule 5). If private review ever becomes necessary, the
queue moves behind the Worker and D1 (the testimonials pattern); the ledger
shape does not change.

## Freshness, trends and company intelligence

* **RECURRING**: ≥ 3 approved reports spanning ≥ 90 days, the latest within a
  year. **RECENT**: latest report within 90 days. Otherwise **HISTORICAL**.
* A report's date is the source's date when the provider gives one, else the
  date we found it.
* **Trending** (7 / 30 / 90 days) counts approved reports per topic
  (subcategory, else category) against the previous window of the same
  length; a topic needs at least 2 reports in the window. Labelled
  "Questions appearing in recently discovered public interview reports."
* **Company intelligence** (`intel.json`): per company and per company × role —
  topics, categories, difficulty, stages, skills, recently reported questions,
  topics new in the last 30 days. **Percentages only from 20 reports up**;
  below that, counts. The fifteen featured companies always have a page, empty
  until reports arrive. Labelled as publicly discovered reports, not official
  company information.

## Running it

```bash
python3 -m interviewintel.tests.test_pipeline           # guardrails, no network
python3 -m interviewintel.pipeline.run plan             # which sources this run reads
python3 -m interviewintel.pipeline.run publish          # decisions → enrich → publish
python3 -m interviewintel.pipeline.run all              # + discovery from the free sources
```

Configuration: the existing `ANTHROPIC_API_KEY` secret, nothing else. Optional
environment: `INTEL_SOURCES` (comma list; default all five free sources),
`INTEL_MODEL` (default `claude-haiku-4-5`), `INTEL_COMMUNITY_CSV`. Without the
key, sources are still read but nothing is classified, extracted or enriched;
those URLs are retried on the next run with a key, never guessed at.

Model calls use the official `anthropic` SDK with structured outputs
(`output_config.format`, JSON schemas in `prompts.py`). Source text is fenced
as untrusted data. On a larger model (only if `INTEL_MODEL` is changed) the
calls also set effort and the server-side refusal fallback.

## Known limits

* The free sources were not reachable from the build environment, so their
  parsers are tested against the APIs' documented response shapes, not live
  responses. The first run's `interviewintel/data/health.json` shows any
  per-source error; one failed request never sinks a run, and a run in which
  every source failed exits 1 and commits nothing.
* Free sources skew to engineers who write in public (HN, Stack Exchange, DEV,
  Medium). Coverage of a given company or role grows mostly through the
  community form; the company pages say so by showing counts, not shares,
  until 20 reports.
* Similarity is lexical with a model tie-break, not embeddings. An embedding
  backend can replace `normalize.similarity` without touching the ledger.
