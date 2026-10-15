# xAI · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of a model API
platform with real-time data: per-model rate limits on requests per second and
tokens per minute that scale with a team's cumulative-spend tier, server-side
tools for web search and search over public posts that return citations,
real-time ingestion of public posts for retrieval, regional endpoints with a
price multiplier, and usage analytics for teams. Every tier, threshold, limit,
price, multiplier, volume and schema is hypothetical and this exercise's rule
(check current docs). Public posts are public posts with a given schema and
synthetic tokens for text; authors and users appear only in aggregate; ranking
is always a scoring function you are given; nothing here describes the
company's or any partner's internal systems or data. Format:
docs/COMPANY-INTERVIEW-LOOPS.md.

## XAI-L3-01: Spend tiers as data — a spend ledger, versioned thresholds, tier changes and the per-model limits in force for a request

| | |
|---|---|
| **Template ID** | XAI-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / ledger-derived state, versioned thresholds without retroactive demotion, effective-dated limit tables, as-of reconstruction |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ai-infra-engineer |

```params
{
  "teams": {"1": ["60 000"], "2": ["400 000"], "3": ["2 million", "5 million"]},
  "tiers": [4, 5, 6],
  "models": [5, 9, 14],
  "spend_events": {"1": ["20 million a day"], "2": ["150 million a day"], "3": ["1 billion a day"]}
}
```

**Business Scenario.** A model API limits each team, per model, in requests per second and tokens per minute. In this exercise (check current docs for the real rules) the limits come from the team's spend tier: there are {{tiers}} tiers, and a team moves up when its cumulative spend reaches the next tier's threshold. The platform offers {{models}} models, some behind aliases, each with its own limits per tier. About {{teams}} teams are active, and the billing side produces spend events at about {{spend_events}}: usage charges, refunds, chargebacks and usage paid by promotional credits. Thresholds are revised from time to time, models launch and retire, and limits per model and tier change. Developers and support ask the same questions every day: which tier was this team in at 14:05 last Tuesday, which limits applied to its request to this model, why — and how far is it from the next tier?

**Problem Statement.** Design the data model for spend tiers and the limits they grant. Cover the spend ledger and which entries count as spend; cumulative spend per team; threshold versions; tier changes as dated events with their cause; per-model limits for each tier as versioned data, including aliases; and a derived view that returns the limits in force for (team, model or alias, instant). Show how a request's limits are reconstructed after the fact, including when a spend event arrived late or a threshold version changed in between.

**Constraints.** Money is stored in integer cents (usage may be metered in smaller integer units and rounded when charged). In this exercise's rules: cumulative spend is lifetime spend from paid usage and refunds; usage paid by promotional credits never counts. A tier, once reached, is never lowered automatically; only a recorded manual decision with a reason lowers it. A new threshold version never demotes anyone: when thresholds rise, teams keep the tier they have; when they fall, teams that now qualify move up when the version takes effect. A tier change must reach request handling within minutes of the spend event that caused it. Limits exist per (model, tier); a model with no limits row for a tier is not offered to that tier, and a missing row is never read as zero or as unlimited. Nothing is overwritten.

**Assumptions.** Team counts, tier counts, model counts, spend volumes and every threshold and limit are hypothetical. Per-team limit overrides and project-level caps are out of scope; the limiting algorithm itself is out of scope — you design the data it reads.

**Clarifications.**
- Q: Is cumulative spend lifetime, or per month? | A: Lifetime since the team was created, in this exercise. Check current docs for how the real product counts it.
- Q: When does a charge count — when usage happens or when it is paid? | A: When it is charged to the team. A chargeback later is a negative ledger entry; say what it does to the tier under the rules above.
- Q: Can one payment cross several thresholds? | A: Yes. Record one change per tier crossed, or one change to the highest tier — state which, and what the history shows.
- Q: Are limits per model or per model family? | A: Per model. A request may name an alias, and an alias can be moved to a newer model with different limits.
- Q: How long must history be answerable? | A: Two years, for support and for billing disputes.

