# Apple · Loop 2 — evaluator notes (hidden from candidates)

## APL-L2-01

**Reference solution**

```python reference
def group_near_duplicates(photos, max_bits, keep_best=False):
    score = {}
    hashes = {}
    for pid, h, s in photos:
        if h is not None:
            hashes[pid] = h
            score[pid] = s
    ids = sorted(hashes)
    hs = [hashes[p] for p in ids]
    n = len(ids)
    parent = list(range(n))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    # Pigeonhole: split the 64 bits into max_bits + 1 blocks. Two hashes within
    # max_bits of each other agree exactly on at least one block.
    blocks = max_bits + 1
    edges = [64 * b // blocks for b in range(blocks + 1)]
    for b in range(blocks):
        lo, hi = edges[b], edges[b + 1]
        mask = ((1 << (hi - lo)) - 1) << lo
        buckets = {}
        for i, h in enumerate(hs):
            key = h & mask
            if key in buckets:
                buckets[key].append(i)
            else:
                buckets[key] = [i]
        for members in buckets.values():
            m = len(members)
            if m < 2:
                continue
            for x in range(m):
                i = members[x]
                hi_ = hs[i]
                for y in range(x + 1, m):
                    j = members[y]
                    ri, rj = find(i), find(j)
                    if ri != rj and bin(hi_ ^ hs[j]).count("1") <= max_bits:
                        if ri < rj:
                            parent[rj] = ri
                        else:
                            parent[ri] = rj

    groups = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(ids[i])     # ids ascending within a group
    out = sorted((g for g in groups.values() if len(g) >= 2), key=lambda g: g[0])
    if not keep_best:
        return out
    result = []
    for g in out:
        keeper = min(g, key=lambda p: (-score[p], p))
        result.append([keeper] + [p for p in g if p != keeper])
    return result
```

**Explanation.** If two 64-bit hashes differ in at most d bits, cut both into d + 1 contiguous blocks. The d differing bits fall into at most d blocks, so at least one block is identical in both hashes (the pigeonhole principle). For each block position, bucket the photos by that block's value; any near-duplicate pair shares at least one bucket. Inside a bucket, confirm a pair with an exact bit count of the XOR. Union-find merges confirmed pairs into groups, and a pair already in one set is skipped before the bit count. Photos without a hash are left out and a repeated id is collapsed by building a dict first. Groups are read back from the union-find roots, ids ascend inside each group because the indices follow the sorted ids, and groups are sorted by their first, smallest id. With `keep_best`, the keeper is the minimum of `(-score, id)`, which is the highest score with the smaller id on a tie, and the group order is still decided by the smallest id.

**Complexity.** Bucketing is O(n · (d + 1)). The pair work is the sum over buckets of the bucket size squared. For uniformly spread hashes a block of b = 64 / (d + 1) bits gives n / 2ᵇ photos per bucket, so for d = 4 (13-bit blocks) and n = 40 000 it is about 5 photos per bucket, plus the members of real clusters. The timing test (40 000 photos, d = 4) runs in about 0.7 s in CPython, and d = 3 in about 0.3 s. All pairs is 8 × 10⁸ XOR-and-count steps, over a minute and a half in CPython. As d grows the blocks shrink and buckets fill (d = 12 gives 5-bit blocks and n / 32 photos per bucket), so the method is for small d.

**Dialect notes.** In Java or C++, hashes are unsigned 64-bit values: Java has no unsigned `long`, but XOR and `Long.bitCount` work on the raw bits, so the sign never matters; in C++ use `uint64_t` and `std::popcount` (or `__builtin_popcountll`). In SQL engines, BigQuery has `BIT_COUNT` on `INT64`, and Spark has `bit_count`; a self-join on each block value followed by a bit count is the distributed form of the same idea, and the connected components then need an iterative job or a graph library. Not executed here.

