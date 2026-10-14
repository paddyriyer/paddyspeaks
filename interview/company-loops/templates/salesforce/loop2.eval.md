# Salesforce · Loop 2 — evaluator notes (hidden from candidates)

## SFC-L2-01

**Reference solution**

```python reference
def recalc_order(formulas, edits):
    readers = {}                      # field -> formulas that read it, each once
    pending = {}                      # formula -> distinct formula fields it reads
    for f, refs in formulas.items():
        distinct = set(refs)
        pending[f] = sum(1 for x in distinct if x in formulas)
        for x in distinct:
            readers.setdefault(x, []).append(f)
    level = {}
    layer = [f for f, n in pending.items() if n == 0]
    depth = 1
    while layer:                      # Kahn's algorithm, one layer per level
        nxt = []
        for f in layer:
            level[f] = depth
            for g in readers.get(f, ()):
                pending[g] -= 1
                if pending[g] == 0:
                    nxt.append(g)
        layer = nxt
        depth += 1
    if len(level) < len(formulas):
        return None                   # some formula is on, or behind, a cycle
    out = []
    for edit in edits:
        hit = set()
        stack = list(edit)
        while stack:
            for g in readers.get(stack.pop(), ()):
                if g not in hit:
                    hit.add(g)
                    stack.append(g)
        out.append(sorted(hit, key=lambda f: (level[f], f)))
    return out
```

**Explanation.** Build the reverse map once: for each field, the formulas that read it, each formula listed once even when its expression names the field twice. Kahn's algorithm, processed one layer at a time, assigns levels: the first layer is every formula with no formula inputs (level 1), and a formula joins the next layer when its last formula input is removed, which is exactly one more than the highest level among its inputs. Counting *distinct* formula inputs matters: a formula that names `Net__c` twice would otherwise wait for two removals that never come and look like a cycle. Any formula that never reaches in-degree zero is on a cycle or reads one, so the configuration is rejected with `None` before any save is answered, whether or not a save reaches the cycle. For each save, a walk over the reverse map from the edited fields collects every formula that can change, and sorting by `(level, name)` gives the order. Every formula's inputs have strictly lower levels, so the order is a valid evaluation order, and the name breaks ties so the answer is unique.

**Complexity.** O(V + E) once for the reverse map and the levels, then O(A + E_A + A log A) per save, where A is the number of affected formulas and E_A their outgoing references. The timing test (37 500 formulas, about 75 000 references, 3 000 saves, about 18 affected formulas per save) runs in about 0.2 s in CPython. A fixed point over every formula for every save takes about 0.08 s per save on the same data, about four minutes in total; a single topological pass over the whole configuration per save is O(saves · (V + E)) and still takes about a minute.

**Dialect notes.** In Java or C++ use adjacency lists of ints after interning names, an int array of in-degrees and an explicit stack; sort affected ids with a comparator on (level, name). In SQL the affected set is a recursive CTE over a `formula_reads(formula, field)` table and the level a second recursive CTE with `MAX`; cycle detection needs a depth cap or PostgreSQL's `CYCLE` clause, and engines differ (Snowflake and BigQuery support recursive CTEs with iteration limits). Not executed here.

**Edge cases built into the tests.** A chain whose names sort opposite to its levels; a diamond (the shared formula once, after both parents); equal levels ordered by name; a formula that reads the edited field directly and a level-2 formula (level 3, not 1); levels taken from the whole configuration, not the edit; an edit no formula reads (`[]`); a two-field cycle (`None`); several saves in order; (Hard) a field read twice, a referenced name no formula defines, a twelve-level chain; (Very Hard) a self-reference, a cycle no save reaches, an empty save and a repeated field, no saves at all (`[]`).

**Common mistakes.** Ordering by distance from the edited field (BFS depth) instead of the global level; computing levels only over the affected subgraph; counting repeated references in the in-degree, which turns `[X, X]` into a false cycle; returning `None` only when a save reaches the cycle; including the edited input fields in the output; recursion depth errors on long chains (not exercised by the tests beyond twelve levels, but worth asking about); recomputing levels per save.

**Follow-up guidance.** (1) Cross-object references make the reverse map span objects: a parent field fans out to every child record. Plan per (object, field) once, then multiply by the child count; batch child updates and consider deferring them asynchronously with a freshness flag on the cached values. (2) Early cut-off: evaluate in level order and only enqueue a formula's readers when its value actually changed. The static order is still valid; the affected set becomes dynamic. (3) A changed formula only affects the levels of its descendants; recompute levels for the reachable subgraph, and note that adding a reference at the bottom of a long chain can raise thousands of levels. Reject cycles at save time of the metadata. (4) Cache the plan per (org, object, metadata version); invalidate on deploy by bumping the version, and precompute plans for frequent edit sets lazily.

