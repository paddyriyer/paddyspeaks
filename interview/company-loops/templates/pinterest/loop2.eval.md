# Pinterest · Loop 2 — evaluator notes (hidden from candidates)

## PIN-L2-01

**Reference solution**

```python reference
import heapq


def price_drop_alerts(saves, prices, pct=90):
    # One sweep over days. On a day, price rows (kind 0) come before saves (kind 1),
    # so a save takes that day's price and can only alert on a later day.
    events = [(day, 0, product, price) for product, day, price in prices]
    events += [(day, 1, product, i) for i, (product, day) in enumerate(saves)]
    events.sort(key=lambda e: (e[0], e[1]))
    current = {}          # product -> price in force (None while out of stock)
    pending = {}          # product -> max-heap of (-pct * saved price, save index)
    out = [-1] * len(saves)
    for day, kind, product, x in events:
        if kind == 0:
            current[product] = x
            if x is None:
                continue                      # out of stock: nothing can alert today
            heap = pending.get(product)
            limit = 100 * x
            while heap and -heap[0][0] >= limit:
                out[heapq.heappop(heap)[1]] = day
        else:
            price = current.get(product)
            if price is not None:             # no price yet, or out of stock: never alerts
                heapq.heappush(pending.setdefault(product, []), (-pct * price, x))
    return out
```

**Explanation.** Each save becomes a pending threshold `pct × saved price` on its product. A later price `p` triggers every pending save of that product whose threshold is at least `100 × p`. The pending saves with the highest thresholds trigger first, so a max-heap per product answers "who alerts today?" by popping from the top until the top no longer qualifies. Every save is pushed once and popped at most once. Sorting rows and saves together by `(day, kind)` with price rows first gives the two same-day rules in one place: a row dated the save day sets the saved price, and alerts only happen on later days. Because a price holds until the next row, the first qualifying day is always a row's day, so only rows need to be visited. An out-of-stock row updates the current price to `None` and pops nothing, and a save made while out of stock is never pushed.

**Complexity.** O((s + d) log(s + d)) for the sort, plus O(s log s) heap work, for s saves and d price rows. O(s + d) memory. The timing test (150 000 saves, 20 products, 4 000 days) runs in about 0.6 s in CPython. A forward scan per save, with a bisect to the save day first, takes about 16 to 25 s, depending on the level, because most saves stay pending for thousands of rows; that is 25 to 40 times slower and well over the 8 s limit.

**The middle approach.** The most likely middle solution sweeps days correctly but keeps each product's pending saves in a plain list and checks the whole list on every price row. It is O(d · pending) and takes 25 to 55 s on the timing test, so it fails. A sorted list of thresholds per product with `bisect.insort` and popping from the high end is O(log s) comparisons and O(s) memory moves per insert in C. It passes comfortably and is an acceptable answer. So is a segment tree or sparse table of minimum prices per product, with a "first index after the save whose price is at most the threshold" descent per save, at O((s + d) log d).

**Dialect notes.** In Java use a `PriorityQueue<long[]>` per product with a reversed comparator, and `long` for `pct × price` (cents times 100 stays far from overflow, but say so). In SQL the per-save answer is a correlated `MIN(day)` over later rows with `100 * price <= pct * saved_price`, joined to the as-of saved price. That is correct and set-based, but it is the same O(s·d) scan unless the engine can use an index on `(product, day)` with a price predicate it cannot range-scan. A warehouse would batch it per product and day, and an incremental daily run would keep pending thresholds in a table. Not executed here.

**Edge cases built into the tests.** A price of exactly `pct` per cent (alerts); one cent above (does not); a cheaper row on the save day itself (sets the saved price, no alert); the first qualifying day rather than the cheapest; saves before the product's first row (`-1`); two saves measured against their own saved prices; a drop on another product; rows out of order and interleaved; two saves on the same day; a save on the last row's day; a product with no rows. Very Hard adds out-of-stock days that never alert, a return from out of stock at a low price (alerts that day), a save while out of stock, and a return above the threshold followed by a real drop.

**Common mistakes.** Alerting on the save day; using the first price after the save as the saved price; floating-point `0.9 * price` instead of the integer rule; reporting the cheapest day; treating an out-of-stock row as price 0, which alerts every pending save; assuming rows are sorted; a min-heap of thresholds, which tests the wrong end; scanning each save forward.