**Edge cases built into the tests.** Exactly `max_bits` differing bits; `max_bits + 1`; a chain A ~ B ~ C with A and C 2·`max_bits` apart; a photo with no near duplicate; an empty library; `max_bits = 0`, where only identical hashes group; differences in bit 63 and bit 0; groups ordered by their smallest id; (Hard) a photo without a hash, a photo listed twice in a group, and a photo listed twice with no near duplicate (it must not form a group with itself); (Very Hard) the keeper by highest score, a score tie broken by the smaller id, and groups ordered by their smallest id rather than by their keeper.

**Common mistakes.** Comparing all pairs; sorting by hash and comparing neighbours (misses pairs that differ in high bits); blocks that do not cover all 64 bits, or 8 fixed bytes, which is only correct for d ≤ 7 and wasteful for small d; treating near duplicates as non-transitive (pair lists instead of groups); a repeated photo id grouped with itself; `None` hashes crashing the XOR; recursive DFS over a long chain; ordering groups by their keeper.

**Follow-up guidance.** (1) With d = 12, 13 blocks of about 5 bits make buckets huge. Options: fewer, wider blocks with a second-level search (allowing a few errors per block and enumerating neighbours of the block value), multi-probe hashing, or an index such as a BK-tree for moderate sizes; accept answers that quantify the bucket sizes. (2) Keep the block buckets and the union-find; a new photo is bucketed d + 1 times and compared only with its buckets' members. Deletions break union-find, so rebuild the affected group from its members, or keep explicit edges for small groups. (3) Pick a representative per group (for example the best score) and require members to be within d of it, a clustering with a centre; or cut chains with a maximum diameter. It costs more comparisons and can leave photos ungrouped. (4) Emit (block index, block value, photo) rows, group by the first two, emit candidate pairs, confirm with a bit count, and run connected components (iterative label propagation or a union-find per partition followed by a merge). Skew on popular block values needs salting or a cap.

**Rubric anchors.** 2: all pairs or neighbour comparisons after a sort; groups not transitive; several edge tests fail. 3: all tests pass with a multi-index on d + 1 blocks and union-find. 4: also proves why d + 1 blocks suffice, states the cost in terms of bucket sizes and how it degrades with d, and handles the incremental and distributed follow-ups concretely.

**Strong signals.** Asks whether the grouping is transitive and whether all 64 bits are used; mentions the pigeonhole argument before coding. **Red flags.** "Sort and compare neighbours" defended without a counterexample; claims about how a real photo app detects duplicates.

## APL-L2-02

**Reference solution**

```python reference
MOD = 1_000_000_007
BASE = 257


def _chunks(data, window, mask, min_size, max_size):
    """Yield (offset, length) of each content-defined chunk of data."""
    out = []
    n = len(data)
    top = pow(BASE, window - 1, MOD)       # weight of the byte leaving the window
    limit = max_size if max_size is not None else n + 1
    h = 0
    start = 0
    for i in range(n):
        if i >= window:
            h = (h - data[i - window] * top) % MOD
        h = (h * BASE + data[i]) % MOD
        length = i - start + 1
        if length == limit or (i >= window - 1 and length >= min_size and h & mask == 0):
            out.append((start, length))
            start = i + 1
    if start < n:
        out.append((start, n - start))
    return out


def delta_chunks(installed, new, window, mask_bits, min_size=1, max_size=None):
    mask = (1 << mask_bits) - 1
    have = set()
    for f in installed:
        for off, length in _chunks(f, window, mask, min_size, max_size):
            have.add(f[off:off + length])
    mine = _chunks(new, window, mask, min_size, max_size)
    download = []
    for off, length in mine:
        piece = new[off:off + length]
        if piece not in have:
            have.add(piece)
            download.append((off, length))
    return (len(mine), download)
```

