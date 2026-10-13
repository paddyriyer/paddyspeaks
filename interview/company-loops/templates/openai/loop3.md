# OpenAI · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of an AI model
provider. Every workload, number, price and schema is hypothetical. Format:
docs/COMPANY-INTERVIEW-LOOPS.md.

## OAI-L3-01: Usage metering and billing data model

| | |
|---|---|
| **Template ID** | OAI-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / effective-dated prices, credits, invoice facts |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer |

```params
{
  "orgs": {"1": ["20 000", "60 000"], "2": ["250 000", "600 000"], "3": ["1.5 million", "4 million"]},
  "skus": [25, 60, 140],
  "daily_lines": {"1": ["40 million"], "2": ["400 million"], "3": ["3 billion", "8 billion"]},
  "currencies": ["US dollars only", "US dollars, euros and yen"]
}
```

**Business Scenario.** A model API bills about {{orgs}} organizations. An organization owns projects; a project owns API keys; every request is made with one key. Usage is priced per SKU: a model with a unit such as input tokens, cached input tokens, output tokens, images or audio seconds. There are about {{skus}} SKUs across several model families, and list prices change several times a year, sometimes for one SKU in the middle of a month. Organizations receive credits (promotional and prepaid) and a monthly free-tier allowance on some SKUs, and are invoiced monthly in {{currencies}}. The metering pipeline produces about {{daily_lines}} usage records a day.

**Problem Statement.** Design the data model behind metering and billing: (1) the transactional (system-of-record) model that prices usage, applies free-tier allowances and credits, and issues invoices; (2) the analytical (warehouse) model finance and product teams query. Name every entity with its keys, state the grain of every fact table, show how a price change takes effect, and explain how an invoice issued last month can be reproduced exactly, line by line, a year from now.

**Constraints.** An issued invoice is never edited; corrections must be visible as corrections. Money is never stored as a binary float. Any usage record must be traceable to the price row that rated it. Analysts must be able to answer "what did organization X spend on model family Y last quarter" without reading raw usage records.

**Assumptions.** All counts, prices and volumes are hypothetical. The usage record already carries a unique request id, the key, the SKU, the quantity and the UTC event time; deduplication of usage happens upstream.

**Clarifications.**
- Q: Can a project move to a different organization? | A: Yes, rarely (after an acquisition). Usage before the move belongs to the old organization.
- Q: When a price changes mid-month, which price applies? | A: The price in effect at the request's event time; a month can contain both prices.
- Q: In which order are free tier, credits and paid usage applied? | A: Free-tier allowance first, then credits, then the remainder is billed. State the order in your model.
- Q: Do credits expire? | A: Yes. Each grant has an expiry date; unused credit is lost at expiry.
- Q: Can a price differ per organization? | A: Most organizations pay list price; a few enterprise contracts have negotiated rates with their own effective dates.

**Hints.**
1. Separate the facts that happened (a request consumed N units) from the decisions applied to them (which price, which allowance, which credit).
2. A price is a fact about time: give it an effective_from and a way to find the row in effect at any instant, and never update a price row in place.
3. Credits behave like a ledger of grants, consumptions and expiries, not like a balance column.

**Follow-ups.**
1. Finance asks for revenue by model family by day. Which table answers it, at what grain, and how do you keep it consistent with the invoices?
2. A negotiated rate is signed today but backdated to the start of the month. What changes in your model, and what happens to invoices already issued?
3. A key is reassigned from one project to another mid-month. Show how usage before and after the move is attributed, in both the transactional and the analytical model.
4. At {{daily_lines}} records a day, which tables are partitioned and clustered how, and which aggregates do you precompute? What keeps the precomputed aggregates correct when a late record arrives?
5. A regulator asks you to prove that every invoiced amount came from metered usage at a published price. What query or artifact produces that proof?