**Follow-up guidance.** (1) Key pending alerts by (pinner, product). Keep the earliest save's price, or the lowest, and say which; the choice changes when pinners hear about a drop. (2) Keep the pending heaps (or a table of thresholds per product) between runs, and apply only the new day's rows. A product saved by millions of pinners needs its thresholds bucketed (all saves at the same saved price share one entry with a list or a count) and expired after a stated period. (3) Require the low price to hold for a stated time, or for two consecutive feed updates, and cap alerts per product per hour. A merchant's correction should cancel alerts not yet sent. (4) Comparing across currencies is meaningless. Store currency with every row and saved price, compare only like with like, and decide whether a currency change resets pending saves.

**Rubric anchors.** 2: a forward scan per save, or same-day and boundary rules wrong. 3: all tests pass with a sweep and a per-product heap or an equivalent O(log) structure. 4: also explains why the top of the max-heap is the only element to test, keeps the comparison in integers, and gives credible answers on incremental runs and bad feed prices.

**Strong signals.** Asks whether a same-day row counts and whether the boundary is inclusive; notices that alerts can only happen on row days. **Red flags.** `price < 0.9 * saved` with floats and no boundary test; "just run it per save in SQL" with no estimate of the work.

## PIN-L2-02

**Reference solution**

```python reference
def discordant_pairs(shown, scores, report_comparable=False):
    seen = set()
    vals = []
    for pin in shown:
        if pin in seen:
            continue                          # a scroll-back: the first position counts
        seen.add(pin)
        s = scores.get(pin)
        if s is not None:
            vals.append(s)

    def count(a):
        # Sort a in descending order; return (sorted, pairs i < j with a[i] < a[j]).
        n = len(a)
        if n < 2:
            return a, 0
        left, cl = count(a[: n // 2])
        right, cr = count(a[n // 2:])
        merged = []
        put = merged.append
        i, ln, c = 0, len(left), cl + cr
        for x in right:
            while i < ln and left[i] >= x:    # ties: the left element goes first
                put(left[i])
                i += 1
            c += ln - i                       # left[i:] are earlier and strictly smaller
            put(x)
        merged.extend(left[i:])
        return merged, c

    discordant = count(vals)[1]
    if not report_comparable:
        return discordant
    groups = {}
    for v in vals:
        groups[v] = groups.get(v, 0) + 1
    m = len(vals)
    tied = sum(k * (k - 1) // 2 for k in groups.values())
    return (discordant, m * (m - 1) // 2 - tied)
```

**Explanation.** After dropping repeats and unscored pins, the shown order is a list of scores `v`. A discordant pair is `i < j` with `v[i] < v[j]`, which is an inversion count for a descending sort. Merge sort each half into descending order. While merging, when a right element `x` is placed, every left element still waiting is smaller than `x` (they are below the last left element that was at least `x`), and each was shown earlier, so each forms one discordant pair. Taking the left element first on a tie means equal scores are never counted. Comparable pairs are all pairs minus the pairs inside each group of equal scores.

**Complexity.** O(n log n) time and O(n) memory; recursion depth is about log₂ n. The timing test (380 000 shown pins) runs in about 1.3 s in CPython, including the deduplication pass. A Fenwick tree over score ranks is also O(n log n) and takes about 2 to 2.5 s, inside the limit. Comparing all pairs is about 10¹¹ comparisons, many hours in CPython.

**The middle approach, and what this sizing does to it.** The likely middle answer keeps a sorted list of the scores seen so far, uses `bisect` to count the smaller ones and `bisect.insort` to add the new score. It makes only O(log n) comparisons per pin, but each insert shifts on average a quarter of the list in C, so it is O(n²) memory moves. On the timing test the scores are in random order relative to the shown order, so inserts land in the middle on average whichever direction the list is kept in. It takes about 10 s in CPython at 380 000 pins (about 15 s at 450 000 and 19 s at 500 000), roughly ten times the reference and about twice the 8 s limit, so it fails, though by a smaller factor than the pure O(n²) loop. On a much faster machine it could come close to the limit; the follow-up rule on `insort` is there so the interviewer asks for the move count either way. Expect a candidate who uses it to explain why it is quadratic despite the binary search.