**Explanation.** The window hash is a polynomial in base 257 over the last `window` bytes, so it rolls: subtract the outgoing byte times 257^(window − 1), multiply by 257, add the incoming byte, all modulo the prime. The outgoing weight is computed once with `pow(257, window - 1, MOD)`. Python's `%` returns a non-negative value after the subtraction. The hash is updated for every byte of the file, independently of where chunks start, so it is defined from position `window − 1` onwards and can reach into the previous chunk. A chunk ends after byte `i` when it has reached `max_size`, or when the window is full, the chunk has at least `min_size` bytes and the low `mask_bits` bits of the hash are zero. The rest of the file after the last cut is the final chunk. Installed files are chunked first into a set of their chunk bytes. The new file's chunks are then walked once: a chunk not in the set is downloaded and added to the set, so a repeat inside the update is downloaded once.

**Complexity.** O(n) hash updates over all bytes, plus O(total chunk bytes) for slicing and hashing the chunks into the set. The timing test hashes about 2 MB (1 MB installed, about 1 MB new) with a 64-byte window in about 1.0 s in CPython. Recomputing each window is O(n · window), about 130 million multiply-and-mod steps, roughly 10–12 s in CPython even with `map` and `sum` doing the inner loop. The base 257 is deliberate: `int.from_bytes` computes a base-256 value in C, which would be a different hash.

**Dialect notes.** In Java or C++ keep the hash in a 64-bit integer: with a prime near 10⁹, `h * 257 + b` fits easily. After subtracting the outgoing term, add the modulus before taking `%`, because `%` keeps the sign of the dividend in both languages. Production chunkers often use a Rabin fingerprint over GF(2) or a gear hash, which roll with shifts and XORs instead of multiplication; the boundaries differ but the algorithm is the same. A SQL formulation is impractical. Not executed here.

**Edge cases built into the tests.** An empty update; an unchanged file (nothing to download); a file shorter than the window; an insertion near the start, after which later chunks are found again; a passage moved to the front; two boundaries fewer than `window` bytes apart, which needs the window to run over the whole file; (Hard) a run of one repeated byte, cut only at `max_size`, with the identical chunks downloaded once; a hash boundary inside the first `min_size` bytes, ignored; a chunk of exactly `max_size` bytes; (Very Hard) chunks found in a second installed file; a passage repeated inside the update; no installed files at all.

**Common mistakes.** Restarting the window at each chunk start; testing the hash before the window is full; `>` instead of `>=` for `min_size`, or cutting at `max_size + 1`; forgetting the final chunk, or emitting an empty final chunk; offsets into the installed file instead of into `new`; downloading a repeated chunk twice; recomputing each window; using `int.from_bytes` or Python's `hash()` as the boundary hash; a negative intermediate value in languages where `%` keeps the sign.

**Follow-up guidance.** (1) Fixed blocks shift after an insertion, so every block after it changes. Content-defined boundaries depend only on the bytes in the window, so after the edit the same boundaries reappear and only the chunks that overlap the edit change. (2) The expected chunk size is about 2^mask_bits bytes (plus the minimum); smaller chunks find more reuse but cost more metadata and requests, and `min_size` and `max_size` bound the extremes. For a 2 GB game, expected chunks of tens of KB to a few MB are reasonable; justify by metadata size versus wasted bytes per edit. (3) Precompute each version's chunk list and digests once; a device sends its installed version (or its chunk digests, compactly), the service answers with the list of missing chunk digests, and chunks are served from a content-addressed store and a CDN. (4) Compression and encryption destroy byte-level similarity. Chunk before compressing (compress each chunk), keep assets as separate files, or encrypt per chunk with a deterministic, convergent scheme only where that is acceptable.

**Rubric anchors.** 2: recomputes each window, or mis-defines the boundaries (restarting the window, testing before it is full); several edge tests fail. 3: all tests pass with a rolling hash and correct size limits. 4: also explains why chunks resynchronise after an insertion, how `mask_bits` sets the expected chunk size, and gives a concrete delta protocol for many versions.