**Follow-up rules.**
- when: scd2, scd type 2, valid_to, effective_to → ask: Two price rows for one SKU overlap by one hour because of a data-entry error. What does your model do at request time, and what constraint would have stopped it?
- when: balance, credit_balance, remaining credit → ask: Two invoices consume credit from the same grant at the same moment. How does a balance column stay correct, and how would a ledger change that?
- when: float, double → ask: What goes wrong when you sum a billion small amounts held as binary floats, and what type would you use instead?
- when: join to current price, latest price, current_price → ask: A price was cut on the 15th. What does your query charge for usage on the 3rd?
- when: star schema, fact table, dimension → ask: Which of your dimensions change over time, and which SCD type does each one get?

**Production Reality Check.**
- A price cut for one SKU was entered with effective_from at local midnight instead of UTC midnight. For the first 8 hours of the month that SKU was rated at the old price, and invoices for several thousand of the {{orgs}} organizations have already been issued.
- An enterprise customer disputes an invoice: the dashboard shows 3% less spend than the invoice for the same month. The dashboard reads the warehouse; the invoice was generated from the transactional model.
- A metering replay delivers one hour of usage records a second time, and the duplicates reach the rating step for a subset of the {{daily_lines}} daily records.

**Evaluation Criteria.** Clean separation of usage, pricing, allowances, credits and invoices; effective-dated, non-overlapping price rows with half-open intervals; rated lines carry the applied price id; credits as an append-only ledger with expiry; immutable invoices with adjustment lines; facts with explicitly stated grains; SCD choices justified for organization, project and key; decimal or minor-unit money; handles each incident with diagnosis, correction and prevention.

## OAI-L3-02: Event schema and data contract for multimodal requests

| | |
|---|---|
| **Template ID** | OAI-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data contracts / schema evolution, privacy tiers |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, ai-infra-engineer, ml-platform-engineer |

```params
{
  "modalities": ["text and image inputs", "text, image and audio inputs", "text, image and audio inputs and audio outputs"],
  "consumers": [6, 15, 30],
  "daily_events": {"1": ["200 million"], "2": ["2 billion"], "3": ["15 billion"]},
  "producers": [3, 8]
}
```

**Business Scenario.** A model API accepts requests made of ordered parts: {{modalities}}. Each request produces a telemetry event that {{consumers}} downstream teams consume: billing, capacity planning, product analytics, reliability and safety operations. {{producers}} services emit these events (gateways in different regions, a batch endpoint, a realtime endpoint), written in different languages and released on different schedules. About {{daily_events}} events a day.

**Problem Statement.** Design the event schema and the data contract. Show the envelope and the per-part structure, with types and units. Classify every field into privacy tiers and say which tiers may enter the analytics platform, which stay in the serving path, and which are never stored. Define the versioning and compatibility rules, how a producer proves it honours the contract before release, and what happens at runtime to an event that breaks it.

**Constraints.** Request and response content (text, image bytes, audio, transcripts, file names) must never be written to telemetry. Consumers upgrade on their own schedules, so a new producer version must not break an old consumer. Billing needs per-part units exactly; other consumers can tolerate sampling.

**Assumptions.** Volumes, team counts and release cadence are hypothetical. A schema registry and a message log already exist; you design what goes in them.

**Clarifications.**
- Q: Can analytics see the end user's identifier that a customer passes with a request? | A: Only in a form that cannot be reversed or joined to other datasets; decide which form and who holds the key.
- Q: Do consumers need image dimensions or audio length? | A: Capacity planning needs pixel counts and audio seconds because they drive cost; exact values are fine, content is not.
- Q: Who owns the schema? | A: The serving platform team owns the producer side; each consumer team signs up to a versioned contract.
- Q: Can a new modality appear? | A: Yes. Video input is planned next year.
- Q: What about safety classifications of the content? | A: A category label and score per request may be stored in a restricted tier; the content they were computed from may not.

**Hints.**
1. Start from the consumers: list what each one needs, then derive the fields. Anything nobody needs is not collected.
2. Tag every field with a tier in the schema itself, so tooling can enforce it, rather than in a wiki page.
3. Think about what happens to an enum when a new value appears and an old consumer reads it.