**Dialect notes.** In Java or C++ the count needs a 64-bit integer (`long`, `int64_t`): a reversed list of 380 000 pins has about 10¹¹ pairs. In SQL a self-join on `pos_a < pos_b AND score_a < score_b` is correct and O(n²). Engines with window functions cannot express the inversion count directly in O(n log n). In Spark, the usual approach is a per-list job in the driver or a UDF with the same merge sort, because lists are independent. Not executed here.

**Edge cases built into the tests.** Shown in exactly the scoring order (0); exactly reversed (n(n−1)/2); one adjacent swap (1); one pin; nothing shown (0, or `(0, 0)` at Very Hard); negative scores; the last pin moved to the front. Hard and Very Hard add equal scores, every score equal, a repeated pin counted at its first position (two tests, including a pin that was low at first and repeated high), a pin with no score, and ties inside a reversed order.

**Common mistakes.** Counting the wrong direction; counting equal scores as discordant (taking the right element first on a tie); keeping a repeated pin's last position; crashing on an unscored pin (`scores[pin]`); computing comparable pairs as n(n−1)/2 without removing ties; a recursive merge sort that slices with `list.pop(0)`, which is quadratic.

**Follow-up guidance.** (1) Kendall's tau-b: (concordant − discordant) / √((n₀ − n₁)(n₀ − n₂)), where n₀ is all pairs and n₁, n₂ the tied pairs in each ordering. Here the shown order has no ties, so the denominator uses only the score ties. The Very Hard return gives what is needed. (2) Weight a pair by a function of the earlier position, for example 1 / log₂(position + 1). The merge sort can carry, for each left element, its weight, and add the sum of the remaining left weights, kept as a suffix sum, instead of their count. (3) Keep a Fenwick tree over score ranks for the window, adding pins as they are shown and removing them when they fall out of the window; each pin then costs O(log n). (4) Skipped pins are not missing at random if the sampling depends on position or score. Report the coverage with the number, or compute it on a uniform sample of pairs.

**Rubric anchors.** 2: an O(n²) loop or `insort` without seeing why it is slow, or the direction or ties wrong. 3: all tests pass with a merge sort or Fenwick tree and correct tie handling. 4: also explains the tie rule precisely, notes the 64-bit count, and handles the normalisation and position-weighting follow-ups.

**Strong signals.** Asks which direction counts and what happens with ties before coding; recognises the inversion count immediately. **Red flags.** Calls `insort` O(log n) per insert; counts equal scores and calls the difference "noise".

## PIN-L2-03

**Reference solution** (the fixed rollup)

```python reference
from datetime import datetime, timedelta, timezone

MIN_VIEW_MS = 2000              # a video view counts after 2 seconds watched (this exercise's rule)


def _original(pins, pin):
    while pins[pin]["origin"] is not None:      # follow the whole chain
        pin = pins[pin]["origin"]
    return pin


def _week(ts):
    day = datetime.fromtimestamp(ts, timezone.utc).date()          # weeks are cut in UTC
    return (day - timedelta(days=day.weekday())).isoformat()


def weekly_engagement(events, pins):
    rows = {}
    for ev in events:
        if ev["pin"] not in pins:
            continue
        root = _original(pins, ev["pin"])
        if pins[root]["deleted"]:                                    # the original decides
            continue
        t = ev["type"]
        metric = None
        if t == "impression":
            metric = "impressions"
        elif t == "save":
            if ev["board"] != "secret":                              # public and group boards count
                metric = "saves"
        elif t == "closeup":
            if pins[root]["format"] == "static":
                metric = "views"
        elif t == "video_view":
            if pins[root]["format"] == "video" and ev["watched_ms"] >= MIN_VIEW_MS:
                metric = "views"
        if metric:
            key = root + "|" + _week(ev["ts"])
            row = rows.setdefault(key, {"impressions": 0, "saves": 0, "views": 0})
            row[metric] += 1
    return rows
```

