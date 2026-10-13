# Anthropic · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of an AI model
provider (models served through apps, an API with rate limits, prompt caching,
streaming and asynchronous message batches, and enterprise plans). Every workload, number,
price and schema is hypothetical. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## ANT-L2-01: Deadline-first scheduling of batch jobs under per-model concurrency

| | |
|---|---|
| **Template ID** | ANT-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Heaps and discrete-event simulation / earliest deadline first, per-model slots, cancellation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, ai-infra-engineer, ml-platform-engineer, data-engineer, senior-data-engineer |
| **Generator** | ANT-L2-01.mjs |

**Business Scenario.** A platform team runs a job runner in front of a model API for the rest of the company. Teams submit jobs (a list of model requests to process, each job with a deadline its owner chose); the runner sends the requests one by one, and to stay inside the organization's rate limits it allows only a fixed number of requests in flight per model. When the backlog is long, the order matters: the runner serves the waiting job with the earliest deadline first, and requests that have not started by their job's deadline are dropped and reported as expired, much as public asynchronous batch interfaces report requests that were not processed in time. Before changing the slot limits, the team wants an exact replay of a day of submissions that says, per job, how many requests ran, were canceled or expired, and when the last one finished. {{model_rule}}

**Problem Statement.** Implement `run_jobs(jobs, slots, cancels)`. Each job is `(job_id, model, submit_ts, deadline_ts, durations)`: `durations` lists the run time of each of its requests, in seconds, in the order they must start. `slots[model]` is how many requests of that model may run at once. Time is in whole seconds. At every second `t` at which something happens, in this order:
1. Requests that finish at `t` free their slots.
2. Jobs submitted at `t` join their model's queue.
3. Cancels at `t` apply: if `t < deadline_ts`, every request of that job that has not started becomes **canceled**; a cancel at or after the deadline changes nothing.
4. Each model fills its free slots, one request at a time, from the waiting job with the earliest `deadline_ts`; ties go to the earlier `submit_ts`, then to the job listed first in `jobs`. A request may start only if `t < deadline_ts`; once a job's deadline has passed, all its requests that have not started are **expired**. A started request always runs to completion, even past the deadline.

Return `{job_id: (done, canceled, expired, last_finish)}` for every job, where `last_finish` is the latest finish time of its done requests, or `None` if none ran. {{cancel_rule}}

**Constraints.** Up to 8 000 jobs and 200 000 requests; thousands of jobs can be waiting at once. Durations are positive integers; `slots` has a positive entry for every model used. Expected: O(R log J) for R requests and J jobs. Scanning the waiting jobs at every start is too slow.

**Assumptions.** Jobs, models, durations, deadlines and slot counts are hypothetical. The runner is the team's own scheduler, not a description of how any provider processes batches; it simply honours per-model concurrency as a way of staying under rate limits. A job's requests start in list order, and only one cancel per job exists.

**Clarifications.**
- Q: A request finishes at second 10. Can the next one start at 10? | A: Yes. Finished requests free their slots first, then slots are filled.
- Q: Can a request start exactly at the deadline? | A: No. It must start strictly before `deadline_ts`. One that started at `deadline_ts − 1` runs to completion.
- Q: A cancel and a possible start happen at the same second. Which wins? | A: The cancel. Cancels apply before slots are filled.
- Q: What does a cancel do to requests that are already running? | A: Nothing. They finish and count as done.
- Q: Can a model with free slots help another model? | A: No. Each model has its own slots.
- Q: Do I need to simulate every second? | A: No. Nothing changes between events, and deadlines can be a day away.

**Hints.**
1. Only three kinds of moments matter: a submission, a finish and a cancel. Jump from one to the next.
2. Keep each model's running requests in a min-heap of finish times, so the next free slot is the heap's top.
3. Keep each model's waiting jobs in a min-heap keyed by `(deadline_ts, submit_ts, position)`. A job stays in the heap while it still has requests to start.
4. You do not need a separate event for a deadline: a job whose deadline has passed can be expired the next time it reaches the top of the heap, or at the end.
5. Models never interact, so you can simulate each model on its own.