**Rubric anchors.** 2: correct affected sets but the wrong order (alphabetical or BFS depth), or cycles missed; several edge tests fail. 3: all tests pass with levels computed once and a per-save walk. 4: also explains why (level, name) is a valid evaluation order, handles repeated references deliberately, states both complexities, and gives a credible answer on cross-object fan-out and early cut-off.

**Strong signals.** Asks whether the level is global or relative to the edit; asks what to do with a cycle no save reaches; mentions that Kahn's algorithm finds the cycle and the levels in one pass. **Red flags.** A fixed point per save defended as "graphs are small"; returning a partial order when there is a cycle.

## SFC-L2-02

**Reference solution**

```python reference
def match_leads(accounts, leads, public_domains):
    owners = {}                                   # domain -> set of account ids
    for account_id, domains in accounts:
        for d in domains:
            owners.setdefault(d.strip().lower(), set()).add(account_id)
    public = {d.strip().lower() for d in public_domains}
    out = []
    for email in leads:
        _, at, domain = email.strip().rpartition("@")
        domain = domain.lower()
        if not at or not domain:
            out.append(None)                      # no @, or nothing after it
            continue
        best = None
        suffix = domain
        while True:                               # longest suffix first, one label at a time
            if suffix in public:
                best = None
                break
            if best is None and suffix in owners:
                best = owners[suffix]             # keep walking: a shorter public suffix still wins
            dot = suffix.find(".")
            if dot < 0:
                break
            suffix = suffix[dot + 1:]
        out.append(next(iter(best)) if best is not None and len(best) == 1 else None)
    return out
```

**Explanation.** Every account domain goes into a dict from normalised domain to the set of accounts that list it; a set makes a domain listed twice by one account count once. For a lead, `rpartition("@")` takes the text after the last `@` and also tells you whether there was an `@` at all. The suffixes of the lead's domain that start at a label boundary are the domain itself and each text after a dot. Walking them from longest to shortest, the first suffix an account claims is the longest matching account domain. The walk continues to the end anyway, because a shorter suffix may be a public domain (`uk.yahoo.com` claimed by an account, `yahoo.com` public), and the public rule wins. If the longest claimed suffix has more than one owner the lead is ambiguous and gets `None`, with no fallback to a shorter domain.

**Complexity.** Building the dict is O(total domain length). Each lead costs O(L²) character work for L labels in the worst case because each suffix is a new string, which is tiny for real domains; a trie of reversed labels gets O(L) but is slower in CPython. The timing test (40 000 accounts, about 80 000 domains, 150 000 leads) runs in about 0.6 s in CPython. Comparing every lead with every account domain is about 1.2 × 10¹⁰ `endswith` calls: about 0.02 s per lead, nearly an hour in total.

**Dialect notes.** In SQL, generate each lead's suffixes (split the domain into labels, then `ARRAY_TO_STRING` over a slice, or a recursive CTE), join to an `account_domains` table on equality, and keep the longest match per lead with `ROW_NUMBER()`; ambiguity is a `COUNT(DISTINCT account_id)` over the winning domain. A join on `lead_domain LIKE '%' || account_domain` is the naive scan and also matches across label boundaries. Snowflake has `SPLIT` and `ARRAY_SLICE`, BigQuery `SPLIT` and `ARRAY_TO_STRING` with offsets. Not executed here.

**Edge cases built into the tests.** A subdomain of an account's domain; the longest domain winning over a parent; a look-alike (`notacme.com`) and a domain with the account's domain in the middle (`acme.com.evil.net`); a public domain also listed by an account; a domain listed twice by one account; mixed case and surrounding spaces in emails and in account domains; emails with no `@`, nothing after it, or only a bare domain; an empty public list; (Hard) the longest match listed between two others, a public domain in upper case; (Very Hard) an ambiguous longest domain with no fallback, a quoted local part containing `@`, a subdomain of a public domain.

**Common mistakes.** `endswith(account_domain)` without the dot, matching `notacme.com`; `split("@")[1]`, which takes the wrong part with two `@` signs and raises with none; stopping the walk at the first claimed suffix before checking shorter public suffixes; falling back to the parent account when the longest domain is ambiguous; counting the same account twice as ambiguity; forgetting to normalise account or public domains; a regex built from all account domains.