**The planted bugs, their symptoms and their fixes.**
1. **Repins credited one hop up.** `_original` returns the pin's `origin` without following it further. Symptom: engagement on a repin of a repin is credited to the middle pin, someone else's repin, instead of the original. Fix: follow `origin` until it is `None`.
2. **Group-board saves dropped.** The save check is `board == "public"`, so saves to group boards are dropped along with secret ones. Symptom: pins popular with group boards look less saved. Fix: exclude only `"secret"`.
3. **Deletion checked on the wrong pin.** The code skips events whose own pin is deleted. Symptom, two ways: a deleted repin's real saves and impressions disappear from the original, and a deleted original still gets rows through its live repins. Fix: resolve the original first and check its `deleted` flag.
4. **Units.** `watched_ms` is compared with `MIN_VIEW_SECONDS = 2`, so every view of 2 ms or more counts. Symptom: video views far above the player's own numbers. Fix: compare milliseconds with 2 000.
5. **Weeks cut at UTC−8.** `REPORT_TZ_OFFSET` shifts every timestamp eight hours back before the week is cut. Symptom: events between Monday 00:00 and 07:59 UTC land in the previous week, so weekly totals disagree with the UTC dashboards. Fix: cut weeks in UTC.

Each bug has its own check: a repin of a repin; a group-board save; a deleted repin and a deleted original (two checks); a short video view; an event early on Monday, and the Sunday 23:59:59 / Monday 00:00:00 pair. The other checks (a secret save, a 2-second view with a closeup on a video pin, an unknown pin, a one-hop repin) pass on the buggy code and stay as regression checks. Random samples can hit several bugs at once.

**Explanation.** The rollup is three decisions per event: which pin gets credit (the original, through the whole chain), whether the event counts (deleted original, secret board, view rules by format and units), and which week it belongs to (Monday in UTC). Each bug breaks exactly one of those decisions.

**Complexity.** O(n · chain length) time. The timing test (200 000 events, 20 000 pins, chains of a few levels) runs well under a second. A memo from pin to original makes it O(n + pins) and is the right answer to the long-chain follow-up.

**Dialect notes.** In SQL the original is a recursive CTE over `origin`, or better, an `original_pin_id` column computed when a repin is created. The week is `date_trunc('week', ts AT TIME ZONE 'UTC')` in PostgreSQL, which starts on Monday. In BigQuery `DATE_TRUNC(d, WEEK)` starts on **Sunday** unless you write `WEEK(MONDAY)` or `ISOWEEK`. Snowflake's `DATE_TRUNC('week', …)` depends on the `WEEK_START` session parameter. Spark's `date_trunc('week', …)` starts on Monday. Watch the session time zone in every engine. Not executed here.

**Edge cases built into the tests.** Impressions and a closeup on one static pin; a one-hop repin; a repin of a repin; a secret save; a group save; a deleted repin; a deleted original reached through a live repin; a video view under 2 seconds; exactly 2 seconds, with a closeup on a video pin; an event in the first hours of Monday UTC; Sunday 23:59:59 against Monday 00:00:00; an event for an unknown pin.

**Common mistakes.** Fixing the one-hop credit with two hops; changing the save check to `in ("public", "group")`, which works today and silently drops the next board type; moving the deleted check but still checking the event's pin as well, which drops the deleted repin's real engagement; changing the constant to 2000 but leaving the name `MIN_VIEW_SECONDS`; computing Sunday-start weeks while removing the offset; rewriting the function instead of making minimal fixes.

