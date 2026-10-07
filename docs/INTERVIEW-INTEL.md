# Interview Intelligence — the interview question discovery engine

> **Promise:** an interview intelligence engine, not a LinkedIn mirror.
> We organise interview knowledge people have shared publicly. We keep the
> link, never the post; we never invent a question, a company or a date; and
> nothing reaches the site until a person has approved it.

Read this before touching `interviewintel/`, `interview.app/reported/` or
`admin/interview-discovery/`.

| Path | What it is |
| --- | --- |
| `interviewintel/pipeline/` | The pipeline (Python 3.12 stdlib; the `anthropic` SDK is imported only by `llm.py`) |
| `interviewintel/data/ledger.json` | **The interview database**: canonical questions and every report of them, any status |
| `interviewintel/data/seen.json` | Every URL ever processed, and why it was or wasn't used |
| `interviewintel/data/health.json` | What the last run did |
| `interviewintel/decisions/*.json` | Review decisions, one file per batch, applied once |
| `interview.app/reported/` | Public pages: questions, trending, companies, how it works |
| `interview.app/reported/data/` | Public JSON — **approved material only** |
| `admin/interview-discovery/` | The review page (`noindex`) and `queue.json` |
| `.github/workflows/interview-intel.yml` | Daily run; also runs when a decision file is pushed |
| `interviewintel/tests/test_pipeline.py` | The guardrails (also in Validate Content) |

## Architecture

```
SEARCH API            providers.py   Exa · Tavily · Brave · Google CSE (one adapter each)
  ↓                   queries.py     LinkedIn site: searches + first-person web searches +
URL DISCOVERY                        COMPANY × ROLE × TECH/TYPE × YEAR, rotated per run
  ↓                   sources.py     canonical URL, blocked domains, source type,
SOURCE FILTER                        personal data scrubbed, repost fingerprint (class E)
  ↓                   classify_rules.py + llm.classify
AI CLASSIFIER                        A first-person · B list · C advice · D promo · E dup · F irrelevant
  ↓                   llm.extract    questions WITH verbatim evidence spans
QUESTION EXTRACTOR
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

**Modularity.** A new search provider is a class in `providers.py`; a new kind
of source needs at most a line in `sources.py`. Neither touches the ledger,
whose shape is source-independent: a report is (URL, what the source supports,
review status), and a question is the canonical practice question. All
judgement lives in Python and ships as data; the JavaScript formats and
filters (the JobSignal rule — one implementation of every judgement).

## The rules (each is a test)

1. **No crawling, no LinkedIn access, no login.** `http.py` talks only to the
   search providers' API hosts; nothing else opens a connection; there is no
   cookie handling. We read only what a provider returns for a query. Pages
   behind a login (Glassdoor, Blind), job boards and personal profiles
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
   adapter. A practice question containing personal data is rejected.
6. **Nothing unreviewed is public.** Discovery writes `pending` reports. Only
   approved reports of approved questions reach `interview.app/reported/data/`.
   Auto-publishing exists but is off (`AUTO_PUBLISH_MIN_CONFIDENCE = None`) and,
   when switched on, never applies below 50 or to a flagged or possibly-duplicate
   report.
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
  (`llm.same`, budgeted). Yes → attach. No, or no model → shown to the reviewer
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
duplicate**. The page cannot change the site. Decisions are drafted in the
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
INTEL_TODAY=2026-10-07 python3 -m interviewintel.pipeline.run plan   # this run's searches
python3 -m interviewintel.pipeline.run publish          # decisions → enrich → publish
python3 -m interviewintel.pipeline.run all              # + discovery (needs keys)
```

Configuration (GitHub Actions): secrets `ANTHROPIC_API_KEY` and one provider's
key — `EXA_API_KEY`, `TAVILY_API_KEY`, `BRAVE_SEARCH_API_KEY`, or
`GOOGLE_CSE_KEY` + `GOOGLE_CSE_CX`; repository variables
`INTEL_SEARCH_PROVIDER` (default `exa`) and `INTEL_MODEL` (default
`claude-opus-5-5`). A missing key skips its stage; it never fakes one. Bing Web
Search is not offered (Microsoft retired the Bing Search APIs in 2025).

Model calls use the official `anthropic` SDK with structured outputs
(`output_config.format`, JSON schemas in `prompts.py`), the server-side refusal
fallback, and per-call effort (classifier `low`; extraction, tie-break and
enrichment `low`/`medium`). Source text is fenced as untrusted data.

**Cost per daily run** (budgets in `config.py`): ≤ 24 searches, ≤ 60
classifications, ≤ 30 extractions, ≤ 20 tie-breaks, ≤ 15 enrichments. Each URL
is classified once, ever (`seen.json`).

## Known limits

* The search adapters follow each provider's public API reference but were not
  exercised against the live APIs when this was built (no keys in the build
  environment). The first run's `health.json` will show any request-shape
  error per query; one failed query never sinks a run.
* LinkedIn content is only as complete as the provider's index of it. Brave and
  Google return snippets only, which often hold too little to support a
  question; Exa and Tavily return page text and are the better fit.
* Similarity is lexical with a model tie-break, not embeddings. An embedding
  backend can replace `normalize.similarity` without touching the ledger.
