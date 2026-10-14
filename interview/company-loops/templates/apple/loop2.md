# Apple · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of an app store with
subscriptions, personal devices, cloud sync and a music service. Every workload,
number, schema and incident is hypothetical, and no scenario describes how any
company actually builds its products. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## APL-L2-01: Grouping near-duplicate photos by perceptual hash

| | |
|---|---|
| **Template ID** | APL-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Bit manipulation / Hamming-distance search with the pigeonhole principle, union-find |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | APL-L2-01.mjs |

**Business Scenario.** A photo library that syncs across a person's devices offers to tidy up near-duplicate shots: bursts, re-saved edits, the same scene taken twice. In this exercise each photo has a 64-bit perceptual hash, computed on the device from a small downscaled copy of the image, so that photos that look alike get hashes that differ in only a few bits. The grouping also runs on the device, over libraries of tens of thousands of photos, so it has to be fast and must not compare every pair.

**Problem Statement.** Implement `group_near_duplicates(photos, max_bits, keep_best=False)`. `photos` is a list of `(photo_id, phash, score)`: a string id, a 64-bit hash given as an integer from 0 to 2⁶⁴ − 1, and an integer quality score. Two photos are near duplicates when their hashes differ in at most `max_bits` bit positions (their Hamming distance). Near duplicates chain: if A is a near duplicate of B and B of C, all three are one group, even when A and C differ in more bits. Return every group of two or more photos as a list of photo ids, and list the groups in order of the smallest photo id each contains (ids compare as plain strings). A photo with no near duplicate is in no group, and an empty library returns `[]`. {{input_rule}} {{keep_rule}} The examples use `max_bits = {{max_bits}}`.

**Constraints.** Up to 40 000 photos in the timing check, with `max_bits` up to 4 there and at most 8 anywhere. All 64 bits of a hash are used. Comparing every pair is 800 million comparisons at that size and is far too slow. Aim for bucket work close to O(n · (max_bits + 1)) plus the pairs that land in the same bucket.

**Assumptions.** Hashes, scores and photo ids are hypothetical. How any real photo app computes hashes or finds duplicates is out of scope: this is an exercise in the technique. All photos belong to one person's library and are processed on their own device.

**Clarifications.**
- Q: Is "near duplicate" transitive? | A: The grouping is. A group is a set of photos connected by near-duplicate pairs, so A and C can share a group through B even when they are far apart.
- Q: Is `max_bits` inclusive? | A: Yes. Hashes that differ in exactly `max_bits` bits are near duplicates.
- Q: Can two different photos have identical hashes? | A: Yes, for example a photo and an exact copy. They differ in 0 bits.
- Q: Can I assume a hash fits in 63 bits? | A: No. The highest bit is used like any other.
- Q: What order do I return? | A: Groups ordered by the smallest photo id they contain. Inside a group, ids ascend, unless `keep_best` asks for the keeper first.

**Hints.**
1. If two 64-bit hashes differ in at most d bits, cut both into d + 1 blocks of bits. At most d blocks can hold a difference, so at least one block is identical in both.
2. For each block position, bucket the photos by that block's value. Only photos that share a bucket can be near duplicates, and only those need an exact bit count.
3. Merge confirmed pairs with union-find, and skip a pair whose photos are already in the same set.

**Follow-ups.**
1. `max_bits` grows to 12. What happens to your block widths and bucket sizes, and what would you change?
2. A library holds 500 000 photos and gains a few dozen a day. How do you keep the groups current without regrouping everything?
3. A slow pan becomes one huge chained group. How would you change the grouping so that every member is close to one representative photo, and what does that cost?
4. A music catalogue wants the same check over a billion pieces of cover artwork in a batch pipeline. How do you distribute it, and what does the pigeonhole trick become?

**Follow-up rules.**
- when: combinations, all pairs, every pair, nested loop → ask: How many comparisons is that for 40 000 photos, and how long does CPython take to do them?
- when: sort by hash, sorted by hash, sorted hashes, adjacent hashes → ask: Two hashes that differ only in the highest bit are far apart in sorted order. What does a sort by hash miss, and how would several sorts with permuted bits help?
- when: bk-tree, bk tree, vp-tree → ask: How does a BK-tree's search cost grow with `max_bits` on uniformly spread 64-bit hashes, compared with your buckets?
- when: recursion, recursive, dfs → ask: A burst of 30 000 near-identical shots forms one long chain. What happens to a recursive search on it in Python?
- when: union-find, union find, disjoint set, dsu → ask: What do path compression and union by rank each buy you here, and does the order of unions change the groups you return?

