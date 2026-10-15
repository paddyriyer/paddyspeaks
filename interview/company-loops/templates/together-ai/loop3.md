# Together AI · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of a cloud for open
models: fine-tuning jobs on uploaded datasets (LoRA or full fine-tunes, checkpoints,
job states), dedicated endpoints billed per minute per running replica, several LoRA
adapters sharing one dedicated endpoint, serverless inference across many open models,
and an open-model catalogue with versions and deprecations. Every price, capacity,
limit, volume and schema is hypothetical and "this exercise's rule; check current
docs"; nothing here describes a real customer, internal system, hardware or capacity.
A customer's training data is never inspected beyond the validation the customer asked
for: data shapes describe counts, lengths and formats, never content.
Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## TGA-L3-01: Fine-tuning jobs as data — uploaded datasets, validation results, LoRA or full configs, states, checkpoints and the model each job produced

| | |
|---|---|
| **Template ID** | TGA-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / immutable inputs, validation results without content, method subtypes, job state history, artefact lineage |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, ml-platform-engineer, ai-infra-engineer |

```params
{
  "jobs_per_day": {"1": ["300"], "2": ["4,000", "10,000"], "3": ["60,000", "150,000"]},
  "checkpoints_per_job": [3, 10, 20],
  "retention_days": [30, 90, 180],
  "max_dataset_size": ["1 GB", "5 GB", "25 GB"]
}
```

**Business Scenario.** A cloud for open models lets customers fine-tune an open base model on their own data. In this exercise's model a customer uploads a dataset file (up to {{max_dataset_size}}, in a line-per-example format), the platform validates it as the customer asked (format, roles, lengths by a stated token rule), and the customer starts a job: a base model version, a method (a LoRA fine-tune with a rank and other adapter settings, or a full fine-tune), hyperparameters, and optionally a validation file. A job waits in a queue, runs, saves about {{checkpoints_per_job}} checkpoints, and ends completed, failed or cancelled; a completed job produces a model (an adapter or full weights) that the customer can deploy. Jobs can be retried after an infrastructure failure. There are about {{jobs_per_day}} jobs a day; checkpoints that are not the final model are kept for {{retention_days}} days (this exercise's rule). Customers see their own jobs, events and models; the platform needs outcome rates by base model and method, time queued, and where jobs fail.

**Problem Statement.** Design the data model. Cover: uploaded files and their identity; validation runs and their results, stored without keeping any example's content; job configurations, with the LoRA and full methods modelled so that each has only the settings that apply to it; job states over time and retries; checkpoints; and the produced model, with its lineage back to the job, the checkpoint, the base model version and the exact dataset file. Show how to answer: "jobs completed, failed at validation, failed in training and cancelled, per base model and method, per week"; "minutes queued per job attempt"; "which dataset file, base model version and checkpoint produced this deployed model"; and "files whose validation failed, by error code and validator version".

**Constraints.** An uploaded file is never changed; a customer who fixes a dataset uploads a new file. Validation results hold counts, line numbers, error codes and token totals only, never text from the file. A job's configuration is fixed once it is submitted. A produced model must stay traceable to its inputs for as long as it can be deployed, even after checkpoints expire. A customer sees only its own files, jobs and models.

**Assumptions.** Job volumes, checkpoint counts, retention periods, file sizes, state names and the token rule are hypothetical; check current docs for any real fine-tuning product's formats and limits. Training internals (hardware, schedulers) are out of scope; a job reports its state changes and checkpoints as events.

**Clarifications.**
- Q: Can a job be retried? | A: Yes, after an infrastructure failure the platform retries it as another attempt of the same job. The customer sees one job; operations need every attempt.
- Q: Does the validator change? | A: Yes. It is versioned, and a new version may accept or reject things the old one did not. A file can be validated more than once.
- Q: Which settings does each method have? | A: In this exercise a LoRA job has a rank, an alpha, target module groups and a dropout; a full fine-tune has none of those. Both have epochs, a learning rate and a batch size.
- Q: Can the customer delete a file after a job used it? | A: Yes. The file's contents go; the model's lineage must still say which file (by id and checksum) it was trained on.
- Q: Is the final model one of the checkpoints? | A: Your choice; state it. In this exercise the produced model is promoted from one checkpoint and kept while the customer keeps it.