**Follow-ups.**
1. A product team asks for a hash of the prompt text so they can count repeated prompts. Is that content? What would you offer instead?
2. Walk through adding video input: the schema change, the compatibility mode, and what each existing consumer sees on day one.
3. A producer in one region starts sending `audio_ms` where the contract says `audio_seconds`. Where is it caught, by whom, and what happens to the events already written?
4. At {{daily_events}} events a day, how do you validate every event without adding latency to the request path?
5. How do you prove, to an auditor, that no content has reached analytics in the last 90 days?

**Follow-up rules.**
- when: json, free-form, map<string, string>, attributes → ask: A free-form attributes map is convenient. How does it interact with your privacy tiers and with the contract test?
- when: hash, sha256, fingerprint → ask: An unsalted hash of a short prompt can be reversed by guessing. What makes a hash safe here, and who holds the key?
- when: enum, modality type → ask: An old consumer reads an enum value it was compiled without. What happens, and how did you design for it?
- when: protobuf, avro, schema registry → ask: Which compatibility mode do you set on the subject, and what change does it still allow that would break a consumer semantically?
- when: drop, reject, dead letter, dlq → ask: Billing needs every event. If you reject a non-conforming event, how does billing still get its units?

**Production Reality Check.**
- A new SDK version adds a `filename` field on image parts. File names contain people's names, and the field has reached the analytics tables of all {{consumers}} consumer teams for 2 days.
- One of the {{producers}} producing services renames `audio_seconds` to `audio_ms` in a "minor" release. The audio usage dashboard jumps 1000× for one region, and billing has already rated a day of it.
- A realtime endpoint begins emitting one event per streamed chunk instead of one per request, and event volume triples overnight from {{daily_events}} a day.

**Evaluation Criteria.** Consumer-driven field list; envelope plus ordered parts with explicit units; per-field tier annotations enforced by tooling; content excluded at the producer by an allow-list; keyed pseudonymisation for end-user ids; backward and forward compatibility rules with semantic versioning of meaning, not just shape; contract tests in producer CI plus runtime validation with a quarantine that does not lose billing units; adapts to each incident.

## OAI-L3-03: Warehouse model for model-evaluation results

| | |
|---|---|
| **Template ID** | OAI-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / versioned dimensions, reproducibility |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ml-platform-engineer |

```params
{
  "releases": [3, 8, 20],
  "results": {"2": ["50 million", "120 million"], "3": ["600 million", "2 billion"]},
  "graders": ["exact match and model graders", "exact match, model graders and human raters"],
  "suites": [150, 900]
}
```

**Business Scenario.** A model provider evaluates every model version against about {{suites}} evaluation datasets (reasoning, coding, safety, multilingual, regression). Each example in a dataset is answered by the model, possibly several times, and scored by one or more graders: {{graders}}. About {{releases}} candidate versions are evaluated a month and the warehouse receives about {{results}} graded results a month. Release reviews compare a candidate against the current production model and against last quarter's model.

**Problem Statement.** Design the warehouse model for evaluation results. Cover model versions, dataset versions, examples, runs, samples, graders and metrics. State the grain of every fact. Show how the model guarantees that two versions are compared fairly, how a late re-grade (a grader fixed weeks later) enters without silently changing published numbers, and how any published score can be reproduced exactly.

**Constraints.** A published score never changes in place. Datasets are edited over time (examples added, removed, relabelled). A comparison must be explainable down to the examples that differ. Raw model outputs may contain sensitive material and live in a restricted store; the warehouse holds identifiers and scores.

**Assumptions.** Volumes, counts and cadence are hypothetical. Evaluation runs themselves are scheduled by another system; you model what they produce.

**Clarifications.**
- Q: Do two dataset versions share example ids? | A: Yes. An unchanged example keeps its id across versions; an edited one gets a new revision.
- Q: Can one result have several grades? | A: Yes: one per grader version, and graders are re-run when they are fixed.
- Q: Are model outputs deterministic? | A: No. Sampling settings vary, and even greedy decoding is not guaranteed bit-for-bit on accelerators, so some suites run several samples per example.
- Q: Who decides which grader version counts? | A: Each metric definition names its grader version; changing it is a reviewed change.
- Q: How long are results kept? | A: Indefinitely for scores; raw outputs follow the restricted store's retention.