**Evaluation Criteria.** Correct groups under chaining with inclusive `max_bits`; all 64 bits handled; empty and single-photo cases; exclusion of photos without a hash and one entry per repeated photo (Hard); keeper chosen by score with the smaller id on a tie, groups still ordered by their smallest id (Very Hard); the pigeonhole multi-index stated and justified before coding; union-find or an equivalent linear merge; a clear cost argument in terms of n, `max_bits` and bucket sizes; sensible answers on larger `max_bits`, incremental updates and distribution.

## APL-L2-02: Content-defined chunks for an app update delta

| | |
|---|---|
| **Template ID** | APL-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Strings and hashing / rolling hash, content-defined chunking, deduplication |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, ai-infra-engineer |
| **Generator** | APL-L2-02.mjs |

**Business Scenario.** When a developer publishes a new version of an app, devices that already have the previous version should download only what changed. A technique that file-sync and backup tools use is content-defined chunking: cut a file wherever a rolling hash of the last few bytes matches a pattern. An insertion near the start of a file then changes only the chunks around it, and the later boundaries are found again. In this exercise the device chunks the files it has installed, the update is chunked the same way, and the device downloads only the chunks it does not already have.

**Problem Statement.** Implement `delta_chunks(installed, new, window, mask_bits, min_size=1, max_size=None)`. `installed` is a list of `bytes`, the files already on the device, and `new` is the `bytes` of the new version. For a file `b`, the window hash at position `i` is defined only when `i ≥ window − 1`: H(i) = (b[i − window + 1]·257^(window − 1) + … + b[i − 1]·257 + b[i]) mod 1 000 000 007. Cut each file into chunks from left to right. A chunk ends after byte `i` when the low `mask_bits` bits of H(i) are all zero, that is H(i) mod 2^mask_bits = 0. {{size_rule}} The bytes after the last cut form the final chunk. The window always covers the `window` bytes that end at `i` in the whole file, so it may reach back into the previous chunk. Every installed file is cut by the same rule. Then walk the chunks of `new` in order. A chunk must be downloaded unless the device already has a chunk with exactly the same bytes, either from an installed file or because an earlier chunk of `new` was downloaded. Return `(chunk_count, downloads)`: the number of chunks in `new`, and the `(offset, length)` of each chunk to download, in file order, with offsets into `new`. An empty `new` returns `(0, [])`. {{files_rule}}

**Constraints.** About 2 MB is hashed in the timing check with a 64-byte window, so recomputing every window from scratch, O(n · window), is too slow. One constant-time update per byte is expected. 1 ≤ `window` ≤ 64, 1 ≤ `mask_bits` ≤ 20, `min_size` ≥ 1, and `max_size` ≥ `min_size` when given.

**Assumptions.** The hash constants, sizes and files are hypothetical, chosen for this exercise. Chunks are compared by their bytes; a production system would compare a strong digest of each chunk. How any real app store packages or delivers updates is out of scope.

**Clarifications.**
- Q: Does the window restart at each chunk boundary? | A: No. H(i) always covers the `window` bytes ending at `i` in the whole file. Only the size limits look at the current chunk.
- Q: Is a chunk that appears twice in `new` downloaded twice? | A: No. Once it is downloaded, the device has it.
- Q: Are offsets into `new` or into the installed file? | A: Into `new`. The device fetches the bytes at that offset and length from the new version.
- Q: May I use a set of `bytes`, or `hashlib`, to compare chunks? | A: Yes, either, for chunk identity. The boundary test must use exactly H(i) as defined.
- Q: What if the file is shorter than the window? | A: No hash is defined, so only `max_size` can cut it. Usually it is a single chunk.

**Hints.**
1. Write H(i) in terms of H(i − 1): take away the byte that leaves the window times 257^(window − 1), multiply by 257, and add the new byte, all modulo the prime.
2. Compute 257^(window − 1) mod 1 000 000 007 once, with `pow(257, window - 1, MOD)`. In Python, `%` keeps the result non-negative after the subtraction.
3. Cut the installed files first and keep their chunks in a set. Then walk `new` once.