**Follow-up guidance.** (1) Keep the dict as a long-lived index updated from account change events (add and remove a domain with its account id); rebuild from scratch nightly as a check. (2) A curated "domain group" table linking domains, owned by a person or an approved data source, not inferred from string similarity (`acme.co.uk` and `acme.com.au` can be unrelated companies). (3) Log every match with its rule and the ambiguous candidates, then measure acceptance and re-assignment rates by owners before automating ambiguity; beware a rule that rewards owners with many open deals. (4) The algorithm and public list can be shared; account domains and leads are each org's own data and the index is per org.

**Rubric anchors.** 2: substring or `endswith` matching without label boundaries, or an O(n · m) scan. 3: all tests pass with suffix lookups. 4: also explains why the walk continues after the first match, defends "no fallback" for ambiguity, and handles freshness and multi-tenancy credibly.

**Strong signals.** Asks how to treat an ambiguous domain before coding; tests `notacme.com` unprompted. **Red flags.** Matching on substrings; "pick the first account" for ambiguity.

## SFC-L2-03

**Reference solution** (the fixed rollup)

```python reference
from bisect import bisect_right

BUCKETS = ("closed", "commit", "best_case", "pipeline")
ROLLS_INTO = {                      # forecast category -> buckets it counts in
    "Closed": ("closed", "commit", "best_case", "pipeline"),
    "Commit": ("commit", "best_case", "pipeline"),
    "Best Case": ("best_case", "pipeline"),
    "Pipeline": ("pipeline",),
    "Omitted": (),                                                    # fix 1: counts nowhere
}


def _fiscal_quarter(close_date, fy_start):
    year, month = int(close_date[:4]), int(close_date[5:7])
    fy = year + 1 if fy_start > 1 and month >= fy_start else year     # fix 5: the first month belongs to the new year
    quarter = (month - fy_start) % 12 // 3 + 1
    return "FY%d-Q%d" % (fy, quarter)


def forecast_rollup(opps, split_rows, rates, corporate, fy_start):
    by_currency = {}
    for currency, effective, ppm in rates:
        by_currency.setdefault(currency, []).append((effective, ppm))
    for series in by_currency.values():
        series.sort()
    dates = {c: [d for d, _ in s] for c, s in by_currency.items()}
    splits = {}
    for opp_id, user, pct in split_rows:
        splits.setdefault(opp_id, []).append((user, pct))             # fix 3: keep every member

    out = {}
    for o in opps:
        if o["currency"] == corporate:
            ppm = 1_000_000
        else:
            i = bisect_right(dates[o["currency"]], o["close_date"]) - 1   # fix 2: a rate effective on the close date applies
            ppm = by_currency[o["currency"]][i][1]
        owner = max(o["owner_history"])[1]                            # fix 4: the latest change by date
        credits = splits.get(o["id"], [(owner, 100)])
        quarter = _fiscal_quarter(o["close_date"], fy_start)
        for user, pct in credits:
            amount = o["amount"] * pct * ppm // 100_000_000
            row = out.setdefault(user + "/" + quarter, dict.fromkeys(BUCKETS, 0))
            for bucket in ROLLS_INTO[o["category"]]:
                row[bucket] += amount
    return out
```

**The planted bugs, their symptoms and their fixes.**
1. **Omitted rolls into pipeline.** `ROLLS_INTO["Omitted"]` is `("pipeline",)`. Symptom: deals reps marked Omitted still inflate the pipeline. Fix: `()`. The row still exists, as the specification requires.
2. **Rate effective on the close date ignored.** `bisect_left(dates, close) - 1` gives the last rate strictly *before* the close date. Symptom: a deal closing on the day a new rate takes effect is converted at the old rate; for a close date equal to the earliest rate it even wraps to index −1, the newest rate. Fix: `bisect_right(...) - 1`.
3. **Split rows overwrite each other.** The dict comprehension keeps one `(user, pct)` per opportunity, the last row. Symptom: on a split deal only one member is credited, with their percent, and the total credited is less than the deal. Fix: collect a list of rows per opportunity.
4. **Owner taken from list order.** `owner_history[-1]` assumes the history is sorted by date, and the export is not. Symptom: some reassigned deals still count for the previous owner. Fix: the change with the latest date, `max(owner_history)[1]` (dates are distinct).
5. **First fiscal month in the previous year.** `month > fy_start` puts the first month of a fiscal year that starts after January in the old fiscal year (the quarter number is still right). Symptom: February deals with a February fiscal year land in last year's Q1, mixing with the previous February. Fix: `month >= fy_start`.