**Strong signals.** Asks whether the window restarts per chunk and which offsets to return; checks the boundary rule on a tiny example by hand. **Red flags.** Claims about how a real app store builds update packages; ignoring `max_size` on a run of identical bytes.

## APL-L2-03

**Reference solution** (the fixed report)

```python reference
from datetime import date


def _days_between(a, b):
    return (date.fromisoformat(b) - date.fromisoformat(a)).days


def _half_up(num, den):
    return (2 * num + den) // (2 * den)          # num, den >= 0


def proceeds_report(transactions):
    first_sale = {}     # (subscriber, product) -> date of the earliest sale
    sales = {}          # txn -> what a refund needs
    rows = {}
    for t in transactions:
        if t["type"] == "sale":
            key = (t["subscriber"], t["product"])
            first_sale.setdefault(key, t["date"])
            net = _half_up(t["price"] * 10000, 10000 + t["tax_bp"])     # the price includes the tax
            days = _days_between(first_sale[key], t["date"])
            rate = 15 if days >= 365 else 30                             # 365 days or more
            proceeds = net - _half_up(net * rate, 100)                   # half up, not to even
            row = rows.setdefault((t["app"], t["currency"]), [t["app"], t["currency"], 0, 0])
            row[2] += 1
            row[3] += proceeds
            sales[t["txn"]] = {"row": row, "proceeds": proceeds, "refunded": False}
        elif t["type"] == "refund":
            sale = sales.get(t["original"])
            if sale is None or sale["refunded"]:
                continue
            sale["row"][2] -= 1
            sale["row"][3] -= sale["proceeds"]                           # reverse exactly what the sale paid
            sale["refunded"] = True
    return sorted(rows.values())
```

**The planted bugs, their symptoms and their fixes.**
1. **Tax treated as added on top.** `price - price * tax_bp // 10000` removes a percentage of the tax-inclusive price, which is more than the tax actually included. Symptom: proceeds in VAT storefronts are too low (a 999 sale with 19% included nets 810 instead of 839). Fix: divide the tax out, `price × 10000 / (10000 + tax_bp)`, rounded half up.
2. **The reduced rate starts a day late.** `days > 365` charges the full rate on the anniversary itself. Symptom: renewals on day 365 pay 30%. Fix: `>= 365`.
3. **Banker's rounding.** `round(net * rate / 100)` uses Python's round-half-to-even on a float. For 995 at 30% it gives 298 instead of 299, so proceeds are one minor unit too high whenever the commission is an exact half with an even floor. Fix: integer half-up, `(2 * num + den) // (2 * den)`.
4. **A refund recomputes the commission at its own date.** A refund dated after the subscriber's anniversary uses 15%, so it takes back more than the sale (charged at 30%) paid. Symptom: proceeds drop by more than the refunded sale earned. Fix: store the sale's proceeds and subtract exactly that.
5. **Rows keyed by storefront.** Two storefronts that share a currency (for example two eurozone storefronts) produce two rows for one app and currency. Symptom: duplicate currency rows, and payment totals that do not match. Fix: key rows by `(app, currency)`.

Each bug has its own check, and every other check passes with that bug alone left in: a tax-inclusive sale, a sale exactly 365 days after the first, a commission of exactly half a minor unit, a refund after the anniversary of a sale made before it, and two storefronts that share a currency (that check sets `tax_bp` to 0 so that it isolates the key). Three further checks guard against over-fixing: a sale 364 days after the first stays at 30%, a second refund and a refund of an unknown sale change nothing, and each product has its own first year.

**Explanation.** Proceeds are a per-transaction calculation (net of tax, then commission, both rounded half up to a whole minor unit) followed by a sum per payment key. The payment key is the currency, not the storefront. A refund is a reversal of a stored result, never a recalculation, because the inputs to the calculation (here the rate, in reality also tax rates and exchange rates) can change between the sale and the refund.