**Follow-ups.**
1. Why do content-defined boundaries survive an insertion near the start when fixed-size blocks do not? What does one inserted byte cost each scheme?
2. What does `mask_bits` control? How would you choose it, `min_size` and `max_size` for a 2 GB game whose updates touch 200 MB?
3. The update service answers millions of devices on many older versions. What would it precompute per version, and what would a device send to ask for its delta?
4. Compressed or encrypted files change completely after a one-byte edit. What does that do to chunk reuse, and what would you change in how the app package is built?

**Follow-up rules.**
- when: recompute, every window, sum( → ask: How many byte operations is recomputing each window for 2 MB with a 64-byte window, and how long does CPython take for that?
- when: from_bytes, int.from_bytes → ask: `int.from_bytes` gives a base-256 value. Is that the hash this exercise defines, and what would change if it were?
- when: fixed-size, fixed size, block size → ask: Insert one byte at offset 10 of a file cut into fixed 4 KB blocks. How many blocks change, and how many would change with your chunks?
- when: hashlib, sha256, md5 → ask: You identify chunks with a cryptographic digest. Why is that fine for identity but far too slow for the per-byte boundary test?
- when: negative, modulo → ask: After the outgoing byte is subtracted the value can be negative. What does Python's `%` do with it, and what would C or Java do?

**Evaluation Criteria.** Exact H(i) and boundaries from the first full window; the window running over the whole file, not restarting per chunk; `min_size` and `max_size` applied as specified (Hard); chunks compared by content across several installed files and repeats inside the update (Very Hard); empty and short files; a rolling update in O(1) per byte with the outgoing weight precomputed; a clear complexity argument; insight into why content-defined chunking resynchronises and how its parameters trade chunk count against reuse.

## APL-L2-03: Debug the developer proceeds report

| | |
|---|---|
| **Template ID** | APL-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Financial reporting / tax-inclusive prices, commission tiers, rounding, refunds, currency keys |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer, staff-data-engineer |
| **Generator** | APL-L2-03.mjs |

**Business Scenario.** An app store pays developers their proceeds: what the customer paid, minus any tax included in the price, minus the store's commission. In this exercise the commission is 30%, reduced to 15% for a subscription once the subscriber has had a year of paid service (this exercise's rule; check current docs). Prices in some storefronts include tax, and developers are paid separately in each currency. Developers have raised several complaints about one report. Proceeds in storefronts whose prices include VAT look too low. A renewal on the exact anniversary of a subscriber's first purchase is charged the full rate. Some sales show proceeds one minor unit higher than the developer's own calculation. A refund that arrives just after the first year takes back more than the sale paid. And sales from two storefronts that use the same currency appear as two rows. The report below is the suspect.

**Problem Statement.** Fix `proceeds_report(transactions)` so that it meets this specification. `transactions` is a list of dicts in date order (ISO dates `YYYY-MM-DD`, and a refund always comes after its sale). {{replay_rule}}
1. **`sale`** `{"type", "txn", "app", "product", "subscriber", "storefront", "currency", "price", "tax_bp", "date"}`. `price` is what the customer paid, in integer minor units of `currency`, including tax at `tax_bp` basis points (0 means no tax is included). The net price is `price × 10000 / (10000 + tax_bp)`, rounded half up to a whole minor unit.
2. **Rate.** The commission rate is 15% when the sale's date is 365 or more days after the earliest sale of the same `product` to the same `subscriber`, and 30% otherwise. Days are calendar days between the two dates, and breaks in service are ignored in this exercise.
3. **Proceeds.** The commission is `net × rate / 100`, rounded half up to a whole minor unit, and the proceeds are `net − commission`.
4. **`refund`** `{"type", "txn", "original", "date"}` reverses the original sale exactly: one unit and that sale's proceeds are taken off the sale's row. A refund of an unknown sale, or of a sale already refunded, changes nothing. A refunded sale still counts as the subscriber's first sale.
5. **Output.** One row `[app, currency, units, proceeds]` per app and currency, combining every storefront that uses that currency. `units` is sales minus refunds applied. Rows are sorted by app, then currency.