Each bug has its own check (an Omitted deal, a rate effective on the close date, a two-way split, an unsorted owner history, a February close with `fy_start = 2`), and fixing the other four leaves exactly that check (and some samples) failing. The Medium samples have a single owner, no splits and a January fiscal year, so they pass on the original code; the Hard and Very Hard samples fail until several bugs are fixed.

**Explanation.** The rollup is a pure function of four inputs: who gets credit (splits, else the current owner), how much in corporate currency (the dated rate on the close date, rounded down per credited user), which period (the fiscal quarter, named by the year the fiscal year ends), and which buckets (the cumulative category rule). Each bug breaks exactly one of them, and the symptoms are what a sales operations team would actually report.

**Complexity.** O(r log r) to sort rates, O(n log r) for the lookups, linear in split rows. The timing test (60 000 opportunities, 16 000 rates) runs in about 0.6 s in CPython.

**Dialect notes.** In SQL the dated rate is an as-of join: `LEFT JOIN LATERAL (SELECT ppm FROM rates r WHERE r.currency = o.currency AND r.effective_date <= o.close_date ORDER BY r.effective_date DESC LIMIT 1)` in PostgreSQL, `ASOF JOIN` in Snowflake, a `QUALIFY ROW_NUMBER()` in BigQuery. The same `<` versus `<=` bug appears there. The fiscal year is `EXTRACT(YEAR FROM close_date) + CASE WHEN fy_start > 1 AND EXTRACT(MONTH FROM close_date) >= fy_start THEN 1 ELSE 0 END`. Integer division of a product needs `NUMERIC` or `BIGINT`, never `FLOAT`. Not executed here.

**Edge cases built into the tests.** A Closed deal in every bucket and a Pipeline deal only in pipeline; Omitted deals keeping a zero row; a rate effective on the close date and one effective the day after; a two-way split of an odd amount rounded down per member; an owner history out of date order; a February close with a February fiscal year, and 31 January in the previous year's Q4; a November fiscal year across the calendar year; the corporate currency converting at exactly 1 even when a rate is listed for it.

**Common mistakes.** Fixing `bisect` by sorting rates descending and introducing a new off-by-one; dropping Omitted rows entirely (the specification keeps the row); rounding the converted amount before splitting, which double-rounds; sorting `owner_history` in place (it mutates the caller's data, though harmless here); "fixing" the fiscal year by naming it by the start year; rewriting the function instead of making minimal fixes.

**Follow-up guidance.** (1) Snapshot the inputs or the output: store the weekly rollup with the input versions (opportunity history as of Friday, the rate table version, the split rows), or rebuild from field history and effective-dated rates as of that timestamp. (2) Only rows whose close dates fall on or after the late rate's effective date and before the next rate change; recompute them, keep both versions and show leaders a change note. (3) Reject or quarantine at import with a validation that percents sum to 100 per opportunity; do not silently scale. (4) Replace the arithmetic with a lookup into a per-org fiscal calendar table of periods (start date, end date, year, quarter), which also handles 4-4-5 and 13-period calendars.

**Rubric anchors.** 2: finds two or three bugs, some checks still fail. 3: all five fixed with minimal changes, all checks pass, each explained. 4: also names each business symptom, explains the `bisect_left` wrap-around to index −1, adds a regression test per bug, and answers the reproducibility follow-up with versioned inputs.

**Strong signals.** Reproduces each complaint with a one-opportunity case; reads the `bisect` boundary carefully. **Red flags.** Converting with floats "to be safe"; changing the output format; deleting the Omitted category from the output.

## SFC-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Connectors.** A connector framework with a small contract per source type: pull (scheduled incremental queries against an API or warehouse with a stored high-water mark plus an overlap window), push (a streaming ingestion API with an event key, event time and an idempotency key per batch), and file drops (object-storage notifications). Credentials live in a per-org secret store, never in mappings. Retries are bounded with backoff; a connector that keeps failing is paused and the org administrator is told why.
- **Raw landing.** Every delivery lands raw and immutable under `org / source / ingest_date / batch`, with a manifest row: org, source, batch id, content hash, row count, schema fingerprint, received time. A redelivered file with the same hash is a no-op; a renamed copy of the same content is caught by the hash; a changed file for the same period is a new version. Streams land per org in a partitioned log, keyed by org and source so one org's replay stays on its own partitions.
- **Mapping and transformation.** Each org's mapping (source field to common-model field, with typed transformations) is stored as versioned configuration. A mapping save is validated (types, a dry run on a sample of the org's recent raw rows, alarms for suspicious changes such as a field mapped to a different semantic type) before it becomes active. The transformer reads raw batches and writes common-model tables, stamping every row with `org_id, source_id, source_key, source_ts, mapping_version, batch_id`. A mapping change triggers a replay of the affected sources from raw data, written to a new version and swapped atomically per org and source.
- **Common-model storage.** Lakehouse tables partitioned by org (and by date for events), with upserts keyed by `(org, source, source_key)` and ordered by `source_ts` then batch id, so replays and late events converge. Two sources describing the same order stay separate rows with their source.
- **Deletions.** Explicit delete events become tombstones. For full extracts, keys absent from today's extract become deletion candidates only if the extract passed sanity checks (row count within a band of the previous one, schema unchanged); otherwise the batch is held for review. Tombstones are applied within a day and propagated to downstream consumers as delete events.
- **Freshness.** Per org and source: the age of the newest row queryable in the common model, from event ingestion time for streams and from file arrival for batch, compared with {fast_freshness} and {batch_freshness}. Shown to administrators with the last successful batch, rows in and rows rejected, and the reason for any delay.
- **Isolation and fairness.** Every key and path starts with org id; queries are scoped by the platform, not by the client. Shared compute uses per-org quotas and separate queues for streaming and backfill work, so a backfill gets leftover capacity, never the streaming path's.