**Hints.**
1. Make every input to a score a versioned, immutable dimension, then a run is just a combination of versions.
2. Fair comparison is about the intersection: the same examples, the same grader version, the same decoding settings.
3. Separate "a grade was recorded" from "this grade is the one the metric uses".

**Follow-ups.**
1. Write the query shape that compares two model versions on one suite, restricted to examples both were graded on with the same grader version. What does it return when the overlap is small?
2. A grader bug is fixed and 30% of last month's results are re-graded. Show what changes in which tables, and what the release-review dashboard shows the next morning.
3. Leadership wants one number per model version. How do you aggregate across {{suites}} datasets without letting the largest dataset dominate, and how do you show uncertainty?
4. A dataset turns out to contain examples that also appear in a training set (contamination). How does the model let you recompute every past comparison without them?

**Follow-up rules.**
- when: latest grade, most recent, overwrite, update in place → ask: A score published in last month's release review was computed with the old grade. After your update, can you still reproduce it?
- when: average, mean of means, avg → ask: Suite A has 40 examples and suite B has 40 000. What does your average mean, and what would you report instead?
- when: dataset_version, dataset version, snapshot → ask: Two dataset versions differ by 200 relabelled examples. How does a comparison between models evaluated on different versions stay fair?
- when: json, blob, outputs table → ask: Raw outputs are restricted. Which of your tables may hold them, and how does an analyst debug a regression without reading them?

**Production Reality Check.**
- A dataset was edited in place (3% of labels fixed) without a new version. Scores for the last {{releases}} releases were computed against different labels and appear in the same chart.
- A model grader was upgraded and only half of this month's runs were re-graded. The release dashboard mixes grader versions and shows a 4-point regression that does not exist.
- Two shards of one run were loaded twice after a retry, and one suite's pass rate is computed over duplicated results.

**Evaluation Criteria.** Immutable versioned dimensions (model version with decoding config, dataset version with example membership, example revision, grader version, metric definition); facts at stated grains (sample, grade, metric value); comparisons restricted to paired examples with matching grader versions; re-grades appended and selected by metric definition, not by recency; published scores as frozen snapshots with a manifest; statistical uncertainty; restricted outputs kept out of the warehouse; adapts to each incident.

## OAI-L3-04: Rate-limit and quota configuration model

| | |
|---|---|
| **Template ID** | OAI-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Low-level design / effective-dated configuration, audit history |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, senior-data-engineer, staff-data-engineer, data-architect, ai-infra-engineer |

```params
{
  "orgs": {"1": ["50 000"], "2": ["500 000"], "3": ["3 million", "6 million"]},
  "lookups": {"1": ["20 000 per second"], "2": ["200 000 per second"], "3": ["2 million per second"]},
  "dimensions": ["requests per minute and tokens per minute", "requests per minute, tokens per minute and a daily token budget", "requests per minute, tokens per minute, images per minute and a batch queue limit"],
  "tiers": [5, 8]
}
```

**Business Scenario.** A model API limits usage with {{dimensions}}, per organization and per model family. Organizations sit in one of {{tiers}} usage tiers that rise automatically with spend and payment history; support can grant overrides (some temporary, for a launch week), and organizations can set lower caps on individual projects. About {{orgs}} organizations exist, and gateways look up limits about {{lookups}}. Reliability engineers and analysts want to know, for any throttled request, which limit applied and why.

**Problem Statement.** Design the configuration model: tiers and their default limits, tier assignments, overrides, project caps, and the audit history of every change. Define how the effective limit for (organization, project, model family, dimension) is resolved, how the gateway gets it at request time without a database read per request, and how analysts reconstruct the limit that applied at any past instant, including after a correction was backdated.

**Constraints.** A project cap can only lower a limit, never raise it. Every change records who made it, when, why and the previous value. A gateway must keep serving if the configuration service is unavailable. An expired temporary override must stop applying on time.

**Assumptions.** Counts, rates and tier numbers are hypothetical. The limiting algorithm itself (sliding window, token bucket) is out of scope; you design the data it reads.