**Follow-ups.**
1. Show a small case where serving jobs in submission order expires more requests than earliest-deadline-first, and one where earliest-deadline-first is still not the order that expires the fewest requests.
2. Requests of a job can run in parallel up to a per-job cap as well as the per-model cap. What changes in your data structures?
3. The runner must decide in real time, without knowing future submissions. Which parts of your replay carry over, and how would you choose slot limits per model from a week of replays?
4. Owners want to know at submission time whether a job will finish before its deadline. How would you estimate that, and how wrong can the estimate be?

**Follow-up rules.**
- when: for t in range, every second, tick → ask: Deadlines are up to a day away and most seconds have no event. How many iterations does your loop do, and how do you jump between events?
- when: sorted(, sort the queue, min(, scan → ask: Thousands of jobs are waiting. What does finding the earliest deadline cost at each of 200 000 starts, and what structure makes it O(log n)?
- when: fifo, first come, deque, submission order → ask: Two jobs wait: one submitted earlier with a deadline tomorrow, one later with a deadline in ten minutes. Which runs first under your rule, and what does the specification say?
- when: deadline event, expire event, timer → ask: Do you need an event at each deadline, or can expiry be decided lazily? What is the cost of each choice?

**Evaluation Criteria.** Event-driven simulation that jumps between submissions, finishes and cancels; finishes before submissions before cancels before starts within one second; a finish-time heap per model and a deadline-ordered heap of waiting jobs with the full tie-break; strict `t < deadline_ts` for starting, started requests always complete; cancels only before the deadline and only for requests not yet started; models independent; correct `None` for jobs with nothing done; O(R log J); can explain where earliest-deadline-first is and is not optimal.

## ANT-L2-02: Safety evaluation plan under an accelerator budget

| | |
|---|---|
| **Template ID** | ANT-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Dynamic programming / tree knapsack, dependency closure, iterative traversal |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, ml-platform-engineer, ai-infra-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | ANT-L2-02.mjs |

**Business Scenario.** Before a model release candidate ships, a safety team runs evaluation suites against it. Each risk area has a base suite, and extensions of a suite (multi-turn, multilingual, tool-use, long-context and adversarial variants) reuse its harness, prompts and graders, so an extension can only run if the suite it extends runs too. Every suite has an estimated cost in accelerator-hours and a coverage score the team assigns. The compute for this run is fixed, and the team wants the planner that chooses which suites to run. {{depth_rule}}

**Problem Statement.** Implement `plan_evals(suites, budget, required)`. `suites` is a list of `(suite_id, parent_id, hours, coverage)`, where `parent_id` is `None` for a base suite. A **plan** is a set of suites in which every suite's parent is also in the plan, with total hours at most `budget`. Return `(coverage, hours)`, the totals of the plan with the greatest total coverage; among plans with equal coverage, the one with the fewest hours. The empty plan `(0, 0)` is always allowed when nothing is required. {{gate_rule}}

**Constraints.** Up to 3 000 suites; `budget` up to 2 000; `hours` from 0 to 60 and `coverage` from 0 to 100, all integers. Suites arrive in any order (an extension may be listed before its parent); every `parent_id` exists and there are no cycles. A family can be thousands of suites deep. O(n · budget) time is expected, with no recursion-depth failure.

**Assumptions.** Suites, hours and coverage scores are hypothetical. Coverage is treated as additive, which is a simplification the follow-ups question. A suite in the plan runs once.

**Clarifications.**
- Q: Can an extension run without the suite it extends? | A: No. Every suite in the plan needs its parent in the plan, and so on up to the base suite.
- Q: Is the budget inclusive? | A: Yes. A plan using exactly `budget` hours is allowed.
- Q: Two plans have the same coverage. Which one do I return? | A: The one with fewer hours. You return totals only, so any further tie does not matter.
- Q: Can a suite cost 0 hours? | A: Yes, when it only regrades results that already exist. It is still subject to its parent rule.
- Q: What do I return when the required suites cannot all fit? | A: `None`. With an empty `required`, the answer is never `None`.

**Hints.**
1. Enumerating subsets is 2ⁿ. This is a knapsack in which taking a suite is what makes its children available.
2. List the suites in depth-first order. At each position, either run the suite and move to the next position (its first child), or skip it and jump past its whole subtree.
3. Or pass a budget array down the tree: a child starts from the array its parent produces once the parent is taken, and a suite's result is the element-wise better of skipping and taking.
4. Fold the tie rule into the comparison: compare `(coverage, −hours)`, or use `coverage × M − hours` with `M` larger than any possible total of hours.
5. A suite that is required, or has a required suite below it, cannot be skipped.

**Follow-ups.**
1. Return the chosen suites as well as the totals. What extra state do you keep, and how much memory does it cost?
2. A multilingual tool-use suite needs both the multilingual and the tool-use suites to run. The dependencies are now a DAG. What happens to your algorithm, and what would you do in practice?
3. Two suites that probe the same behaviour overlap, so their coverage is not additive. How would you model diminishing returns, and what does it do to the dynamic programme?
4. Hours are estimates, and some suites overrun. How would you schedule the chosen plan so that an overrun cannot push a required suite out of the budget?

**Follow-up rules.**
- when: greedy, ratio, per hour, sort by → ask: Give a small forest where taking the best coverage per hour first loses. What does an expensive base suite do to the ratio of its extensions?
- when: recursion, recursive, dfs(, setrecursionlimit → ask: One family is 2 500 suites deep. What happens to a recursive solution in CPython, and how do you make it iterative?
- when: itertools, subsets, combinations, brute force → ask: How many plans are there with 3 000 suites, and what structure lets you avoid looking at them?
- when: convolution, merge children, merge the tables → ask: Merging each child's table into its parent's costs budget² per edge. What is the total at 3 000 suites and 2 000 hours, and how do you get to O(n · budget)?

**Evaluation Criteria.** Recognises a precedence-constrained (tree) knapsack; enforces the parent rule; inclusive budget; correct tie-break on hours; required suites force their ancestors and give `None` when they cannot fit; handles children listed before parents, zero-hour suites and very deep families without recursion; O(n · budget) time; explains why greedy by ratio fails and what a DAG of prerequisites changes.

## ANT-L2-03: Debug the pairwise win-rate report for two model snapshots

| | |
|---|---|
| **Template ID** | ANT-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Debugging / retries, position-swap normalisation, ties, pairing, macro averages |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, ml-platform-engineer, software-engineer |
| **Generator** | ANT-L2-03.mjs |

**Business Scenario.** A model team compares a candidate model snapshot with the current baseline snapshot on a fixed prompt set, using a grader model as judge. To cancel out position bias, every item is judged twice: once with the baseline's response shown first (`AB`) and once with the candidate's response shown first (`BA`). The judge answers which position was better, or a tie. A report gives the candidate's win rate per category and a macro average across categories. Reviewers noticed that the candidate's numbers move when nothing changed, that ties seem to hurt it, and that a category with two items swings the summary more than it should. {{retry_rule}}

**Problem Statement.** Fix `win_rates(judgments)` so that it meets this specification. Each judgment is a dict `{"item", "category", "order", "attempt", "verdict"}`; `order` is `"AB"` (baseline shown first) or `"BA"` (candidate shown first); `verdict` is `"first"`, `"second"`, `"tie"` or `"invalid"` (the judge's answer could not be parsed). Judgments arrive in any order.
1. For each `(item, order)`, only the judgment with the highest `attempt` counts. If that judgment is `"invalid"`, the order is missing; an earlier attempt does not replace it.
2. An item is **paired** when both of its orders have a counted, valid verdict. Every other item that appears is **unpaired** and contributes nothing else.
3. For each order of a paired item, the candidate earns 2 points for a win, 1 for a tie and 0 for a loss. In `AB` the candidate is the response shown second; in `BA` it is the one shown first. A paired item is worth 4 points at most.
4. Return `{"categories": {category: {"items", "points"}}, "unpaired", "macro_win_rate"}`. Only categories with at least one paired item appear. `macro_win_rate` is the mean, over those categories, of `points / (4 × items)`; it is `None` when no item is paired.

**Constraints.** Keep the function's shape and output format. Up to 200 000 judgments; one pass plus work per item. An item always has the same category.

**Assumptions.** Items, categories, attempts and verdicts are hypothetical. Judging every item in both orders is a common way to reduce position bias in pairwise model comparisons; the scoring rule above is this exercise's specification. `attempt` values for one `(item, order)` are distinct.

**Clarifications.**
- Q: The judge was retried after a timeout. Which answer counts? | A: The highest attempt, regardless of the order in which judgments arrive.
- Q: The latest attempt is invalid but an earlier one parsed. Can I use the earlier one? | A: No. The latest attempt decides; that order is missing.
- Q: What does "first" mean in a BA judgment? | A: The response shown first, which in BA is the candidate's. The verdict names a position, not a model.
- Q: Is the summary weighted by items? | A: No. Each category counts once: it is the mean of the per-category rates.
- Q: How many bugs are there? | A: Several, of different kinds. Each has a test named after it.

**Hints.**
1. Read the deduplication loop and ask which judgment survives when attempt 1 arrives before attempt 2.
2. Write out the four cases (AB/BA × first/second) and who wins each.
3. Count the points for an item judged "tie" in both orders by hand.
4. What makes an item paired? Count the orders the code requires.
5. Compute the summary for one category with 2 items and another with 6 items, both ways.

**Follow-ups.**
1. Write the smallest set of unit tests that would have caught every one of these bugs.
2. The macro win rate moves by 0.03 between two runs on the same snapshots. How would you put a confidence interval on it, and what is the right unit of resampling?
3. The candidate wins far more often in BA than in AB. What does that tell you about the judge, and what would you report?
4. Grader prompts change between runs. How do you store judgments so that two reports are only compared when they used the same grader version and prompt set?

**Follow-up rules.**
- when: last one wins, overwrite, latest[key] = j → ask: A retry is logged before the attempt it replaced. What does "last seen wins" keep, and what does the specification want?
- when: skip invalid, ignore invalid, fall back → ask: Attempt 2 is invalid and attempt 1 parsed. What does your code count for that order, and what does rule 1 say?
- when: pooled, total points, weighted by items → ask: One category has 2 items and another 600. What does pooling do to the summary, and why does the report want a macro average?
- when: float, round( → ask: Points are integers and the rate is a ratio. Where would you round, if anywhere, and what would rounding early do to the macro average?

**Evaluation Criteria.** Finds and explains every bug with its symptom; keeps the highest attempt independent of arrival order and does not fall back from an invalid latest attempt; normalises the position swap; gives ties half the points; requires both orders for a pair and counts the rest as unpaired; macro average over categories with `None` for no data; minimal fix that keeps the output shape; a test per bug.

## ANT-L2-04: Incremental document enrichment through the Message Batches API

| | |
|---|---|
| **Template ID** | ANT-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Batch pipelines / change detection, asynchronous jobs, idempotent results, versioned backfills |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, ml-platform-engineer, data-architect |

```params
{
  "documents": {"2": ["2 million", "6 million"], "3": ["80 million", "250 million"]},
  "daily_change": ["1%", "5%", "15%"],
  "deadline": ["by 07:00 the next morning", "within 6 hours of a change"],
  "fields": [4, 9]
}
```

**Business Scenario.** A company that manages contracts for its customers enriches every document in its store with a model: {{fields}} structured fields such as document type, parties, renewal date, governing law and a short summary. The corpus holds {{documents}} documents and about {{daily_change}} of them are added or changed each day. The enrichment does not need an immediate answer, so the team uses an asynchronous batch interface of the kind public model APIs document (for example a Message Batches API): requests are submitted in batches, each request carries a caller-chosen custom id, processing completes within a window, results are retrieved afterwards and matched to requests by that id, and each request ends as succeeded, errored, canceled or expired. Enriched fields must be available {{deadline}}.

**Problem Statement.** Design the pipeline from "a document changed" to "its enriched fields are in the lakehouse table, with lineage". Cover change detection, how requests and custom ids are built, batch sizing and submission under the organization's usage limits, polling and result retrieval, matching and validating results, retries of errored and expired requests, idempotent writes, the versioning of prompt, model snapshot and output schema, and how a prompt or model change is backfilled across the corpus without starving the daily run.

**Constraints.** A document's fields must come from one prompt version and one model snapshot, never a mix. Re-running any step must not duplicate rows or bill the same work twice by accident. Usage limits apply to the whole organization, which other teams share. Results can be retrieved only for a limited period after a batch ends. Document text may contain customer personal data and must not be copied into logs.

**Assumptions.** All volumes, rates and deadlines are hypothetical; batch-size limits, processing windows, result retention and batch pricing are as the provider's current documentation states, and the design should not depend on exact values. Documents have stable ids and a content hash can be computed.

**Clarifications.**
- Q: Do results come back in the order requests were submitted? | A: Do not assume so. Match every result by its custom id.
- Q: What happens to requests that are not processed within the window? | A: They come back as expired. Deciding what to do with them is part of your design.
- Q: Can a document change again while its earlier version is still being processed? | A: Yes. The newest version must win, whatever order results come back in.
- Q: How do we know the output is well formed? | A: Ask for structured output (for example a JSON object or a tool call with a schema) and validate it; a response that does not validate is a failure, not a value.
- Q: Who else uses the organization's limits? | A: Interactive products. They must not be throttled by your backfills.

**Hints.**
1. Make the unit of work `(document id, content hash, prompt version, model snapshot)`. If that tuple already has a valid result, there is nothing to do.
2. Derive the custom id from that tuple (or from a key that maps to it), so a result identifies exactly which version it describes.
3. Separate the daily incremental run from backfills: different queues, priorities and budgets, the same idempotent writer.
4. A request that succeeded but whose output does not validate is as much a failure as an errored one, and it was still billed.

**Follow-ups.**
1. Walk through a crash after a batch was submitted but before its id was recorded. How do you avoid submitting the same documents again?
2. A document changes while its previous version is in a running batch. Show the rows written when the two results come back in the wrong order.
3. The prompt changes. How do you backfill {{documents}} documents within the usage limits, and what does the table show while the backfill is half done?
4. Ten percent of results in one batch fail validation. How do you tell a prompt problem from a model problem from bad documents, and what do you retry?
5. Estimate the daily cost of the incremental run from the change rate, and say which design choices change it most.

**Follow-up rules.**
- when: updated_at, modified time, timestamp → ask: Two edits land in the same second. Which version does your change detection see, and why is a content hash safer?
- when: retry, resubmit → ask: Which results do you resubmit: errored, expired, invalid output? For each, how do you make sure the retry cannot overwrite a newer version's result?
- when: uuid, random id → ask: If the custom id is random, how does a result tell you which document version and prompt version it belongs to after a crash?
- when: real-time, synchronous, streaming → ask: Why did the team choose asynchronous batches for this, and what would the synchronous path cost in limits and money?
- when: upsert, merge → ask: What is your merge key, and what condition stops an older version's result from replacing a newer one?

**Production Reality Check.**
- A backfill for a new prompt version is submitted at full speed and interactive products in the same organization start receiving rate-limit errors.
- A batch ends with 30% of its requests expired on a day when daily changes were at {{daily_change}} plus a large customer import.

**Evaluation Criteria.** Change detection by content hash; a work unit keyed by document, content hash, prompt version and model snapshot; deterministic custom ids recorded before submission; results matched by id, validated against a schema, and written idempotently with a version guard; distinct handling for errored, expired, canceled and invalid outputs; daily run and backfill separated with their own budgets inside shared organization limits; lineage columns on every row; no document text in logs; reasons about cost and the retrieval window.

## ANT-L2-05: Chargeback of model usage to business units

| | |
|---|---|
| **Template ID** | ANT-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Batch pipelines / incremental pulls with restatement, SCD ownership, cost allocation, reconciliation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect, staff-data-engineer |

```params
{
  "workspaces": {"1": [15, 40], "2": [120, 300], "3": [800, 1500]},
  "api_keys": {"1": ["200", "600"], "2": ["2,500", "6,000"], "3": ["40,000", "90,000"]},
  "business_units": [12, 45, 140],
  "revision_window": ["48 hours", "5 days"]
}
```

**Business Scenario.** A global enterprise uses a model API across {{workspaces}} workspaces and {{api_keys}} API keys. Finance must charge the cost back every month to {{business_units}} business units, and teams want daily spend by product. Public admin documentation for such APIs describes usage and cost reports grouped by time bucket, workspace, API key and model, with input tokens split into uncached input, cache writes and cache reads, plus output tokens, and with batch and standard processing priced differently. Ownership of keys and workspaces lives in the company's own registry and changes as teams reorganise. In this company's experience, figures for recent hours can still change for up to {{revision_window}} after they first appear, and only the monthly invoice is final.

**Problem Statement.** Design the pipeline from the provider's usage and cost reports to monthly chargeback and daily spend dashboards. Cover the incremental pulls and how revisions are absorbed, the grain and keys of the fact table, how cost is computed or taken from the reports, ownership history and allocation of shared or unowned keys, closing a month and reconciling it with the invoice to the cent, and who may see what.

**Constraints.** The month's chargeback must sum exactly to the invoice. A business unit sees only its own detail. A reorganisation in the middle of a month must not move earlier days' cost to the new owner. The pipeline must be safe to re-run for any day. Report APIs are rate limited, so pulls must be incremental.

**Assumptions.** All counts, windows and prices are hypothetical. The report endpoints return data at an hourly or daily grain and can be queried by time range. The invoice arrives a few days after month end in one currency.

**Clarifications.**
- Q: Can an API key be shared by several teams? | A: A few are. The registry can say how to split them, for example by request tags or a fixed share; some keys have no owner at all.
- Q: Do we compute cost from tokens ourselves or take the provider's cost figures? | A: Your choice, but the result must reconcile with the invoice. Say what you do with the difference.
- Q: How late can a revision arrive? | A: Up to {{revision_window}} in this exercise; occasionally a correction appears later and must still be handled.
- Q: Who owns cost after a team is merged into another? | A: Days before the merge stay with the old owner; days after go to the new one.
- Q: Is batch usage separate? | A: Yes, it is priced differently, and teams want to see how much they saved by using it.

**Hints.**
1. Pull with an overlap: on every run, re-read the last {{revision_window}} and replace those buckets, keyed by the report's own grain.
2. Keep ownership as effective-dated rows (SCD type 2) and join usage to the owner valid at the usage hour.
3. Close a month in two steps: a provisional close from your data, then a final close that books the invoice difference to an explicit adjustment line.
4. An "unallocated" business unit is a feature: it makes missing ownership visible instead of hiding it in someone's total.

**Follow-ups.**
1. A revision for a closed month arrives after the chargeback was sent. What happens to the numbers each business unit already saw?
2. The sum of your computed costs differs from the invoice by 0.3%. How do you find out why, and where does the difference go?
3. A key is moved from one workspace to another in the middle of the month. Which dimension do you attribute by, and why?
4. Product teams ask for cost per end-customer of their own application. What would you need from them, and what should never flow into this pipeline?

**Follow-up rules.**
- when: append, insert only, append-only → ask: The same hour is reported three times as it is revised. How does your table avoid counting it three times?
- when: current owner, latest owner, join on key → ask: A team was merged into another on the 15th. Whose budget does your join charge for the 3rd?
- when: compute cost, price table, multiply → ask: Cache writes, cache reads, batch and standard all have different prices. Where does your price table come from, and what do you do when it disagrees with the invoice?
- when: round, rounding, cents → ask: You allocate a shared key three ways. How do you make the three parts add up exactly to the original cent amount?

**Evaluation Criteria.** Incremental pulls with an overlap window and idempotent replacement at the report's grain; a fact table at hour × workspace × key × model × token type × processing mode; ownership as effective-dated history joined at usage time; explicit rules for shared and unowned keys; cost tied to the provider's figures or a versioned price table with a reconciled difference; a two-step month close with an adjustment line that makes the total equal the invoice; largest-remainder or equivalent rounding; per business unit access control; late corrections after close handled as adjustments, not silent rewrites.