**Hints.**
1. Separate the immutable inputs (file, by checksum; job configuration) from what happens to them (validation runs, job attempts, state events).
2. Method settings belong in a subtype per method (or a typed column group with checks), not in one wide table full of NULLs or an unvalidated blob.
3. A state history as events per attempt gives queue time, run time and failure stage without overwriting anything.

**Follow-ups.**
1. Walk one job through upload, a failed validation, a new file, a passing validation, queueing, a node failure, a retry, three checkpoints and completion. Which rows exist at the end?
2. The validator gets a new version that rejects a format the old one accepted. Which reports change, and how does the customer see why an earlier job ran on that file?
3. A customer deletes the dataset file and asks which models were trained on it. Answer from your model without the contents.
4. At {{jobs_per_day}} jobs a day with {{checkpoints_per_job}} checkpoints each and {{retention_days}}-day retention, estimate the rows and the artefact bytes you track, and say what you partition or expire.

**Follow-up rules.**
- when: json, jsonb, hyperparameters column → ask: Analysts ask for completion rates by LoRA rank. How do they query a rank stored inside a blob, and what stops a full fine-tune from carrying a rank?
- when: status column, current_state, update the job → ask: A job was retried after a node failure. With one status column updated in place, how do you report minutes queued for the first attempt?
- when: file name, filename → ask: A customer uploads a corrected file with the same name. Which file did last week's job train on, and how does your model know?
- when: error message, sample line, first bad line → ask: The validation report needs to say what is wrong without keeping the customer's text. What exactly do you store per error?
- when: checkpoint, checkpoints → ask: Checkpoints expire after {{retention_days}} days. What happens to the lineage of a model promoted from one of them?

**Production Reality Check.**
- A validator upgrade began rejecting files with a trailing empty line. Validation results were stored as one row per file, overwritten on each run, so a customer whose job had trained successfully a month earlier now saw that same file marked failed, and support could not explain which validator had passed it.
- A retried job reused its attempt row: the retry overwrote the first attempt's start time. At about {{jobs_per_day}} jobs a day the weekly time-in-queue report quietly dropped every first attempt, and the retry rate looked like zero.
- Checkpoints expired after {{retention_days}} days, and the produced model's record pointed only at the checkpoint's storage path. A customer redeploying a model trained more than {{retention_days}} days earlier got a missing-file error, and nobody could say which checkpoint it had been.

**Evaluation Criteria.** Files immutable and identified by checksum; validation runs versioned, with results as counts, line numbers and error codes, never content; job configurations immutable with method-specific settings typed per method; job attempts and state events with derived queue and run times; checkpoints and the produced model with lineage to file, base model version, job and checkpoint that survives expiry and deletion; customer-level access; volumes and retention reasoned at the stated scale; each incident contained, corrected and guarded.

## TGA-L3-02: LoRA adapters and dedicated endpoints as data — endpoints, replicas, base models, adapters attached over time, and the adapter that served each request

| | |
|---|---|
| **Template ID** | TGA-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / configuration versions, replica intervals, attachment intervals, compatibility constraints, request attribution |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ai-infra-engineer, ml-platform-engineer |

```params
{
  "endpoints": {"1": ["60"], "2": ["900", "2,500"], "3": ["12,000", "30,000"]},
  "max_adapters": [8, 32, 128],
  "max_replicas": [2, 8, 20],
  "requests_per_day": {"1": ["2 million"], "2": ["40 million"], "3": ["400 million", "900 million"]}
}
```