**Clarifications.**
- Q: If an organization has an override and moves up a tier, which wins? | A: The higher of the two, unless the override is marked as a ceiling. Make the rule explicit in your model.
- Q: Can a change take effect in the future? | A: Yes. Support schedules overrides for a launch date, with an end date.
- Q: How fast must a change reach every gateway? | A: Within 60 seconds for increases; decreases for abuse within 10 seconds.
- Q: Are corrections ever backdated? | A: Yes: a tier upgrade that should have happened last Tuesday is recorded today with last Tuesday's effective date.
- Q: Do analysts need per-request limit values? | A: They need to know, for a sample of throttled requests, the effective limit and which rule produced it.

**Hints.**
1. Two different times matter: when a rule is in effect, and when the system learned about it.
2. Precompute the resolved limit per key and ship versioned snapshots; let the gateway log the snapshot version it used.
3. Write the precedence rules as data or a small pure function that both the gateway and the analysts' views share.

**Follow-ups.**
1. Write the lookup for "the effective tokens-per-minute limit for this project and model family at instant T, as the system knew it at instant K".
2. A temporary override ends at 00:00 UTC. Walk through every place the old value lives and how each one learns it has expired.
3. At {{lookups}}, what does the gateway hold in memory, how large is it for {{orgs}} organizations, and how is it updated incrementally?
4. An analyst finds throttling events where the logged limit does not match what your history table says. What are the possible causes, and which design choice makes this impossible?

**Follow-up rules.**
- when: redis, database lookup, query per request, cache → ask: The store is slow for 2 minutes. What limits does the gateway enforce during that window, and is that fail-open or fail-closed?
- when: updated_at, update in place, overwrite → ask: An analyst asks what the limit was last Tuesday at 14:00. Can your table still answer that?
- when: valid_from, effective_from, scd2 → ask: A correction is backdated a week. How do you also answer "what did the gateway believe at the time"?
- when: max, min, precedence, priority → ask: Show your precedence for one organization with a tier default, a temporary override and a project cap, and say what happens when the override expires.

**Production Reality Check.**
- A temporary override that ended at midnight stayed in the gateways' cache for 3 days, so one organization kept a 10× limit. With lookups running at {{lookups}}, nobody noticed until its invoice arrived.
- A script backdated tier upgrades for 12 000 organizations by updating rows in place. Analysts' reports of which limit throttled which request changed overnight, and nobody can say what the gateways enforced last week.
- The configuration snapshot grew past what gateways can load at startup after per-project caps were added for {{orgs}} organizations, and new gateway instances fail their readiness check during a traffic spike.

**Evaluation Criteria.** Normalised configuration (tiers, tier limits, assignments, overrides, project caps) with explicit precedence; bitemporal history (valid time and recorded time) in an append-only change log; resolved, versioned snapshots pushed to gateways with last-known-good fallback; gateways log the snapshot version; expiry enforced at evaluation time, not by a cleanup job; analytics joins throttling events to the logged version; sizing; adapts to each incident.

## OAI-L3-05: Monthly cost per organization with prices that change mid-month

| | |
|---|---|
| **Template ID** | OAI-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | Analytical SQL / point-in-time joins, month grids, period-over-period change |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | OAI-L3-05.mjs |

**Business Scenario.** A model API bills organizations monthly. Usage is recorded per project and model in batches (`usage_records`); a project belongs to one organization. Model prices are effective-dated: `model_prices` holds one row per model per price, valid from its `effective_from` until the next row for that model. Organizations receive credits for a month (`credits`). Finance wants the organizations whose net monthly cost moved by more than {{threshold}}% against the previous month, for {{months_text}}.