**Constraints.** Keep the function's shape and output format. Up to 200 000 transactions, processed in linear time. Integer arithmetic only.

**Assumptions.** Prices, tax rates, storefronts, apps and the commission rule are hypothetical and simplified; check current docs for any real store's terms. There is no currency conversion: each currency is paid on its own. The tax rate is given on each transaction.

**Clarifications.**
- Q: Is the price before or after tax? | A: After: it already includes the tax. Divide the tax out; do not subtract a percentage of the price.
- Q: Does the 365th day count? | A: Yes. A sale 365 or more days after the first one earns the 15% rate.
- Q: How is half a minor unit rounded? | A: Up, for both the net price and the commission. Every value is non-negative before refunds are applied.
- Q: Which rate does a refund use? | A: None of its own. A refund reverses exactly what the original sale paid.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. Work a sale by hand: price 999 with `tax_bp` 1900. What is the net, and what does the code compute?
2. Compute `995 * 30 / 100` and pass it to `round()`. What does Python do with an exact .5?
3. What should a refund take off the row, and what does the code take off when the refund is dated after the anniversary?
4. Two storefronts use the same currency. What key are the rows grouped by?

**Follow-ups.**
1. Developers want one total in their own currency. Where would conversion happen, at which rate, and how do you keep last month's report reproducible?
2. A storefront's tax rate changes mid-month. What must each transaction carry so that any month's report can be rebuilt exactly?
3. A refund arrives two months after the sale, after that month's proceeds were paid. In which period do you report it, and how?
4. The rule changes so that a break in service longer than 60 days restarts the first year (this exercise's variant). What state would you keep per subscriber and product?

**Follow-up rules.**
- when: decimal → ask: Python's `decimal` module rounds half to even by default too. Which rounding mode would you set, and where?
- when: float, round( → ask: Where else in this report could a float creep in, and what would it do to a total over 200 000 transactions?
- when: exchange rate, convert, conversion → ask: Which day's rate would you use for a refund dated after the month closed, and does the developer's statement agree?
- when: anniversary, 365 → ask: Is "a year of paid service" 365 days or the same calendar date next year? What changes for a first purchase on 29 February?
- when: storefront → ask: Why is the storefront the wrong key for the payment rows, and what would you still report per storefront?

**Evaluation Criteria.** Finds and explains every bug with its business symptom; divides tax out of a tax-inclusive price; starts the reduced rate on day 365; rounds half up with integer arithmetic, not `round()`; reverses a refund from the stored sale; groups rows by app and currency; keeps the fix minimal and linear; adds a test per bug.

## APL-L2-04: Developer diagnostics from opted-in devices

| | |
|---|---|
| **Template ID** | APL-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / privacy-conscious telemetry aggregation, crash grouping, mergeable percentiles |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "devices": {"2": ["20 million", "60 million"], "3": ["300 million", "900 million"]},
  "apps": ["50,000", "400,000", "1.5 million"],
  "min_devices": [50, 200, 1000],
  "upload": ["once a day", "once a day, when the device is charging and on Wi-Fi"]
}
```

**Business Scenario.** Device owners can choose to share diagnostics with app developers. In this exercise about {{devices}} opted-in devices record crashes, app launch times and battery impact for {{apps}} apps, summarise them on the device and upload {{upload}}. Developers see, per app version: crash rate, launch-time percentiles, battery use, and crash reports grouped into signatures. They see aggregates only: no device or person identifiers, and no number that fewer than {{min_devices}} devices contributed to.

**Problem Statement.** Design the pipeline from on-device collection to the developer reports. Cover what the device records and summarises before upload and what it never sends; the upload format and which identifiers it carries; ingestion, duplicate uploads and late uploads; symbolication and grouping of crash reports into signatures; per app-version metrics (crash rate per device-day or per session, launch-time percentiles, battery impact); the release rule that enforces {{min_devices}} contributing devices; what happens when a person opts out; and how a developer sees a new version's metrics soon after release.

**Constraints.** No stable device identifier leaves the device in this exercise. Each upload is a daily report per device and app, with an identifier that is random for that report. Percentiles must be computed from summaries that merge, not from raw values. Crash reports contain memory addresses that become function names only with the symbol files the developer uploads, sometimes days later. A device that opts out stops uploading at once, and what it uploaded before must expire on a stated schedule.

**Assumptions.** All volumes, thresholds and schedules are hypothetical. The exercise describes a general technique for privacy-conscious aggregation; it does not describe how any platform builds its diagnostics or what any device records. A report carries the app, its version, the OS version, the device model family and the day.

**Clarifications.**
- Q: Can I count distinct devices behind a number without a device id? | A: In this exercise each device sends at most one report per app per day, so reports per app, version and day count devices for that day. Counting distinct devices across days is not possible, by design.
- Q: Do developers see individual crash reports? | A: They see crash signatures with counts and a representative symbolicated stack. A stack is shown only when at least {{min_devices}} devices reported that signature.
- Q: How fresh must the metrics be? | A: A new version's first numbers within a day or two of release; earlier is better, as long as the release rule holds.
- Q: Can a developer slice by device model and OS version? | A: Yes, but every released cell must meet the release rule on its own.
- Q: What happens to reports uploaded before an opt-out? | A: They cannot be linked to the device, so they are not deleted one by one. They expire with the rest of that day's raw reports.

**Hints.**
1. Decide what the device summarises: a histogram of launch times with fixed bucket edges merges exactly by adding counts, while a list of raw values does not need to leave the device at all.
2. Apply the release rule at the cell you publish (app, version, model family, OS, day or week), after aggregation, and think about two overlapping cells that differ by a few devices.
3. Keep raw reports only as long as symbolication and reprocessing need them; keep the aggregates for the long run.

**Follow-ups.**
1. A developer uploads symbols three days after a release. What do they see before that, and what do you reprocess when the symbols arrive?
2. Two released cells, "all models" and "all models except one", differ by three devices. What could someone learn by subtracting them, and how do you prevent it?
3. A new version reaches the {{min_devices}} threshold slowly because it is rolling out in phases. How do you show early numbers without breaking the release rule?
4. A crash signature splits into two after a compiler change, though it is the same bug. How do you keep the counts and trends continuous?

**Follow-up rules.**
- when: device_id, device id, user_id, user id, serial → ask: You keep a device identifier. What could a developer or an attacker learn from it, and how do you count devices for the release rule without it?
- when: average, mean → ask: Launch times have a long tail. What does a mean hide, and how do you produce a p90 from millions of daily reports without their raw values?
- when: threshold, k-anonymity → ask: A cell passes the threshold today, and a sibling cell with one device fewer is also released. How can comparing the two reveal one device, and what do you do?
- when: streaming, real-time, kafka → ask: Devices upload once a day. What would a streaming pipeline buy you here, and what would it cost?
- when: stack trace, symbolicate, symbolication, symbol file → ask: Symbol files arrive after the crashes. What do you store so that you can group crashes before symbolication and regroup them after?

**Production Reality Check.**
- A popular app ships a version that crashes at launch on one device model family. Within a day, its crash reports are 30 times the usual volume, from about {{devices}} opted-in devices in total.
- A developer reports that their crash rate for one version doubled overnight, but no new crash signature appeared, and that version's daily report count halved.

**Evaluation Criteria.** On-device summarisation that sends only what the reports need, with no stable identifiers; mergeable launch-time histograms and a defined crash-rate denominator; idempotent ingestion of re-sent and late reports; symbolication that can happen after arrival, with regrouping; signature grouping that is stable over time; a release rule enforced per published cell, including the subtraction problem; retention of raw reports separate from aggregates; a credible plan for each incident.

## APL-L2-05: Ratings and reviews with versions, resets and moderation

| | |
|---|---|
| **Template ID** | APL-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / mutable user content, current state from events, recomputable aggregates |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "ratings_per_day": {"2": ["2 million", "5 million"], "3": ["30 million", "80 million"]},
  "storefronts": [40, 90, 175],
  "freshness": ["within 5 minutes", "within an hour"],
  "review_share": ["one in ten", "one in thirty"]
}
```

**Business Scenario.** An app store lets customers rate an app from 1 to 5 stars and, optionally, write a review, in {{storefronts}} storefronts. It receives about {{ratings_per_day}} ratings a day, and {{review_share}} comes with a written review. A customer has one current rating per app and storefront, and can change it or edit their review at any time. Developers can respond to reviews and edit their responses. Reviews can be reported and removed by moderation, and a removal can be reversed on appeal. In this exercise, a developer releasing a new version may reset the app's summary rating in a storefront (this exercise's rule; check current docs): the summary then counts only ratings submitted after the reset, while the written reviews stay visible. The product page shows each storefront's summary rating, updated {{freshness}}. Developers see ratings per app version, and how they changed over time.