**Complexity.** O(n) time and O(sales + rows) memory. The timing test is 200 000 transactions.

**Dialect notes.** In SQL, `ROUND()` on `NUMERIC` rounds half away from zero in PostgreSQL, BigQuery and Snowflake, but on floating-point types the result depends on the engine (PostgreSQL rounds `double precision` half to even). Spark's `round` is half up and `bround` is half even. Keep money in integer minor units or `NUMERIC`/`DECIMAL`, and state the rounding mode. Not executed here.

**Edge cases built into the tests.** A tax-inclusive price; day 365 and day 364; an exact half-unit commission; a refund after the anniversary; two storefronts in one currency; a double refund and a refund of an unknown sale; two products for one subscriber, each with its own first year.

**Common mistakes.** Fixing the rounding with `decimal` but keeping its default half-even mode; `math.ceil` instead of half up; fixing the refund by recomputing at the sale's date (works here, but stores less than it should and breaks when other inputs change); keying rows by `(app, currency, storefront)`; changing the first-sale rule to use the latest sale; rewriting the report instead of making minimal fixes.

**Follow-up guidance.** (1) Convert per row at a rate fixed for the payment period and recorded with the report; keep the per-currency rows as the source of truth and the converted totals as a derived, reproducible view. (2) Each transaction carries the tax rate (and ideally the tax amount) that applied at sale time; reports are rebuilt from stored transactions, never by looking up today's rates. (3) Report the refund in the period it is processed, as a negative line that references the original sale and its period; closed periods are not reopened. (4) Keep, per subscriber and product, the start of the current paid run and the last paid day; a gap longer than 60 days starts a new run. Day counting should be on dates, never on timestamps in local time.

**Rubric anchors.** 2: finds two or three bugs, and some checks still fail. 3: all five fixed, all checks pass, each one explained with its symptom. 4: also argues refunds as reversals of stored results, states the rounding rule and where it applies, and answers the conversion and late-refund follow-ups with a reproducible design.

**Strong signals.** Works the 999-with-19% example by hand; knows that Python's `round()` and `decimal` default to half-even; asks what the payment key is. **Red flags.** "Use floats and round at the end"; claiming knowledge of a real store's commission or tax handling beyond the exercise's rules.

## APL-L2-04

**Reference architecture (one defensible design; score others on the criteria).**
- **On the device.** For each opted-in app, the device keeps a daily record: launches and a launch-time histogram with fixed bucket edges; foreground and background time and an energy estimate in coarse buckets; crash count and, per crash, a compact report with the app version, the OS version, the model family, an exception type and the stack as binary image identifiers and offsets. It never sends content, location, account or advertising identifiers, or other apps' data. At upload, the record becomes a report with a random identifier for that report only, the day, and coarse attributes.
- **Ingestion.** An upload endpoint authenticates the device as a genuine opted-in device class without identifying it (for example with an anonymous token issued per day), validates the schema and size, and writes reports to a durable log partitioned by app. The random report identifier makes a re-sent report idempotent. Late reports (devices offline for days) land in their own day's partition until a cut-off, after which they are dropped.
- **Symbolication.** Crash stacks are stored unsymbolicated with the binary image identifier (build UUID) and offsets. A symbolication service applies the developer's symbol files when they exist; when symbols arrive later, a reprocessing job symbolicates the retained raw crashes for that build.
- **Grouping.** A signature is computed from the top frames of the crashing thread after symbolication, normalised (inlined frames, system frames trimmed); before symbolication, the binary image and offsets give a provisional key. Regrouping after symbols arrive maps provisional keys to signatures so that counts are continuous.
- **Aggregation.** Per app, version, OS, model family and day: device-days (reports), launches, merged launch-time histograms (percentiles read from the merged histogram), crash counts, crashing device-days, energy buckets. Crash rate is defined explicitly, for example crashes per 1 000 sessions or the share of device-days with a crash.
- **Release rule.** A cell is published only if at least {{min_devices}} reports contributed. Cells below the threshold are merged upward (model family into "all models", day into week). To stop subtraction attacks, publish only from a fixed hierarchy of cells and suppress complementary cells when a sibling differs from its parent by fewer than {{min_devices}} reports, or round counts and percentiles.
- **Retention.** Raw reports are kept for a short, stated period (long enough for late symbols and reprocessing), then deleted. Aggregates are kept longer. An opt-out stops collection on the device immediately; earlier reports cannot be linked to it and expire with the raw data.
- **Freshness.** Daily batch aggregation, with a first publication for a new version as soon as its cells pass the threshold, and a visible "data so far" label.