**Problem Statement.** Write one PostgreSQL query that returns `month, org_id, prev_net_usd, net_usd, pct_change, status` for the months starting {{m2}} and {{m3}} (each compared with the month before; the data starts at {{m1}}), ordered by `month, org_id`. The rules:
- A usage row costs `input_tokens × usd_per_mtok_input / 1 000 000 + output_tokens × usd_per_mtok_output / 1 000 000`, at the price row **in effect at its `usage_ts`**: the row for that model with the latest `effective_from <= usage_ts`. {{price_note}}
- `month` is the first day of the UTC calendar month of `usage_ts`. An organization's monthly gross is the exact sum over its projects, rounded to cents **once**. {{gap_note}}
- `net_usd = max(0, gross − credits for that organization and month)`. Unused credit does not carry over. {{credit_note}}
- An organization-month is reported when the previous month's net is above 0 and `|net − prev| × 100 > {{threshold}} × prev` (strictly greater). Then `pct_change = round(100 × (net − prev) / prev, 2)` and `status` is `UP` or `DOWN`.
- When the previous month's net is 0 and this month's is above 0, report it with `pct_change` NULL and status `FROM_ZERO`.
- {{unpriced_rule}}

**Constraints.** One SQL statement (CTEs allowed). PostgreSQL. The sample has {{usage_rows}} usage rows; production has hundreds of millions a month, so say how your query would scale.

**Assumptions.** Hypothetical schema, prices and volumes; prices are in US dollars per 1 million tokens. Every organization in `organizations` is billed, whether or not it has usage. Timestamps are UTC.

**Clarifications.**
- Q: A price row takes effect at 14:00:00 and a usage row is at exactly 14:00:00. Which price? | A: The new one. A row is in effect from its effective_from, inclusive.
- Q: Do I round each usage row to cents? | A: No. Sum the exact amounts per organization and month, then round once to cents.
- Q: Can credits exceed the month's cost? | A: Yes. The net is floored at 0, and the unused credit is lost.
- Q: Is the threshold inclusive? | A: No. A change of exactly the threshold is not reported.
- Q: What if the previous month's net is 0? | A: The percentage is undefined: report FROM_ZERO when the current net is above 0, otherwise nothing.

**Hints.**
1. Price each usage row first. `LEFT JOIN LATERAL (… WHERE effective_from <= usage_ts ORDER BY effective_from DESC LIMIT 1)` is one way; turning the price rows into `[effective_from, next effective_from)` intervals with `LEAD` is another.
2. Aggregate usage and credits to organization × month separately, then join them. Joining credits to usage rows multiplies both.
3. Build the full organization × month grid before comparing months, so that a month without usage still exists (and costs 0).

**Follow-ups.**
1. Rewrite the price lookup with `LEAD` intervals and a range join. Which version would you run over hundreds of millions of usage rows, and why?
2. A negotiated rate for one organization overrides list price for some models. Change the model and the query.
3. Finance asks why an organization's cost rose 40%. Decompose the change into volume, price and credit effects.
4. Prices are corrected retroactively (a typo in one row). How do you find every invoice the correction affects, and what do you issue?

**Follow-up rules.**
- when: effective_from <, effective_from < usage_ts, < usage_ts → ask: A usage row lands exactly at a price change. Which price does your condition pick, and which should it?
- when: lag, lag( → ask: An organization has usage in the first and third month but none in the second. What does your LAG compare the third month with?
- when: join credits, join credit → ask: An organization has two credit grants and forty usage rows in a month. How many times is each counted after your join?
- when: inner join, join model_prices → ask: Some usage has no price in effect. What does your join do with it, and does that match the stated rule?
- when: round( → ask: Where exactly do you round, and how far can rounding each row drift from rounding the total over a million rows?

**Production Reality Check.**
- The price table is reloaded without its primary key, and one model gains a second row with the same effective_from and a different price. Depending on how the price is matched, that model's usage is double-counted or priced arbitrarily, and the {{threshold}}% alert fires for organizations whose usage did not change.
- A month-end job ran before the last day's usage arrived, so the baseline month ({{m1}}) is short for some organizations and the next month shows false increases.

**Evaluation Criteria.** Correct point-in-time price match with an inclusive effective_from; exact sum rounded once; credits aggregated before joining and net floored at 0; full organization × month grid; strict threshold; the stated rules for previous-month zero and unpriced usage; deterministic order; can discuss scale and retroactive corrections.