**Problem Statement.** Design the data model and pipeline for ratings and reviews. Cover the events (rating submitted or changed, review written, edited, removed or restored, response posted or edited, summary reset), the current-state tables they maintain, the storefront summary since the last reset, ratings per version, the history a developer can browse, how moderation decisions change the numbers, and how you rebuild everything from the events after a bug.

**Constraints.** A changed rating replaces the old one; it is never counted twice. In this exercise a rating whose review is removed by moderation stops counting in the summary until the review is restored. The summary must equal a recomputation from the events at any time. A reset must not change any rating or review, only what the summary counts. Customer identifiers must not appear in anything a developer sees.

**Assumptions.** All volumes, storefront counts and timings are hypothetical, and the moderation and reset rules are this exercise's. A rating event carries the customer, app, storefront, stars, the app version the customer had installed, and a timestamp.

**Clarifications.**
- Q: Which version does a rating belong to? | A: The version installed when the rating was submitted or last changed. A changed rating moves to the version current at the change.
- Q: After a reset, does a customer who rated before it count? | A: Not in the summary, unless they change or resubmit their rating after the reset. Their review stays visible.
- Q: How fast must a moderation removal affect the summary? | A: Within the same {{freshness}} as any other change.
- Q: Do developers see who rated? | A: No. They see counts, distributions and the review text with a display name chosen by the customer.
- Q: Can events arrive out of order? | A: Yes, by a few seconds across regions. Each event carries a timestamp and a per-customer sequence number.