**Follow-up guidance.** (1) Secret-board saves never appear anywhere public; the public trends page should read only aggregates over thresholds, never per-pin creator rows, and the filter belongs in the table the public page reads, not in the page. (2) Both answers are defensible: either restate history (the pin is gone) or keep an as-reported snapshot. Store the deletion time so both can be produced. (3) Partition by week and recompute whole partitions; call a week final after the stated lateness (three days), and mark earlier versions as provisional. (4) Store `original_pin_id` on each pin at creation (a repin copies its parent's original), so the rollup never walks a chain. Deleting an original does not change other pins' originals; it only hides the original's rows.

**Rubric anchors.** 2: finds two or three bugs; some checks still fail. 3: all five fixed, all checks pass, each explained with its symptom. 4: also names the decision each bug breaks, adds a regression test per bug, and answers the week-start dialect differences and the long-chain follow-up concretely.

**Strong signals.** Builds a three-pin chain and a Monday 03:00 event by hand before touching the code; asks whether new board types should count by default. **Red flags.** "Use local time, creators are in the US"; removing the deleted check entirely.

## PIN-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **What exists where.** The pinner's photo exists only in memory on the serving path: it is decoded, objects are detected, the query features are computed and the image is dropped when the response is sent. It is never written to logs, queues, caches with persistence, crash dumps or debug tables. Crash reporting on that path is configured to exclude request bodies.
- **Request event.** `visual_search_request (request_id, served_at, entry_point camera|crop_on_pin|upload, client, country, source_pin_id NULL, crop_box NULL, detections[{label, box, confidence}], model_version, result_count)`. `request_id` is random per search and expires after the {{followup_window}} join. `source_pin_id` and `crop_box` exist only for crops on public pins, because the image is then a public pin, not the pinner's photo. Detections come from a fixed list of object labels.
- **Results event.** `results_served (request_id, position, pin_id, is_product)` per served result, or one row with an array. Deduplicated on `(request_id, position)`.
- **Actions.** Closeups, saves and outbound clicks from the results grid carry the `request_id` the server issued. A stream job joins actions to requests within the {{followup_window}} window, using event time with an allowed lateness, and writes `visual_search_outcome (request_id, first_action, first_action_type, useful bool)`.
- **No pinner identifier.** The log has no pinner id or device id. Questions that need repeat behaviour are out of scope for this log (follow-up 3).
- **Aggregates.** Daily and weekly tables by entry point, object label, country and model version: searches, useful searches, useful rate, actions by type. Cells under a threshold (for example fewer than 100 searches) are suppressed, and totals are computed from unsuppressed cells or published with the suppressed remainder grouped.
- **Retention.** Raw request, result and action events are kept for {{retention}} and deleted by partition, with a deletion job that verifies by listing and alerts on failure. Aggregates without request ids can be kept longer.
- **Proof.** A schema test fails the build if any field in these tables holds bytes, base64 or a vector. A sampled scanner checks payloads for image signatures (JPEG/PNG headers, long base64 runs) and blocks the producer on a hit. Access to raw tables is logged.

**Competing designs to accept.** Logging only aggregates at the edge and nothing per request (accept if the candidate explains how the {{followup_window}} join is done in a short-lived in-memory window); keeping a per-request object list without boxes; a client-side join that sends only the outcome. All are fine if the photo and anything reversible from it never leave the serving path.

**Bottlenecks and failure modes.** Debug convenience pulling images into logs; error events with payloads; embeddings treated as "not the image"; joins that need a pinner id; client retries duplicating results-served; late action events falling outside the window; silent retention failures.

**Incident guidance.**
- *A thumbnail in the error event for six hours*: stop the producer (feature flag or schema rejection), delete the affected partitions and any downstream copies, verify by scanning, record what was deleted and who had access, and add the payload scanner and a schema rule that would have blocked it. Tell the privacy owner; this is a breach of the log's rule, not a data-quality issue.
- *Duplicate results-served events*: deduplicate on `(request_id, position)` at ingestion or in the table, rerun the day's aggregates, and add a monitor on results per request.
- *Retention deletion failing for a week*: alert on the age of the oldest partition, not on job success. Run the deletion for the backlog, verify, and fix the job to address partitions by date, not by name.

**Follow-up guidance.** (1) Use the logged labels, boxes, model versions and result ids to find patterns (low confidence for "chair", low useful rate); reproduce with consented test images or public pins, never with pinners' photos. (2) Detect with the payload scanner and schema checks; stop the release or reject the field at ingestion; delete the written data and verify. (3) It needs a stable pinner identifier, which this log deliberately lacks. Answer it from a separate, consented dataset with its own retention, or approximate it from aggregates; do not add a pinner id to this log. (4) Scale the stream join and partitioning; the new entry point needs the same rule that frames are never stored, and the scanner must cover video payloads.

**Rubric anchors.** 2: logs the image or an embedding "for debugging", or joins on pinner id. 3: a schema without the photo, a short-lived request id, a windowed join with late events, deduplication, aggregates and retention. 4: also small-cell suppression with protection against subtraction, automated proof that no image is kept, and a breach-grade response to the thumbnail incident.

**Strong signals.** States where the photo exists, and for how long, before drawing any pipeline; treats embeddings as image data. **Red flags.** "We hash the image so it's anonymous"; storing photos in a restricted bucket "just in case".

## PIN-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Save identity.** The client mints a random `save_id` (a UUID) when the pinner taps save, and sends it with every retry. The save API creates the pin with `save_id` as an idempotency key: a unique constraint, or a lookup in a deduplication store with a window longer than the {{offline_hours}}-hour offline queue plus margin. A retry returns the existing pin.
- **Events.** `save_created`, `save_edited`, `save_deleted`, each with `save_id`, `pin_id`, a per-save `client_seq` that the client increments, `client_ts`, `server_received_at`, client and version. The stream is partitioned by `save_id`, so all versions of one save are processed in order of arrival on one partition.
- **Applying out-of-order events.** A record per `save_id` holds the latest state by `client_seq`, never by arrival. A delete writes a tombstone kept at least as long as the offline window, so a create that arrives after its delete stays deleted. An edit with a lower `client_seq` than the stored one is ignored.
- **Source page.** The URL is normalised by a versioned rule: lower-case scheme and host, drop the fragment, drop known tracking parameters and anything that looks like a session token or credential, sort the remaining parameters. The raw URL is never stored. Keep `source_domain`, `source_url_normalised` and `normalisation_version`, so history can be re-normalised.
- **Save time.** Keep `client_ts` and `server_received_at`. Use `client_ts` when it is within a plausible range (not after receipt, and not more than the offline window before it), otherwise use the receive time and flag the row. Reports state which rule they use.
- **Analytics table.** `external_saves (save_id, pin_id, save_date, save_time, time_source, client, source_domain, source_url_normalised, normalisation_version, deleted_at)`, partitioned by `save_date`. Late events rewrite the partition of their save date. A daily job rebuilds the last few days from the current record state, and deletions remove rows within a day. Creator views read aggregates by claimed domain and day, never rows.

**Competing designs to accept.** Server-minted ids with a client request id for retries; event sourcing with periodic snapshots; a CDC stream from the pin store instead of client events (accept if the candidate explains how the source page and client are captured). All are fine if retries are idempotent and deletes win over late creates.

**Bottlenecks and failure modes.** Deduplication windows shorter than offline periods; ordering by arrival time; storing raw URLs with tokens; client clocks hours off; deleted pins lingering in analytics; partitions that never get rewritten after late data.

**Incident guidance.**
- *Offline queues flush twice*: the `save_id` key makes the second copy a no-op at creation. Analytics deduplicates on `save_id` too, so counts do not move. Watch the deduplication hit rate spike and confirm that daily totals did not.
- *Session tokens in URLs for two days*: stop the extension version or strip at ingestion; re-normalise and overwrite the affected partitions, purge raw copies anywhere downstream, verify, and add a test with known token parameters to the normaliser.
- *Deletes before creates bring pins back*: the tombstone was missing or expired too soon. Extend tombstone life to the offline window, reprocess the affected `save_id`s from the event log, and add a monitor for creates arriving after a tombstone.

**Follow-up guidance.** (1) Many pins share one `save_id`: creation returns the first pin for all of them, so saves are lost. Detect a burst of identical ids per client version; repair by replaying the client's queued payloads with a derived id (`save_id` plus the payload hash) for that version only. (2) Keep a per-domain rule set in the normaliser and re-run it on history with a new version; creators see their pages merged from the version date. (3) Rewrite the partition for the save date; publish a corrected report with a version and a note of how much changed; mark days within the offline window as provisional. (4) Keep the deduplication store keyed by `save_id` with a TTL of the offline window plus margin; partition it by `save_id` hash; beyond the window, rely on the unique constraint in the pin store.

**Rubric anchors.** 2: deduplication by content or time; order by arrival; raw URLs kept. 3: client-minted save id, versioned records with tombstones, URL normalisation, late data rewriting partitions, deletion propagated. 4: also a reasoned save-time rule with both clocks, re-normalisation of history, bounded deduplication with a fallback, and aggregate-only creator views.

**Strong signals.** Asks how long a phone can stay offline before choosing the deduplication window; treats URL parameters as a privacy question. **Red flags.** "Deduplicate by image hash"; "the latest event wins" by arrival time.