**Competing designs to accept.** Streaming aggregation of reports as they arrive (fine if the release rule is applied at publication, not at ingestion); server-side sketches such as t-digest or DDSketch instead of fixed histograms (fine if mergeable and the device still does not send raw values); adding calibrated noise to released counts as well as thresholds (a strong answer, if it says what it costs in accuracy). Designs that keep a stable device id "for deduplication" do not meet the constraints.

**Bottlenecks and failure modes.** A launch-crash spike multiplying volume for one app; symbol files missing or uploaded late; signatures that split with compiler or OS changes; a crash-rate denominator that changes when uploads fail (rates jump while counts do not); thresholds that hide small apps entirely; overlapping cells that allow subtraction; late reports changing published numbers without notice.

**Incident guidance.**
- *Launch crash on one model family, 30 times the usual crash volume*: the log is partitioned by app, so other apps are isolated; autoscale the symbolication and grouping stage for that app, or sample the stacks for grouping while counting every crash exactly. Publish the count early, because the cell is far above {{min_devices}}, and let the developer see the signature by model family. Check that ingestion quotas were per app, not global.
- *Crash rate doubled but no new signature and report count halved*: suspect the denominator. Fewer daily reports (for example an OS update that delayed uploads, or an upload rejection after a schema change) means fewer device-days with launches but crash reports still arriving separately. Compare reports per version over time, check rejection metrics, hold the published rate with a data-quality flag, and fix the join so that numerator and denominator come from the same reports.

**Follow-up guidance.** (1) Show counts by provisional signature (binary image and offsets) with a "symbols missing" banner; when symbols arrive, reprocess the retained raw crashes and remap provisional keys, so the history is continuous. (2) The difference of two cells reveals a group of three devices. Publish only from a fixed hierarchy, suppress cells whose complement is below the threshold, or add noise; say which and what it costs. (3) Publish at a coarser grain (all models, the week so far) until finer cells pass, and label the numbers as early; never lower the threshold for new versions. (4) Normalise frames (strip compiler-generated suffixes, inline frames) and keep a mapping table from old to new signatures, so a split is merged and trends stay continuous.

**Rubric anchors.** 2: raw events with device ids in a warehouse, averages, and a threshold mentioned only as a filter. 3: on-device summaries without stable identifiers, mergeable histograms, a defined crash-rate denominator, symbolication with reprocessing, and a per-cell release rule. 4: also handles the subtraction problem, retention of raw versus aggregate data, stable signature grouping, and both incidents with a clear diagnosis.

**Strong signals.** Starts from what the developer needs and works back to the least the device must send; defines the crash-rate denominator before drawing boxes. **Red flags.** "Hash the device id to make it anonymous"; statements about what any real platform collects or how it implements diagnostics.