**Hints.**
1. Keep the summary as counts per star (or a sum and a count), not as an average, so that a change is a subtraction and an addition.
2. Make the current rating per customer, app and storefront the unit of truth, with the timestamp of its last change. A reset is then a timestamp that filters which current ratings count.
3. Treat a removal as a state on the review with history, never as a delete, because appeals restore it.

**Follow-ups.**
1. A moderation batch removes 40 000 reviews in one storefront at once. Walk through what changes, in what order, and what the product page shows meanwhile.
2. A bug double-applied rating changes for six hours. How do you rebuild the summaries and the per-version numbers, and how do you prove they are right?
3. Developers want to know whether a version improved ratings. Which numbers would you give them, and how do you keep rating changes from one version leaking into another?
4. A storefront's rules require removing a customer's data when they close their account. What happens to their rating, their review, the developer's response and the summaries?

**Follow-up rules.**
- when: average, avg, running average → ask: You store an average. How do you apply a change from 5 stars to 2, and a moderation removal, without the full history?
- when: append, insert-only, event log → ask: A customer changes their rating three times. How does each consumer of your log avoid counting it three times?
- when: app_version, version_id, installed version, per version → ask: A customer rated 5 on version 3.0 and changes it to 2 on version 3.2. Which version's numbers change, and how?
- when: cache, redis, materialized view → ask: How do you keep that store's summary equal to a recomputation after a moderation batch and an appeal?
- when: delete, hard delete → ask: A removed review is restored after an appeal. What must your model have kept, and what does the summary do?

**Production Reality Check.**
- After a large release, ratings in one storefront arrive at ten times the usual rate for an hour, out of {{ratings_per_day}} a day, and the summary falls behind its {{freshness}} target.
- A developer resets the summary rating in all {{storefronts}} storefronts at once, and an hour later customers report that the product page still shows the old rating in a few of them.

**Evaluation Criteria.** Current state per customer, app and storefront with ordered, idempotent updates; summaries as counts that change by subtraction and addition and equal a recomputation; resets as a filter, not a mutation; per-version attribution defined for changed ratings; moderation as reversible state with history; responses and edits versioned; a rebuild path from the events; customer identifiers kept from developers; a credible plan for each incident.