**Business Scenario.** A customer of a cloud for open models runs a dedicated endpoint: one base model version served on replicas the customer pays for by the minute while each replica runs (this exercise's rule). The endpoint scales between a minimum and a maximum of up to {{max_replicas}} replicas. Several LoRA adapters, up to {{max_adapters}} per endpoint, can be attached to the same endpoint, so one deployment serves many fine-tuned variants; a request names an adapter or asks for the base model alone. Customers attach and detach adapters, upload new adapter versions, change scaling settings, and sometimes move an endpoint to a newer base model version. There are about {{endpoints}} dedicated endpoints and {{requests_per_day}} requests a day across them. The customer wants per-adapter traffic and latency and an explainable bill; the platform needs replica-minutes and the adapters attached at any moment.

**Problem Statement.** Design the data model. Cover: endpoints and their configuration over time (base model version, scaling bounds, hardware class described generally); replicas as intervals from start to stop, with the minutes billed per replica; adapters, their versions and the base model version each was trained for; attachments of adapter versions to endpoints over time; and request records that say which endpoint, replica, adapter version (or none) served them. Show how to answer: "replica-minutes per endpoint and day"; "requests, tokens and median time to first token per adapter version and day"; "the adapters attached to this endpoint at 14:00 last Tuesday"; and "requests that named an adapter not attached at the time".

**Constraints.** An adapter can only be attached to an endpoint serving the base model version it was trained for. Configuration changes never overwrite history. A replica-minute is billed for each started minute a replica runs (this exercise's rule; check current docs). A customer sees only its own endpoints, adapters and requests.

**Assumptions.** Endpoint counts, replica bounds, adapter limits, volumes and the billing rule are hypothetical; check current docs for any real dedicated-endpoint product. Loading an adapter into a replica's memory is an operational event you may model, but this template is about the records, not the serving algorithm.

**Clarifications.**
- Q: Does a request name an adapter by id or by name? | A: By a customer-chosen name. A name can later point at a newer upload of the adapter.
- Q: What happens to attached adapters when the endpoint moves to a newer base model version? | A: Adapters trained for the old version cannot stay attached. In this exercise the change detaches them, and the customer re-attaches compatible versions.
- Q: Are replica start and stop times exact? | A: They come from scale events that can arrive late or, rarely, twice.
- Q: Is a request to the base model alone billed differently? | A: Not in this exercise; tokens and replica-minutes are the same. Customers still want to see the split.
- Q: Can two adapters share a name at once on one endpoint? | A: No. A name is unique per endpoint at any moment.

**Hints.**
1. Treat the endpoint, the adapter and the adapter version as identities; their settings and attachments are intervals with a start and an end.
2. Resolve the adapter name to an adapter version at request time and store the version on the request record, not only the name.
3. Replica-minutes come from replica intervals clipped to the day; the billing rule applies per replica interval, not per endpoint.

**Follow-ups.**
1. A customer uploads a new version of an adapter under the same name while traffic flows. Show the attachment rows before and after, and which version each request records.
2. The endpoint moves to a newer base model version. Which rows change, which are closed, and how do yesterday's per-adapter reports stay right?
3. A replica's stop event arrives twice, and another's never arrives. How does your model keep replica-minutes right, and what does the customer see on the bill in the meantime?
4. At {{requests_per_day}} requests a day over {{endpoints}} endpoints, what do you keep at request grain, what do you roll up, and how quickly can "requests per adapter version per hour" be answered?

**Follow-up rules.**
- when: adapter_name, name column → ask: The customer re-uploaded the adapter under the same name at noon. Which version served the 11:59 requests, and can your records tell?
- when: attached boolean, is_attached → ask: Support asks which adapters were attached at 14:00 last Tuesday. How does a current flag answer that?
- when: replica_count, replicas column → ask: The endpoint scaled from two replicas to five and back within an hour. How do you bill per minute per running replica from a count?
- when: foreign key, compatibility → ask: The endpoint moved to a newer base model version. What stops an adapter trained for the old version from staying attached in your model?
- when: per minute, round up, ceil → ask: A replica ran from 10:00:30 to 10:02:10. How many minutes does this exercise's rule bill, and where does your model apply it?

**Production Reality Check.**
- A customer re-uploaded an adapter under the same name. Requests stored only the name, so the per-adapter latency report merged two versions and showed a regression that belonged to neither; with up to {{max_adapters}} adapters per endpoint, support could not say which version had served the slow requests.
- An endpoint was moved to a newer base model version by updating its configuration row. Adapters trained for the old version stayed attached in the records, and requests that named them failed while the console said they were live.
- A scale-down event for one of {{max_replicas}} replicas was lost. The replica interval stayed open, and the customer's bill showed replica-minutes for a replica that had stopped two days earlier.

**Evaluation Criteria.** Endpoint configuration versioned; replicas as intervals with the billing rule applied per interval; adapters and adapter versions separate, each tied to its base model version; attachments as intervals with the compatibility rule enforced; requests that record the resolved adapter version and replica; replica-minutes, per-adapter metrics and as-of attachment queries defined on stated grains; storage and rollups reasoned at the stated volumes; customer-level access; each incident contained, corrected and guarded.

## TGA-L3-03: The open-model catalogue as data — families, versions, licences, context lengths, serverless or dedicated availability, deprecations and named replacements

| | |
|---|---|
| **Template ID** | TGA-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / reference data with history, licence versions, offerings per deployment type, versioned notices, catalogue as of a date |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ml-platform-engineer |

```params
{
  "catalogue_models": {"1": ["150"], "2": ["500", "900"], "3": ["2,500", "5,000"]},
  "new_per_week": [3, 8, 15],
  "notice_days": [14, 30, 90],
  "licence_kinds": [6, 12, 25]
}
```

**Business Scenario.** A cloud for open models keeps a public catalogue of the open models it serves. In this exercise's model a model family (from one publisher) has versions; a version has a parameter count, a context length the weights support, a licence, and offerings: available on serverless inference, on dedicated endpoints, or both, each with its own context length limit and token prices (hypothetical). About {{new_per_week}} new versions are added a week; the catalogue holds about {{catalogue_models}} versions across about {{licence_kinds}} licence kinds. Versions are deprecated with at least {{notice_days}} days' notice (this exercise's rule; check current docs), and a deprecation names a replacement. Publishers sometimes change a licence; notices are sometimes postponed. The catalogue page, the API's model list, billing and compliance reporting all read the catalogue, and they must agree about any date.

**Problem Statement.** Design the data model for the catalogue. Cover: families, publishers and versions, and the identifier the API uses for a version; licences as versioned documents with the properties reporting needs (for example, commercial use allowed, attribution required), and which licence applied to a version over time; offerings per deployment type with context length limits and prices over time; availability windows; and deprecation notices with announcement time, deprecation date and the named replacement, including notices that are later revised. Show how to answer: "the catalogue as the API listed it on a past date"; "serverless versions deprecating in the next 30 days, with their replacements"; "versions whose licence changed after a tenant first called them"; and "the context length and price that applied to a request at its time".

**Constraints.** Nothing in the catalogue is overwritten; any past listing can be reproduced exactly. A version's identifier never points at different weights. Prices are integer minor units per token count with a currency, applying from their effective time. A replacement must be a version in the catalogue. Tenants appear only in aggregate, except a tenant's own usage shown to that tenant.

**Assumptions.** Catalogue sizes, rates, notice periods, licence kinds, prices and context limits are hypothetical; check current docs for any real catalogue, licence or deprecation policy. Licence text is stored and referenced, not interpreted by this model; legal judgement is out of scope.

**Clarifications.**
- Q: Can serverless and dedicated offer different context lengths for the same version? | A: Yes, in this exercise. The serverless offering may cap context below what the weights support.
- Q: What if the publisher changes the licence of an existing version? | A: A new licence applies from a stated time. Requests before that time were served under the old one, and compliance needs to see both.
- Q: Can a deprecation notice change? | A: Yes. A later notice can postpone the date or name a different replacement; earlier notices stay on record because tenants were told them.
- Q: Is a version ever re-published with different weights under the same identifier? | A: Never in this exercise. Different weights are a new version.
- Q: Does the catalogue hold usage? | A: No. Usage lives in request records; the catalogue is what they join to.

**Hints.**
1. Separate identity (family, version) from facts that change (licence assignment, offerings, prices, availability, notices), each with an effective range or an announcement time.
2. Model licences as their own versioned table, and the version-to-licence link as intervals; properties used in reporting are columns on the licence version, not free text.
3. "As listed on date D" is a set of as-of lookups on each history table; make every one of them answerable the same way.

**Follow-ups.**
1. Write the query shape for "the catalogue as the API listed it on a past date", including offerings, context lengths, prices and deprecation status.
2. A publisher changes a version's licence to one that forbids a use some tenants rely on. Which records change, and how do you list the tenants who called the version since the change, without exposing any tenant to another?
3. A deprecation is postponed and its replacement changed. Which notices exist afterwards, and which date does the migration report judge last month's calls by?
4. With {{new_per_week}} versions added a week and a {{notice_days}}-day notice period, sketch how the catalogue page, the API list and billing stay consistent when a new version goes live.

**Follow-up rules.**
- when: licence column, license column → ask: The publisher changed the licence on the 10th. Compliance asks which licence applied to calls on the 9th. Can a single column on the version answer that?
- when: context_length → ask: Serverless caps context below what the weights support. Which context length does the request validator use, and where does each one live in your model?
- when: deprecated boolean, is_deprecated, deprecated_at → ask: The deprecation was postponed after tenants were notified. Which date did tenants hear first, and can your model show both?
- when: alias, latest → ask: A name that means "the latest version" moves to new weights. How does a request record stay reproducible when the name moves?
- when: price, prices, pricing → ask: A price changes at midnight UTC while requests are in flight. Which price applies to a request that started at 23:59:58, and how does your model decide?

**Production Reality Check.**
- A publisher's licence change was applied by editing the licence column on the version. The compliance export for the previous quarter now showed the new licence for every call, including calls made months before the change.
- A deprecation was postponed by editing the existing notice's date. Tenants had been told the original date {{notice_days}} days earlier; the migration report judged their calls by the new date, and a tenant's account review started from figures that contradicted the notice they had received.
- A new version went live on the catalogue page before its serverless offering had prices. With about {{new_per_week}} versions added a week, the billing pipeline priced a day of that version's calls at zero before anyone noticed.

**Evaluation Criteria.** Identity separated from changing facts, each with history; licences as versioned entities with reportable properties and version-to-licence intervals; offerings per deployment type with context limits and integer-minor-unit prices over time; deprecation notices as immutable announcements with dates and replacements, revisions kept; the catalogue reproducible as of any date; a go-live check that offerings are complete; tenant data aggregated or scoped to the tenant; each incident contained, corrected and guarded.

## TGA-L3-04: Inference requests as data — serverless or dedicated, model version, adapter, tenant, queue time, time to first token, generation time and token counts

| | |
|---|---|
| **Template ID** | TGA-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / request fact grain, attempts, latency decomposition, token counts per tokenizer, mergeable latency rollups, no content stored |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, ai-infra-engineer |

```params
{
  "requests_per_day": {"1": ["20 million"], "2": ["300 million"], "3": ["3 billion", "6 billion"]},
  "tenants": {"1": ["2,000"], "2": ["20,000"], "3": ["150,000"]},
  "raw_retention_days": [7, 30, 90],
  "streaming_share": ["60%", "85%"]
}
```

**Business Scenario.** A cloud for open models serves requests on shared serverless models and on customers' dedicated endpoints, with or without a LoRA adapter. In this exercise's model each request passes through a router, waits in a queue, is processed by a model server, and returns tokens; about {{streaming_share}} of requests stream their output. Every stage reports timings, and the model server reports token counts by the model version's own tokenizer. There are about {{requests_per_day}} requests a day from about {{tenants}} tenants. Request-level records are kept for {{raw_retention_days}} days (this exercise's rule); prompts and outputs are never stored in these records. Tenants see their own latency and token usage; the platform needs latency by model version, deployment type and stage, and tokens per tenant that agree with usage reporting.

**Problem Statement.** Design the data model. Cover: the grain of the request fact and how retries and client cancellations appear; the timestamps you keep and the durations you derive (queue time, time to first token, generation time, end-to-end), with which clock each comes from; dimensions for deployment type, endpoint and replica, model version, adapter version, tenant and API key; token counts (input, output and any cached input) and the tokenizer they were counted with; status and error classes; and rollups that keep honest percentiles after the raw records expire. Show how to answer: "time to first token percentiles per model version and deployment type per hour"; "output tokens per second during generation, per tenant and model version"; "queue time share of end-to-end latency on shared serverless models"; and "requests cancelled by the client after the first token, per model version".

**Constraints.** No prompt or output text in any record. Token counts are integers and match the model version's tokenizer. Durations are never negative and never measured across two machines' clocks without a stated correction. Rollups must allow percentiles to be combined across hours and tenants. A tenant sees only its own records and rollups.

**Assumptions.** Volumes, retention, streaming share, stage names and status classes are hypothetical; check current docs for any real product's metrics. Invoicing is out of scope; usage reporting reads the same token counts.

**Clarifications.**
- Q: Is a retry a new request? | A: The platform may retry internally after a server failure; the tenant sees one request. Both views are needed.
- Q: What is time to first token for a request that does not stream? | A: Your choice; state it. In this exercise the server still records when the first token was produced.
- Q: Do the router and the model server share a clock? | A: No. They are separate machines; their clocks can differ by tens of milliseconds.
- Q: What happens when the client disconnects mid-stream? | A: The server stops generating and records a cancellation with the tokens produced so far.
- Q: Are token counts comparable across models? | A: Only within a tokenizer. Each model version names its tokenizer.

**Hints.**
1. Choose the grain first: one row per tenant-visible request, plus one per attempt for operations, linked by a request id.
2. Derive each duration from timestamps taken on one machine (or from monotonic durations measured there), and record which stage produced it.
3. Keep fixed-bucket latency histograms (or mergeable sketches) per hour and dimension, so percentiles survive the raw records' expiry and combine across groups.

**Follow-ups.**
1. Walk one streamed request through routing, queueing, a server failure, an internal retry, the first token and a client disconnect. Which rows exist, and what durations does each carry?
2. The tenant's dashboard shows p99 time to first token for a week, and the raw records expired after {{raw_retention_days}} days. How is the p99 computed from what you kept, and how accurate is it?
3. A tenant asks why their output tokens on the latency dashboard differ from their usage report. Where can the two diverge in your model, and how do you make them agree?
4. At {{requests_per_day}} requests a day, estimate bytes per day at request grain and for the hourly rollups, and say how you partition and cluster each.

**Follow-up rules.**
- when: average, avg, mean latency → ask: A few cold requests take 40 seconds. What does an hourly average hide, and how do you combine percentiles across hours from what you store?
- when: one row per attempt, attempt_id, retry → ask: The tenant sees one request; operations see two attempts. Which grain does the tenant's token count read, and how do you avoid counting tokens twice?
- when: started_at - received_at, router timestamp → ask: The router and the model server are different machines. How do you measure queue time without mixing their clocks?
- when: prompt, response text, output text → ask: These records never hold text. What do you keep instead to debug a slow request?
- when: tokens, token count → ask: Two model versions use different tokenizers. Can you sum output tokens across them on one dashboard, and what do you label it?

**Production Reality Check.**
- Queue time was computed as the model server's start time minus the router's receive time. After a clock drift on some servers, about 2% of requests showed negative queue time, and the hourly queue-time percentiles for shared serverless models dropped overnight with no change in load.
- Client-cancelled streams were written with no completion time and were filtered out of the latency rollups. With {{streaming_share}} of requests streaming, the tenants whose users gave up fastest looked the healthiest on their dashboards.
- Internal retries were written as separate tenant-visible requests. At about {{requests_per_day}} requests a day, a model server failure doubled one hour's output tokens on several tenants' dashboards, and the numbers no longer matched their usage reports.

**Evaluation Criteria.** A stated grain with tenant-visible requests and attempts linked; timestamps and durations defined per stage and per clock; dimensions for deployment, endpoint, replica, model version, adapter version, tenant and key; token counts tied to a tokenizer; cancellations and errors kept, not dropped; mergeable latency rollups that survive raw expiry; no content stored; volumes, partitioning and retention reasoned at the stated scale; tenant-scoped access; each incident contained, corrected and guarded.

## TGA-L3-05: Calls after deprecation — per tenant, deprecated version and week, the calls made after the date in force, and the day the tenant first called the replacement

| | |
|---|---|
| **Template ID** | TGA-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / as-of lookup of versioned notices, midnight boundaries, ISO weeks, filtered first occurrence |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, ml-platform-engineer, ai-infra-engineer |
| **Generator** | TGA-L3-05.mjs |

**Business Scenario.** A cloud for open models deprecates model versions in its catalogue and names a replacement for each (this exercise's model; every model name, tenant and number is hypothetical). `model_versions` lists versions; `deprecation_notices` lists each notice sent for a version: `notice_no` (numbered in announcement order), `announced_at`, the `deprecates_on` date it gave and the `replacement_id` it named. {{notice_note}} `requests` holds every request from `{{first_day}}` to `{{last_day}}`: the tenant, the version called, the deployment (`serverless` or `dedicated`), a `status` (`ok` or `error`) and `requested_at`. The sample has {{tenants}} tenants, {{deprecated}} deprecated versions and {{request_rows}} request rows. The migration team wants to see, week by week, which tenants are still calling deprecated versions and whether they have started on the replacement.

**Problem Statement.** Write one PostgreSQL query that returns `tenant_id, version_id, week_start, late_calls, replacement_calls, first_replacement_on`: one row per tenant, deprecated version and week with at least one late call, ordered by `tenant_id, version_id, week_start`.
- Only `deployment = 'serverless'` requests count anywhere in this report (in this exercise a catalogue deprecation applies to serverless calls; dedicated endpoints are out of scope).
- The **notice in force** for a request is its version's notice with the highest `notice_no` whose `announced_at` is at or before `requested_at`. A request with no notice in force is never late.
- A **late call** is a serverless request to a version, with any `status`, made at or after 00:00 UTC on the `deprecates_on` of the notice in force. A failed call still counts: it shows code that still points at the old version.
- `week_start` is the Monday (UTC) of the late call's week, as a date.
- `replacement_calls` is the tenant's serverless requests with `status = 'ok'` to the version's named replacement in that same week (0 when none).
- `first_replacement_on` is the UTC date of the tenant's earliest serverless request with `status = 'ok'` to the named replacement, at any time in the data, before or after the deprecation date (NULL when there is none).

**Constraints.** One SQL statement (CTEs allowed). Production has thousands of model versions, a notice history per version and billions of requests, partitioned by day.

**Assumptions.** Hypothetical schema, versions, tenants, dates and counts; check current docs for any real deprecation policy. Every notice for a version names the same replacement. `model_versions.family` and `released_on` are context only. Tenants appear here only as ids; the report goes to the team that runs migrations, and each tenant would see only its own rows.

**Clarifications.**
- Q: A call arrives at exactly 00:00:00 UTC on the deprecation date. Is it late? | A: Yes. The version is deprecated from that instant. A call one second earlier is not.
- Q: A second notice postponed the date. Which date judges a call made before that notice was announced? | A: The notice in force when the call was made. A call made after the first date had passed, but before an extension was announced, was late; calls after the extension are judged by its new date.
- Q: The tenant called the replacement once on a dedicated endpoint before any serverless call. Does that set `first_replacement_on`? | A: No. Only serverless calls count anywhere in this report.
- Q: Does a failed call to the replacement count as the first call? | A: No. Only a call with `status = 'ok'` shows the tenant running on the replacement.
- Q: A tenant has late calls in one week and none in the next. Does the next week get a row? | A: No. Only weeks with at least one late call.

**Hints.**
1. Find the notice in force per request with a `LATERAL` subquery (`ORDER BY notice_no DESC LIMIT 1`) over notices announced at or before the request.
2. Compare `requested_at` with `deprecates_on::timestamptz`, which is midnight UTC with the session in UTC, and bucket late calls with `date_trunc('week', requested_at)::date`.
3. Aggregate the late calls by tenant, version and week first, then join the replacement's successful serverless calls once, so the join cannot multiply the late-call counts.

**Follow-ups.**
1. In production the requests table holds billions of rows partitioned by day. How would you restrict the scan, and what would you pre-aggregate so this report runs daily in seconds?
2. The migration team now wants tenants who called a deprecated version at least once in the last 7 days and have never succeeded on the replacement. Change the query.
3. A notice is later found to have been sent with the wrong date, and a corrected notice is issued. Should calls already judged late under the wrong notice stay late? Argue both ways, and say what the data model needs either way.
4. A replacement is itself deprecated a month later. Should a tenant that moved straight to the replacement's replacement count as migrated? Change the definition and the query.

**Follow-up rules.**
- when: max(notice_no), latest notice → ask: A notice extended a date that had already passed. Is the version's latest notice the one in force for a call made before that notice was announced?
- when: requested_at::date, cast(requested_at as date) → ask: Your comparison works on dates. Is a call at 00:00:00 on the deprecation date late under your condition, and is one at 23:59:59 the day before?
- when: status = 'ok', successful → ask: Did you filter the late calls by status as well? What does a failed call to a deprecated version tell the migration team?
- when: join requests → ask: If you join every replacement call to every late call before counting, what happens to `late_calls` for a tenant with ten of each in one week?
- when: date_trunc → ask: Which day does your week start on, and what would another engine's default give for a Sunday call?

**Production Reality Check.**
- A deprecation was extended after its first date had passed. The report was re-run using each version's latest notice, and the calls made in the days before the extension, when tenants had been told the version was deprecated, vanished from the weekly figures the migration team had already shared.
- The first version of this report counted dedicated-endpoint calls. Tenants running their own endpoints on the old version, out of scope for the catalogue deprecation, appeared at the top of the list of laggards.

**Evaluation Criteria.** Serverless filter applied to every part; the notice in force chosen per request by `announced_at` and `notice_no`; the midnight boundary inclusive; weeks starting Monday in UTC; late calls of any status; replacement calls and the first replacement day from successful serverless calls only, at any time; aggregation before joining so counts are not multiplied; deterministic ordering; can discuss partition pruning, pre-aggregation, corrected notices and replacement chains.