## APL-L2-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Events.** An append-only, ordered event log keyed by (customer, app, storefront): `rating_set` (stars, installed version, timestamp, per-customer sequence), `review_written` and `review_edited` (text, title), `review_removed` and `review_restored` (moderation decision id, reason), `response_posted` and `response_edited` (developer, text), and `summary_reset` per app and storefront (timestamp, version).
- **Current state.** `current_rating (customer, app, storefront) → stars, version, rated_at, sequence`, updated only by an event with a higher sequence (out-of-order events are ignored or reconciled). `review (review_id, customer, app, storefront, state visible|removed, current text, edited_at)` with an edit history table. `response (review_id, text, version_no, edited_at)`. `reset (app, storefront) → reset_at`.
- **Summary.** Per app and storefront, counts per star (1–5) of current ratings with `rated_at > reset_at` whose review is not removed. A change from 5 to 2 is −1 on the 5s and +1 on the 2s; a removal subtracts the rating; a restore adds it back; a reset recomputes the counts from current state (the filter changes). The product page reads a small cache refreshed {{freshness}}.
- **Per version.** Counts per star by the version stored on the current rating, so a changed rating moves from the old version to the new one. A daily snapshot of current state by version gives developers history; an event-based view gives "ratings submitted per day per version".
- **Rebuild.** Every derived table is a deterministic function of the event log. A rebuild replays events into a new table version, compares it with the live one, and swaps atomically. A periodic consistency check recomputes summaries for a sample of apps and alerts on any difference.
- **Privacy.** Developer-facing views carry the display name and review text only; customer ids stay in internal tables. Account closure removes the customer's ratings and reviews from current state and summaries and replaces the identifier in the log with a tombstone, per the exercise's rule.

**Competing designs to accept.** A streaming job maintaining per-star counts in a key-value store, with a nightly batch recomputation that corrects drift; a database with transactional updates of current state and summary counts in one transaction (fine at {{ratings_per_day}} if partitioned by app); a lakehouse with MERGE into current state and summaries rebuilt hourly (fine if it meets {{freshness}}). Each must keep summaries equal to a recomputation.

**Bottlenecks and failure modes.** Hot apps after a release concentrating writes on one partition; running averages that drift and cannot be corrected; replays that double-apply changes without sequence checks; removals implemented as deletes, so appeals cannot restore; resets that mutate ratings; per-version numbers that count a customer twice after a change; caches that are not invalidated per storefront.

**Incident guidance.**
- *Ten times the usual rating rate for an hour in one storefront*: writes concentrate on one app's partition. Absorb them in the log, and update the summary from per-partition pre-aggregates (sum the per-star deltas in micro-batches) rather than one update per rating; the summary lag recovers without losing events. Alert on summary lag against {{freshness}}, and split hot apps across sub-partitions merged at read.
- *Reset in all {{storefronts}} storefronts; a few still show the old rating an hour later*: the reset events were applied, but cached summaries in a few storefronts were not refreshed, or the reset was processed before some ratings that arrived out of order. Check the cache invalidation per storefront and the reset's position in the event order, recompute those summaries from current state, and add a check that the cache's `reset_at` matches the table's.

**Follow-up guidance.** (1) Apply removals as events in order; each subtracts one rating from the summary in the same transaction or micro-batch that updates the review state; the page shows the old summary until the batch's update is published, within {{freshness}}. (2) Replay from the event log into new tables with sequence checks, compare with the live tables per app and storefront, swap, and record the correction; prove it with a full recomputation of the counts. (3) Compare the rating distribution of ratings submitted or changed while each version was installed, over the same number of days after release, with counts; changed ratings move to the version at the change, so state that rule and show it. (4) Remove the rating from current state and the summaries, delete the review text, keep the developer's response only if policy allows (usually removed with the review), and keep only non-identifying aggregates.

**Rubric anchors.** 2: an append-only table with averages computed on read, no handling of changes, removals or resets. 3: current state with ordered updates, per-star counts updated by deltas, resets as a filter, removals as reversible state, per-version attribution defined. 4: also a rebuild and verification path, privacy of customer ids, hot-app handling, and credible answers for both incidents.

**Strong signals.** Asks what happens to a changed rating's version before drawing anything; keeps summaries as counts, not averages. **Red flags.** "Store the average and update it"; hard deletes for moderation; descriptions of how a real app store computes its ratings.