**Competing designs to accept.** A streaming-first design (everything through the log, files turned into events); a batch-first lakehouse with micro-batches for streams; ELT where raw data lands in the warehouse and mappings are SQL views materialised per org (accept if mapping versions and replays are explicit). Each is fine if idempotency, versioned mappings and per-org fairness hold.

**Bottlenecks and failure modes.** Small files from many small orgs; a single shared queue where backfills starve streams; mappings applied in place with no version, making errors unrepairable; deletions by absence on truncated files; schema drift silently writing nulls; freshness measured as queue lag rather than from the source's view.

**Incident guidance.**
- *Renamed duplicate file for 300 orgs*: the content hash catches it if checked per org and source; if rows already doubled, they share source keys, so the upsert should have absorbed them; doubling means some pipeline appended instead of merging. Identify affected batches from the manifest, delete the duplicate batch's rows by batch id and replay. Add hash checks independent of file names and a row-count anomaly alarm per source.
- *One org's backfill pushes others past {fast_freshness}*: backfill and streaming must use separate queues and quotas; throttle the backfill to its quota, let streaming catch up, and alert on per-org freshness, not only global lag. Long term, schedule large backfills on separate capacity.
- *Phone mapped into email*: the mapping save should have failed validation (values that do not parse as emails). Revert to the previous mapping version, replay the affected source from raw for that window, emit corrections downstream, and ask identity resolution to undo merges made with the bad values (their edges carry the source and mapping version). Add semantic validation and a staged rollout for mapping changes.

**Follow-up guidance.** (1) Replay from raw with the corrected mapping version into a shadow table, swap atomically, and publish a change notice; at {daily_records} a day estimate the replay window and prioritise recent data. (2) Additive columns flow in as unmapped; renamed or retyped columns stop the affected mapping with a clear error rather than writing nulls; dates parsed with an explicit per-source format. (3) No: hold the batch, alert, and require confirmation or a second consistent extract before deleting. (4) Separate backfill queue, per-org quotas and priorities. (5) A deletion ledger per request with each table's confirmation and the time it applied.

**Rubric anchors.** 2: connectors write straight into common tables; no raw retention, no mapping versions, freshness only as a global lag. 3: immutable raw landing with idempotency, versioned mappings stamped on rows, replay for remaps, deletions from events and absence, per-source freshness, per-org isolation. 4: also guards against truncated extracts, mapping validation and staged rollout, separate backfill capacity, and crisp incident responses.

**Strong signals.** Asks how a full extract signals deletion; stamps rows with mapping versions without being prompted. **Red flags.** "Overwrite with the latest file"; isolation by client-side filters; one global queue for all orgs.