**Hints.**
1. Keep facts (ledger entries, threshold versions, limit versions, alias moves) apart from derived state (cumulative spend, tier history, limits in force).
2. A team's tier history is a set of intervals [from, to) per team, each pointing at the event that opened it: a spend crossing, a threshold version, or a manual decision.
3. "Limits in force at t" is three as-of lookups: the alias's target at t, the team's tier interval containing t, and the limits version for (model, tier) in force at t.

**Follow-ups.**
1. Write the query, or pseudocode, that returns the requests-per-second and tokens-per-minute limits for team T, alias A, at instant t, and the rows that justify them.
2. A refund arrives two days late for the payment that pushed a team over a threshold. Which rows change, and does the team's tier history change under this exercise's rules?
3. A new threshold version raises the threshold of the second-highest of the {{tiers}} tiers. Which teams move, which rows are written, and what does a team that was one dollar short see the next day?
4. A model launches with limits for only some of the {{tiers}} tiers. How does your model keep it from teams in the other tiers, and what check finds the gap before launch?
5. At {{spend_events}}, how do you keep cumulative spend and tier crossings current within minutes without summing a team's ledger on every request?

**Follow-up rules.**
- when: tier column, current_tier, update the tier → ask: Support asks which tier a team was in when its request was rejected last Tuesday at 14:05. With the tier stored as a column on the team, how do you answer?
- when: running total, cumulative, sum(amount → ask: A refund for last month arrives today. Does your cumulative spend rewrite last month's tier history, and should it under this exercise's rules?
- when: default limit, coalesce, fallback → ask: A new model has no limits row for the lowest tier. What does your fallback give a team in that tier, and is that the behaviour you want?
- when: cache, redis, in memory → ask: A team crosses a threshold. How long until every request handler sees the new limits, and what does a request in between get?
- when: alias, model family → ask: An alias moves to a newer model with lower limits in one tier. Which limits apply to a request that named the alias one second before the move, and how does your model show it?

**Production Reality Check.**
- After a threshold version raised the thresholds, a nightly job recomputed every team's tier from the new version and moved 3% of teams down one of the {{tiers}} tiers; their requests were rejected the next morning, against the rule that a new version never demotes anyone.
- A model launched with limits for every tier but the lowest. The lookup defaulted the missing row to zero, and every request from lowest-tier teams to that model was rejected for most of a day with a message that pointed at the team's usage.
- A chargeback reversed the payment that had moved a team up a tier. By rule the tier stayed, but finance asked for it to be reviewed, and the model had no place to record a manual decision, its reason or who made it.

**Evaluation Criteria.** Ledger entries as immutable facts with a stated rule for what counts; cumulative spend and tier history derived, with each tier interval tied to its cause; threshold versions applied from their effective time without retroactive demotion; limits per (model, tier) as versioned rows with aliases resolved as of the request; a missing limits row treated as "not offered", never zero; an as-of query that reconstructs any past request's limits; an incremental path for crossings within minutes; the incidents explained by the model and fixed without rewriting history.

## XAI-L3-02: Public posts as retrieval documents — versions, edits, deletions, reposts and quotes, and the exact version a request retrieved

| | |
|---|---|
| **Template ID** | XAI-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / entity versus version, tombstones that outlive content, derived documents with dependencies, retrieval provenance without copies |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer, ai-infra-engineer, ml-platform-engineer |

```params
{
  "posts_per_day": {"1": ["40 million"], "2": ["200 million"], "3": ["600 million", "1 billion"]},
  "edit_window_minutes": [30, 60],
  "delete_sla": ["60 seconds", "5 minutes"],
  "index_days": [7, 30, 90]
}
```

**Business Scenario.** A model API offers a server-side tool that searches recent public posts, so a response can cite them. Posts arrive with a given schema: a post id, an opaque author key, a creation time, text (synthetic tokens in this exercise), a language label from a classifier you are given (with its version), and optional `reply_to`, `quote_of` and `repost_of` references; edits and deletions arrive later as events. About {{posts_per_day}} posts arrive a day. In this exercise's rules (check current docs): an author can edit a post within {{edit_window_minutes}} minutes of posting, and each edit makes a new version; a deleted post must leave retrieval within {{delete_sla}}; and the index holds the last {{index_days}} days. Teams using the tool ask which version of a post their response retrieved and cited.

**Problem Statement.** Design the data model for public posts as retrieval documents. Cover post identity and versions; deletion as a tombstone; reposts and quotes; language labels with the classifier version that produced them; the documents the index holds (what a quote's document contains, and whether reposts get documents at all); and a retrieval record that says exactly which post version each request retrieved and cited, without keeping deleted content anywhere.

**Constraints.** No post content beyond what the schema gives. Authors appear only as opaque keys and only in aggregate; nothing in the model builds a profile of an author. A deletion removes the post's text from every copy (versions, index documents, caches, any document that embedded it) within {{delete_sla}}, and the tombstone keeps only ids and times. A repost has no text of its own. Retrieval records keep ids and version numbers, never text. Ordering of results is a scoring function you are given and is out of scope.

**Assumptions.** Volumes, windows, the deletion target and retention are hypothetical. The classifier, the embedding model and the scoring function are given to you as versioned black boxes. The ingestion pipeline itself is out of scope; you design what it writes.

**Clarifications.**
- Q: Does an edit get a new post id? | A: No. Same post id, a new version number. An earlier response may have retrieved the earlier version.
- Q: Should reposts be searchable? | A: Your choice; say what a search that matches an original returns when ten thousand reposts of it exist.
- Q: Can a deleted post come back? | A: Not in this exercise.
- Q: Can the language label change? | A: Yes. The classifier is re-run when it is upgraded, and some labels change.
- Q: Months later, must we show the text a response cited? | A: Only while the post exists and within the index's retention; after a deletion only ids remain.

**Hints.**
1. Separate three things: the post (identity and status), its versions (text and times), and index documents (what the search reads), each with its own key.
2. A quote's document depends on the quoted post. Record that dependency so a deletion or edit can find every document to rebuild.
3. Log retrieval by (post id, version, index generation or time), not by copying what was shown.

**Follow-ups.**
1. List the rows that exist after a post is created, edited once, quoted by another post, reposted twice, and then deleted.
2. A response retrieves version 1 of a post; an edit lands 20 seconds later. What does the team's citation link show, and what does your retrieval record say?
3. A post is reposted 50 000 times in an hour. How does your document model keep a search from returning many copies of the same text?
4. The language classifier is upgraded and relabels 8% of posts. How do the label rows, the index and past retrieval records reflect it?
5. Estimate rows and bytes a day for versions, documents and retrieval records at {{posts_per_day}}, and how {{index_days}} days of retention bound them.

**Follow-up rules.**
- when: soft delete, is_deleted, deleted flag → ask: Your row is flagged deleted, but its text is still in it. Where else does that text live, and how do you show it is gone from all of them within {{delete_sla}}?
- when: overwrite, update the text, latest version → ask: A team asks which words their response cited yesterday, and the post was edited since. What does your model return?
- when: denormalise, denormalize, copy the text, embed the quoted → ask: The quoted post is deleted. Which documents still contain its text, and how do you find them all?
- when: author_id, author table, profile → ask: Authors appear here only in aggregate. Which questions need the author key at all, and what stops this model from becoming a profile of a person?
- when: embedding, vector → ask: An edit changes three tokens. Do you re-embed, and what does a search between the edit and the new embedding return?

**Production Reality Check.**
- A post deleted at 10:00 was cited in a response at 10:40, far past the {{delete_sla}} rule: the deletion removed the latest version's document, but a document for an earlier version was still in the index.
- After an edit, a team's console showed the edited text beside a citation made before the edit; the retrieval record kept only the post id, so nobody could say which version had been cited.
- A quote post's document still carried the text of a quoted post deleted the day before, because quote documents were built once at ingest and nothing recorded which documents depended on which post.

**Evaluation Criteria.** Post, version and document kept as separate keyed entities; edits as versions within the edit window; deletion as a tombstone that removes text from every copy within the target, with dependencies recorded so quotes are rebuilt; reposts resolved to their original rather than indexed as copies; labels stored with their classifier version; retrieval records with post id, version and index generation and no text; authors as opaque keys used only in aggregate; sizing tied to {{posts_per_day}} and {{index_days}} days; the incidents traced to missing versions, missing dependencies or incomplete deletion.

## XAI-L3-03: Tool calls and citations as data — the searches a response ran, the results returned, and citations attached to spans

| | |
|---|---|
| **Template ID** | XAI-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / per-call results versus global sources, span offsets in a stated unit, many-to-many citations, canonical URLs, retention |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ai-infra-engineer |

```params
{
  "responses_per_day": {"1": ["5 million"], "2": ["40 million"], "3": ["200 million"]},
  "calls_per_response": ["up to 4", "up to 10"],
  "results_per_call": [10, 20],
  "retention_days": [30, 90]
}
```

**Business Scenario.** A model API can run server-side tools inside a response: a web search and a search over public posts. In this exercise the model may run {{calls_per_response}} tool calls in one response; each call returns up to {{results_per_call}} results ordered by a scoring function you are given; and the final response attaches citations to spans of its text, each pointing at a result. About {{responses_per_day}} responses a day use tools. A team's console shows, per response, the searches run, what came back and which sources were cited; analysts ask how often a source or domain is cited across responses; and a team's tool data is kept {{retention_days}} days (this exercise's rule; check current docs).

**Problem Statement.** Design the data model: responses; tool calls (tool, parameters, status, position in the response); results per call (rank, source); sources (a web page by canonical URL and domain, or a public post by id and version); and citations (a span of the response text and the result it cites). Say which unit span offsets use, how a source returned by two calls stays one source, how a streamed response's citations are attached, and how the data expires per team.

**Constraints.** Span offsets use one stated unit over the final response text; clients that count differently convert at the edge. A citation must reference a result returned in the same response; a citation the model produced for something no call returned is kept and flagged, never silently dropped. A post source records the post's version; a deleted post keeps only its id and version here. Web page content is not stored: only the canonical URL, domain, title hash and fetch time. A tool call's parameters can contain the team's own text and are treated as the team's data, deleted with it.

**Assumptions.** Volumes, limits and retention are hypothetical. Billing of tool calls and per-tool latency monitoring are out of scope here. The scoring function, the canonicalisation rules and the post schema are given; your model must record which version of each it used.

**Clarifications.**
- Q: Can one span cite several sources? | A: Yes, and one source can be cited by several spans.
- Q: Is the response streamed? | A: Yes. In this exercise citations arrive at the end, with offsets into the final text.
- Q: Two calls return the same URL. One source or two? | A: One source, two results. Say how URLs are canonicalised and where the rule lives.
- Q: Are failed tool calls kept? | A: Yes, with their status; a response may continue without them.
- Q: Does a citation keep the snippet that was shown? | A: Not the text: a hash and offsets are enough for this exercise.

**Hints.**
1. Results belong to a call; sources are shared; citations point at results, which keeps "which call found it" answerable.
2. Choose one offset unit (for example Unicode code points of the final text), store it, and name it in the schema.
3. Canonicalisation is a versioned rule; store the raw URL and the canonical one, with the rule version.

**Follow-ups.**
1. Draw the rows for one response that ran two searches, got 15 results, and cited four spans, two of them the same URL found by both searches.
2. A client renders text in UTF-16. How do you convert offsets, and how would you test the conversion?
3. Write the query: per team and day, the share of tool-using responses with at least one citation, and the most-cited domains, counting a response once per domain.
4. A post cited in a response is deleted. What does the console show afterwards, and which rows change?
5. At {{responses_per_day}}, which tables are append-only facts, how would you partition them, and how do you expire a team's rows after {{retention_days}} days?

**Follow-up rules.**
- when: json, blob, store the response → ask: Analysts ask for last week's most-cited domains. How do they query citations kept in one JSON document per response at {{responses_per_day}} a day?
- when: byte offset, utf-8, character offset, utf-16 → ask: Which unit are your offsets in, and what happens to a citation in a response containing emoji when a client counts in a different unit?
- when: url, link, domain → ask: The same article arrives as http and https, with tracking parameters and a trailing slash. Is that one source or four, and where is the rule kept?
- when: source_id, foreign key → ask: A citation points straight at a source. Two calls returned that source; how do you tell which result the model used?

**Production Reality Check.**
- After a client library release, citations in responses containing non-ASCII text highlighted the wrong words: the server counted UTF-8 bytes and the library counted UTF-16 code units.
- A "citations per response" chart doubled after a release: each citation was joined to every result with the same URL, and with {{calls_per_response}} calls per response the same URL often came back twice.
- Citations to deleted posts kept showing the post's text in team consoles for weeks, from a cache keyed by post id that the deletion never reached.

**Evaluation Criteria.** Responses, calls, results, sources and citations as separate tables with clear keys; citations referencing results (not only sources); a stated offset unit with conversion at the edges; canonical URLs with a versioned rule; post sources with version and tombstone behaviour; unreturned citations flagged; parameters treated as the team's data with per-team expiry; partitioning sized to {{responses_per_day}}; the incidents traced to offset units, join grain and copies that deletions did not reach.

## XAI-L3-04: Regional endpoints as data — models per region, versioned price multipliers, residency settings, and the region that served each request

| | |
|---|---|
| **Template ID** | XAI-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / effective-dated availability and multipliers, settings history, decisions recorded on the fact, exact money, invoice reconciliation |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer, ai-infra-engineer |

```params
{
  "regions": [3, 5, 8],
  "requests_per_day": {"1": ["20 million"], "2": ["200 million"], "3": ["1 billion"]},
  "pinned_share": ["5%", "20%"],
  "models": [6, 10]
}
```

**Business Scenario.** A model API offers a global endpoint and regional endpoints in {{regions}} regions. In this exercise (check current docs for the real rules): a request served through a regional endpoint is billed at the model's base price times that region's price multiplier, and multipliers change at announced times; not every one of the {{models}} models is offered in every region; and a team can set a residency setting that pins its requests to one region or a set of regions. About {{pinned_share}} of teams use one. The platform serves about {{requests_per_day}} requests a day. Teams ask why a request cost what it did and where it was served; finance needs every invoice line to match the console.

**Problem Statement.** Design the data model: regions and their endpoints; model availability per region over time; price multiplier versions; base price versions per model; each team's residency setting history; and a request fact that records the endpoint called, the region that served it, the model version, the multiplier version and base price version applied, and the exact cost. Then show how a team's monthly cost per region is reproduced from the facts and checked against the invoice.

**Constraints.** Money and multipliers are exact (integer micro-cents and decimal multipliers, or another exact scheme you state). In this exercise the multiplier and base price in force at the time a request is received apply, whenever it finishes. A pinned team's request is never served outside its allowed regions; if that ever happens, the fact must show it. A pinned team calling a model not offered in its region gets an explicit error, never a silent reroute. History is never overwritten. Request content stays in the region that served it; only billing fields (counts, tokens, cost, versions) are aggregated across regions.

**Assumptions.** Region counts, model counts, volumes, prices and multipliers are hypothetical. The global endpoint bills at base price in this exercise. Routing and failover machinery is out of scope; you design the data it reads and writes.

**Clarifications.**
- Q: A multiplier changes at 00:00 UTC. Which applies to a request received at 23:59:59 that finishes at 00:00:05? | A: The one in force when it was received, in this exercise.
- Q: Can a team change its residency setting? | A: Yes, effective from when it is saved; requests already received keep the setting they started with.
- Q: Is the base price the same in every region? | A: Yes; base prices are versioned separately from multipliers.
- Q: Can a model be withdrawn from a region? | A: Yes, with an announced end date; pinned teams must be told before it happens.
- Q: Does the invoice show regions? | A: Yes: one line per model, region and price version within the month.

**Hints.**
1. Keep three effective-dated things apart: model availability per region, multipliers, and residency settings.
2. Put the decisions on the fact (versions applied, region served, setting version), so billing never re-derives them from tables that changed since.
3. The endpoint a team called and the region that served the request are different columns.

**Follow-ups.**
1. Write the query that recomputes one team's monthly cost per region and price version from request facts and compares it to its invoice lines.
2. A multiplier change announced for the 1st was entered with the 2nd as its effective date and found on the 10th. How do you correct invoices already issued, and what do the version rows look like afterwards?
3. A model is withdrawn from one region. Which rows change, and what do pinned teams see before and after the end date?
4. Across {{regions}} regions, how do you keep request facts in region and still produce one global usage console and one invoice per team?

**Follow-up rules.**
- when: float, double → ask: A multiplier of 1.1 on a price of a fraction of a cent per thousand tokens, summed over {{requests_per_day}} requests: what type keeps the invoice equal to the console?
- when: region column, current region, region on the team → ask: A team changed its residency setting last week. From your model, which regions was it pinned to when last Monday's request was served?
- when: at invoice time, join the multiplier, look up the multiplier → ask: The multiplier changed mid-month. Does looking it up at invoice time give the same answer as the price recorded at request time, and which one does the team expect?
- when: failover, fallback region, reroute → ask: The pinned region is unavailable. What does your model record for a request the policy refused, and for one that was served elsewhere by mistake?

**Production Reality Check.**
- A multiplier change at 00:00 UTC was applied by received time in the request facts but by completion time in the invoice job; one region's monthly invoice line differed from the console for long-running requests that straddled midnight.
- A team pinned to one region saw requests in its console marked as served in another during an incident. The facts recorded only the endpoint called, so nobody could tell the team which requests had been served outside its region.
- A model withdrawn from one of the {{regions}} regions kept appearing as available, because availability rows had no end dates; pinned teams got generic errors instead of a clear "not offered in this region".

**Evaluation Criteria.** Regions, endpoints, availability, multipliers, base prices and residency settings as effective-dated rows; the request fact recording endpoint called, region served, setting version and every price version applied; exact money with a stated rounding point; received time as the pricing instant, applied the same way in facts and invoices; withdrawals with end dates and explicit errors; content kept in region with only billing fields aggregated; an invoice reproducible from facts; the incidents explained by missing columns or inconsistent time rules.

## XAI-L3-05: Spend tier reached — the first day each threshold was met, and rate-limit rejections in the week either side

| | |
|---|---|
| **Template ID** | XAI-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / running sums per day, effective-dated thresholds, first-crossing dates, date windows on timestamps, incomplete windows as NULL |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |
| **Generator** | XAI-L3-05.mjs |

**Business Scenario.** A model API limits each team, per model, in requests per second and tokens per minute, and the limits rise with the team's spend tier: a team reaches a tier when its cumulative spend reaches the tier's threshold (this exercise's tiers and thresholds; check current docs for the real ones). Developer relations want to know whether upgrades relieve throttling. For every team and every tier it reached in the sample, they want the day it reached the tier and the team's rate-limit rejections in the week before and the week after. The sample covers `{{first_day}}` to `{{last_day}}`, {{team_count}} teams and {{tier_count}} tiers.

**Problem Statement.** Write one PostgreSQL query that returns `team_id, tier, reached_on, rejected_7d_before, rejected_7d_after`, one row per team and tier reached, ordered by `team_id, tier`.
- A team's cumulative spend at the end of a UTC day D is the sum of `amount_cents` over its `spend_events` of kind `charge` or `refund` with `occurred_at` on or before D (refund amounts are negative). Rows of kind `promotional_credit` are usage paid by free credits and never count. {{kinds_rule}} All of each team's spend falls inside the sample.
- Tier k's threshold on day D is the `min_spend_cents` of the `tier_thresholds` row for tier k with `effective_from <= D` and (`effective_to` IS NULL or D < `effective_to`). {{threshold_rule}}
- A team reaches tier k on the first day of the sample whose end-of-day cumulative spend is at least that day's threshold for k. Spend that crosses a threshold during a day and is refunded the same day does not reach it. A tier is reached once: dipping below it later and crossing again adds nothing. Several tiers can be reached on the same day.
- `rejected_7d_before` is the number of `request_errors` rows for the team with `status_code` 429 and `requested_at` on one of the 7 UTC days `reached_on − 7` through `reached_on − 1`; `rejected_7d_after` likewise for `reached_on + 1` through `reached_on + 7`. The day the tier was reached is in neither. A window with no such rows is 0. A window that does not lie wholly inside the sample (`{{first_day}}` to `{{last_day}}`) is NULL. {{window_rule}}

**Constraints.** One SQL statement (CTEs allowed). `occurred_at` and `requested_at` are `TIMESTAMPTZ`, and the session time zone is UTC. The sample has {{spend_rows}} spend events and {{error_rows}} error rows; in production there are hundreds of thousands of teams and a year of history.

**Assumptions.** Hypothetical teams, amounts, thresholds, models and errors. `model` and `limit_hit` are context only. The comparison is a simple before and after, not a causal estimate: a team's own traffic changes around an upgrade too.

**Clarifications.**
- Q: Is spend checked after every charge, or once a day? | A: Once per UTC day, at the end of the day.
- Q: A refund takes a team back below a tier it reached. Does it lose the tier here? | A: No. This report gives the first day the tier was reached, once.
- Q: Do 400, 500 and 503 rows count as rejections? | A: No. Only 429 is a rate-limit rejection.
- Q: Can a team reach a tier on a day it spent nothing? | A: Apply the rules as written: each day uses the threshold in force on that day.
- Q: What if only part of a window is inside the sample? | A: That window's count is NULL, not a partial count.

**Hints.**
1. Net the counted spend per team and UTC day, then take a running `SUM(...) OVER (PARTITION BY team_id ORDER BY day)`.
2. Join each team-day to the threshold rows in force that day, keep the rows where cumulative spend is at least the threshold, and take `MIN(day)` per team and tier.
3. Count the 429s by `requested_at::date` between two dates (or with half-open timestamp bounds), and wrap each count in a `CASE` that returns NULL for a window that runs off the sample.
4. If a threshold can change on a day a team spent nothing, a running total over spend days only never looks at that day; a calendar (`generate_series`) per team does.

**Follow-ups.**
1. Rejections fall after most upgrades. What else changes for a team around an upgrade that could explain it, and what would you compare against?
2. Spend events can arrive up to two days late. How does that change `reached_on`, and how would you keep a published report stable?
3. At production scale, what would you store per team so that a new crossing is found without rescanning the ledger, and what forces a recompute?
4. Split the rejections by `limit_hit`. If requests-per-second rejections fall after an upgrade and tokens-per-minute rejections do not, what does that suggest about the tier's limits or the team's traffic?

**Follow-up rules.**
- when: lag(, lag → ask: LAG finds the days spend crossed a threshold. A team dips below a tier and crosses again; how many rows does your query return for that tier, and which date?
- when: <= reached_on + 7, requested_at <= → ask: `requested_at` is a timestamp. Which of the seventh day's rejections does `requested_at <= reached_on + 7` keep?
- when: status_code >= 400, status_code <> 200, <> 200 → ask: Which rows are you counting? Is every failed request a rate-limit rejection?
- when: rows between, unbounded preceding, running total → ask: Is your running total per event or per day? A charge that crossed a threshold at 09:00 was refunded at 17:00; does your query say the team reached the tier?
- when: generate_series, calendar → ask: How many rows does your calendar produce for a few hundred thousand teams over a year, and could you check only the days with spend plus the days a threshold version starts?

**Production Reality Check.**
- After a threshold version lowered one tier's threshold, the tier report missed every team that qualified on the day the version took effect: the job evaluated only teams with spend events that day.
- A dashboard built on this report counted all 4xx and 5xx responses as throttling, so a one-day outage looked like a spike in rejections just before many upgrades.

**Evaluation Criteria.** Counted spend netted per UTC day with refunds and without promotional credits; a running total per team by day; thresholds joined as of each day; the first qualifying day per team and tier, once; windows on whole UTC days that exclude the reached day; only 429s counted; NULL for windows that leave the sample; deterministic order; can discuss confounders, late spend, incremental crossings and splitting by limit type.