## SFC-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Events.** Each run emits `run_started`, element events (`element_id`, type, start offset, duration, outcome, queries and DML rows used) and `run_finished` with outcome, total duration, limit use, flow id and version, org id, triggering record id and object, the record ids it changed and the trigger type. Faults carry the element, an error class, a message template with record ids but no field values, and the limit that was hit if any. Values are excluded by an allowlist of fields that telemetry may contain, not a denylist.
- **Chain identity.** Each save gets a `chain_id`; every run gets `run_id`, `parent_run_id` and a `depth`. The transaction context carries them, and any asynchronous work (queued jobs, scheduled paths, platform events) stores the chain context in its message, so a step two hours later continues the same chain. A chain also records why each run started (record changed by run X, event published by run Y).
- **Emission.** The runtime writes events to a bounded in-memory buffer per application server and a background shipper sends them in batches to a durable log. If the buffer is full, events are dropped and a drop counter (per org and outcome) is shipped; saves never wait. Faults and slow runs go to a priority buffer so they are dropped last.
- **Transport and processing.** A partitioned log keyed by org id (large orgs spread by flow id). A stream processor builds per-minute aggregates per (org, flow, version, element): run counts by outcome, duration sketches for percentiles, limit use, fault counts by class. Exact counts come from all runs, including sampled-out ones, because counting happens before sampling.
- **Sampling and storage.** Keep all faulted, slow (above a per-flow threshold) and limit-stopped runs in full detail; sample fast successes per flow at a rate that keeps the volume of {daily_runs} affordable, with the sampling rate stored so estimates can be scaled. Detail is kept {detail_retention} in a columnar store partitioned by org and day; aggregates are kept for 13 months. A per-record index (org, record id, time) points to chains that touched the record.
- **Administrator views.** For one record: the chains that changed it, as a tree of runs with elements and timings. For one flow: runs, faults, p50/p95 by version and element. For the org: top flows by time, fault rate and limit use, and loops (chains hitting the {max_depth}-level limit).
- **Privacy and isolation.** Every row has org id; the query service enforces it. Field-value capture is an explicit, time-boxed debug session per flow or user, with an expiry enforced by the platform, an audit record and a separate store with short retention.

**Competing designs to accept.** OpenTelemetry-style traces with spans per run and element, exported to a tracing backend with tail-based sampling; event logs into a lakehouse with batch aggregation (accept if the one-minute fault visibility is met by a streaming path); storing every run in full for small tiers. Each is fine if saves are never blocked and chains are reconstructable.

**Bottlenecks and failure modes.** Synchronous telemetry writes inside the save; unbounded buffers on application servers; sampling before counting, which breaks totals; chain context lost on asynchronous hops; field values leaking into fault messages; one org's loop flooding shared partitions and storage.

**Incident guidance.**
- *A loop produces 30% of runs, all stopped at {max_depth} levels*: per-org quotas on the telemetry path keep other orgs' data flowing; aggregates still count every run exactly; keep full detail for a sample of the looping chains, not all of them; alert the administrator with the cycle of flows involved, derived from the chain tree.
- *Buffer full during a storage outage, four minutes of successes dropped*: the drop counters say exactly how many runs per org and flow are missing; aggregates built upstream of the store (or from the counters) still show totals. Tell the administrator the window has no detail for successful runs; faults were in the priority buffer. Afterwards, size the buffer or spill to local disk.
- *Debug value capture never switched off*: the platform should enforce expiry; here it did not. Stop the capture, delete the captured values beyond the session's intended window, notify the org's administrator, and treat it under the privacy incident process. Prevention: mandatory expiry, an alarm on long-running sessions and a review of every active session.

**Follow-up guidance.** (1) Record index lookup → chains that touched the account → the run that wrote the field → its parent chain back to the save. (2) Aggregates sliced by an attribute such as owner type or queue (a dimension of the record, not a value), plus full detail for every faulted run. (3) Detect loops from repeated (flow, record) pairs within a chain; cap detail; notify. (4) Count before sampling; percentiles from per-minute sketches of all durations, or from samples weighted by their inverse rate. (5) Compare versions by matched time windows and trigger types; watch for a different mix of records after deployment.

**Rubric anchors.** 2: write a log row per run synchronously; no chain ids; field values in the log. 3: non-blocking emission, chain and parent ids across async work, aggregates plus sampled detail with faults always kept, per-org isolation. 4: also exact counts under sampling, drop accounting, loop detection, audited and time-boxed value capture, and clear incident handling.

**Strong signals.** Says telemetry failure must not fail a save before designing storage; carries trace context through queued work. **Red flags.** Synchronous writes in the transaction; capturing record values by default; one shared table without org scoping.
