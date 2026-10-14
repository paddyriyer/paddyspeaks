# Netflix · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of a global video
streaming service: plans, profiles, devices, a catalogue of films and series, and
recommendations. Every workload, number, schema and incident is hypothetical.
Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## NFX-L2-01: Byte hit ratio of an LRU edge cache for video segments

| | |
|---|---|
| **Template ID** | NFX-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Caching / LRU by bytes, admission policy, versioned objects |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | NFX-L2-01.mjs |

**Business Scenario.** Video streaming services place caches close to viewers, for example inside internet providers' networks, so that popular titles are served from nearby rather than across the internet. A cache serves video in segments: a few seconds of one title at one quality, a few hundred kilobytes to a few megabytes each. Before changing the size of a cache or its policy, the team replays a day's request trace through a simulator and compares the byte hit ratio, the share of requested bytes served from the cache. Request hit ratio matters too, but bytes are what leave the upstream network. You are writing that simulator.

**Problem Statement.** Implement `edge_cache(requests, capacity, admit_on_second=False)`. `requests` is a list of `(object_id, version, size)` in arrival order, where `size` is in bytes, and `capacity` is the number of bytes the cache can hold. The cache is least recently used (LRU) by bytes:
1. A request is a **hit** if the cache holds `object_id` at the same `version`. The segment becomes the most recently used.
2. Otherwise it is a **miss**. A missed segment that is larger than `capacity` is never stored, and it evicts nothing. Any other missed segment is admitted: evict the least recently used segments, one at a time, until the new one fits (`used + size <= capacity`), then store it as the most recently used.
3. Return `(hits, hit_bytes, total_bytes)`: the number of hits, the bytes served by hits, and the bytes of every request. The byte hit ratio is `hit_bytes / total_bytes`. An empty trace returns `(0, 0, 0)`.

{{admission_rule}} {{version_rule}}

**Constraints.** Up to 300 000 requests and tens of thousands of distinct segments, about 13 000 of them cached at once. Sizes are positive integers, and one `(object_id, version)` always has the same size. `capacity` is a non-negative integer. Something close to O(1) per request is expected. A cache kept as a Python list, or a scan for the oldest segment on every eviction, is too slow.

**Assumptions.** The trace, sizes and capacity are hypothetical. Segments are whole objects: there are no partial or range requests. Every miss is served from upstream, so a miss never fails. The simulator ignores time: only the order of requests matters.

**Clarifications.**
- Q: Does a hit refresh a segment's position? | A: Yes. A hit makes it the most recently used, exactly like storing it.
- Q: Can a segment that fits exactly fill the whole cache? | A: Yes. A segment of exactly `capacity` bytes is admitted and evicts everything else. One byte more and it is never stored.
- Q: Does a missed segment that is too large evict anything? | A: No. It is served from upstream and the cache is unchanged.
- Q: Do I return the ratio itself? | A: No. Return the three integers, so the answer is exact. The ratio is `hit_bytes / total_bytes`.
- Q: Is the hit counted with the size in the request or the size in the cache? | A: They are always the same, because one `(object_id, version)` has one size.

**Hints.**
1. You need two things in O(1): look up a segment by id, and find the least recently used one. An ordered dictionary or a dictionary plus a doubly linked list does both.
2. Keep a running total of the bytes stored. Eviction is a loop that pops from the old end until the new segment fits.
3. For admission, remember every `object_id` you have seen, cached or not. For versions, decide what happens to the old copy before you decide whether to admit the new one.

**Follow-ups.**
1. The team asks for the byte hit ratio at 20 different capacities. Do you need 20 simulations? What does the stack distance of a request tell you, and why do variable sizes make it harder?
2. Second-request admission raised the byte hit ratio on the trace. Explain why, and describe a trace on which it lowers the ratio.
3. Popularity follows a daily cycle and new releases spike at midnight. What would you change in LRU, and how would you compare policies fairly on the same trace?
4. The real cache has 100 TB and a request rate in the hundreds of thousands per second. What changes when the cache is split across disks and servers, and how would the simulator model it?

**Follow-up rules.**
- when: list.remove, .remove(, pop(0), .index( → ask: With 13 000 segments cached, what does each of those calls cost, and how many times does your loop make it over 300 000 requests?
- when: min(, timestamp, last used → ask: How do you find the segment to evict? If that is a scan over the cache, what does a burst of misses cost?
- when: OrderedDict, move_to_end, linked list → ask: Which operation on your structure is O(1) only on average, and does any eviction loop risk running long?
- when: float(, division, divide → ask: Why return integers here instead of the ratio, and where would floating point hurt when you sum ratios over many caches?
- when: lfu, frequency, access count → ask: A segment that was popular yesterday has a high count today. How does your policy forget, and what does a new release do to it?

**Evaluation Criteria.** Correct hits and bytes with the exact boundary (a segment of exactly `capacity` bytes is stored, one byte more is not, and an oversized miss evicts nothing); recency refreshed on hits; eviction in least-recently-used order until the new segment fits; the admission rule counts every earlier request, cached or not; a stale version removed before admission is decided; O(1) work per request with an ordered dictionary or linked list; integer results; sensible answers on multi-capacity simulation, admission trade-offs and policy comparison.

## NFX-L2-02: Pruning a title's bitrate ladder to its convex hull

| | |
|---|---|
| **Template ID** | NFX-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Computational geometry / upper convex hull, dominance, greedy simplification |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, ml-platform-engineer |
| **Generator** | NFX-L2-02.mjs |

**Business Scenario.** A streaming service encodes each title many times, at different resolutions and bitrates, and scores every encode with a perceptual quality metric. Per-title encoding, which streaming services have described publicly, chooses the ladder of encodes that players switch between from those measurements. Only encodes on the upper convex hull of quality against bitrate are worth streaming: an encode below the hull gives less quality per bit than a mix of its neighbours. A nightly job prunes every title's candidate encodes to its ladder.

**Problem Statement.** Implement `prune_ladder(encodes, max_rungs=None)`. `encodes` is a list of `(title_id, encode_id, bitrate_kbps, quality)`, in any order and mixing titles. `quality` is an integer score in hundredths (0 to 10 000) or `None`. For each title:
1. Ignore encodes whose `quality` is `None`. A title with no scored encode does not appear in the result.
2. Encodes with the same bitrate and the same quality are duplicates: keep the one with the smallest `encode_id` (string comparison) and drop the others.
3. The ladder starts at the encode with the lowest bitrate (the highest quality among those) and ends at the encode with the highest quality (the lowest bitrate among those). Its rungs are the corners of the upper convex hull between those two encodes. An encode is a rung if and only if no other encode has a bitrate at or below its bitrate and a quality at or above its quality, and no straight segment between an encode with a lower bitrate and an encode with a higher bitrate passes through it or above it. So an encode exactly on a straight line between its neighbours is not a rung.

Return a dict `{title_id: [encode_id, ...]}` with each title's rungs in increasing bitrate. {{budget_rule}}

**Constraints.** Up to 400 000 encodes across 15 000 titles, interleaved; up to a few hundred encodes per title. Bitrates are positive integers. Use integer arithmetic for every geometric test. Something close to O(n log n) overall is expected. Scanning the whole input once per title, or testing every pair of encodes for every encode, is too slow.

**Assumptions.** Bitrates, scores and titles are hypothetical. Quality scores are comparable across the encodes of one title, whatever their resolution. The ladder is chosen on quality and bitrate only; device limits and codec support are out of scope.

**Clarifications.**
- Q: Is an encode exactly on the line between two rungs a rung? | A: No. Only corners of the hull are rungs, so collinear encodes are dropped.
- Q: Two encodes have the same bitrate but different scores. | A: Only the higher score can be a rung. The other one has a bitrate at or below and a quality at or above it, so it is dominated.
- Q: The best score is reached at two bitrates. | A: The ladder ends at the lower of the two bitrates. Spending more bits for the same quality is never a rung.
- Q: Why integers? | A: Scores are stored in hundredths. Compare slopes by cross-multiplying, so no division or rounding can turn a collinear encode into a rung.
- Q: Can a title have a single encode? | A: Yes, and its ladder is that one encode.

**Hints.**
1. Group by title first, in one pass. Then sort each title's encodes by bitrate, with the higher score first at equal bitrates.
2. Walk the sorted encodes and skip any whose score is not higher than the best so far: it is dominated. The rest rise in both bitrate and score.
3. Keep a stack of rungs. Before pushing a new encode, pop the top while it lies on or below the line from the rung under it to the new encode. Decide that with the sign of a cross product.

**Follow-ups.**
1. Why is a point below the hull never worth streaming, even when it has a resolution the hull lacks? When could a product team still want it?
2. Players switch between rungs as bandwidth changes, and switching cost matters. How would you add a minimum bitrate ratio between neighbouring rungs, and is greedy still right?
3. A new codec arrives and every title is re-encoded over months. How would you run the pruning so that ladders mix codecs safely during the transition?
4. Quality is measured on a sample of scenes and has noise of about a point. How does noise change which encodes are rungs, and what would you do about it?

**Follow-up rules.**
- when: slope, divide, division, float → ask: Two slopes are 1/3 and 0.333…. Where in your code could rounding make a collinear encode look like a rung, and how would you compare them exactly?
- when: sorted(, sort, sorting → ask: What is your sort key at equal bitrates, and what goes wrong if the lower score comes first?
- when: stack, monotone chain, graham, andrew → ask: Why does each encode get pushed and popped at most once, and what is the total cost per title?
- when: heap, heapq, priority queue → ask: When you remove a rung, the areas of its neighbours change. How do you keep the heap from returning an out-of-date area?
- when: for each title, loop over titles → ask: How many times does your code read the full list of encodes, and what does that cost at 15 000 titles?

**Evaluation Criteria.** One pass to group by title; scores of `None` ignored and empty titles left out; duplicates resolved to the smallest id as a string; dominated encodes removed, including same-bitrate and same-quality cases; collinear encodes excluded through an exact integer cross product; the ladder ends at the lowest bitrate with the best score; O(n log n) with a monotone stack; for the budget, the least-area interior rung removed with ties to the lower bitrate and neighbours updated; credible answers on codec transitions and measurement noise.

## NFX-L2-03: Debug the daily Top-10 ranker

| | |
|---|---|
| **Template ID** | NFX-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Metrics code / restated deliveries, filters, units, ordering and ranks |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | NFX-L2-03.mjs |

**Business Scenario.** A streaming service publishes daily lists of its most-watched titles per country and globally. In this exercise a title's views are its hours viewed divided by its runtime in hours, so that a short film and a long series season can be compared. Viewing arrives in daily deliveries per country, and a country's day can be delivered again with corrections. The analysts have raised several complaints about the ranker. A country's list was empty on a day when a different country's numbers were restated. Titles whose trailers autoplay on the home page climb the list. A 90-minute film's views come out too high. Long seasons rank above short films that more people finished. Two titles with identical views were given different ranks. The ranker below is the suspect. {{scope_rule}}

**Problem Statement.** Fix `top10(rows, titles, day, country=None, k=10)` so that it meets this specification. `rows` is a list of dicts `{"day", "country", "title", "kind", "seconds", "batch"}`. `titles` maps a title id to `{"name", "runtime_min"}`.
1. **Scope.** Only rows for `day` count. With a `country`, only that country's rows count. With `country=None`, every country's rows count: that is the global list.
2. **Restatements.** For each day and country, only the rows of that pair's highest `batch` count. A later delivery replaces the earlier one entirely, so a title missing from it has no viewing in that country that day. Different countries can be on different batches.
3. **Viewing.** Only rows with `kind == "play"` count. Rows with `kind == "preview"` are home-page previews and are not viewing.
4. **Views.** Hours viewed are the counted seconds divided by 3 600. Views are hours viewed divided by the runtime in hours (`runtime_min / 60`). A title missing from `titles`, or whose `runtime_min` is `None`, is left out.
5. **Order and rank.** Order by views, highest first, then by title id ascending. A title's rank is 1 plus the number of titles with strictly more views, so tied titles share a rank (1, 2, 2, 4). Compare views exactly. Return the first `k` titles as `(rank, title_id, hours, views)`.

**Constraints.** Keep the function's shape and output format. Up to 200 000 rows and a few thousand titles, processed in linear time plus one sort.

**Assumptions.** Rows, runtimes and deliveries are hypothetical and simplified. Seconds are positive integers and runtimes are at least 60 minutes. Batches are positive integers. This exercise's views rule is a simplification; check the published methodology before reasoning about any real list.

**Clarifications.**
- Q: Does a restatement replace rows title by title? | A: No. The highest batch of a day and country replaces that pair's whole delivery. A title absent from it has no viewing there.
- Q: If one country is restated, does the global list use batch 2 everywhere? | A: No. Each country uses its own highest batch for that day.
- Q: Can two titles tie on views? | A: Yes, and they share a rank. The next title's rank skips, as in 1, 2, 2, 4.
- Q: What if fewer than `k` titles have viewing? | A: Return all of them.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. Make two countries, restate one of them, and ask for the other country's list.
2. Compare the literal in the preview filter with the data, character by character.
3. Work out the views of a 90-minute film watched for 3 hours by hand, then run it.
4. Which number does the sort use, and which number does the specification rank by?

**Follow-ups.**
1. A delivery for yesterday arrives after the list was published. Do you republish, and how do readers see that a number changed?
2. Views divide by runtime. What runtime does a series season use, and what happens to its views when an episode is added mid-week?
3. At 190 countries and every day of the year, this runs as a batch job. How would you make it incremental, and what do restatements do to that?
4. Two titles tie for tenth place in a published list. What should the list show, and who decides?

**Follow-up rules.**
- when: float, round, rounding → ask: Two titles have equal views as fractions but you compute them in floating point in two different ways. Can they come out unequal, and how do you compare exactly?
- when: max batch, latest batch, highest batch → ask: What is the key of your latest-batch lookup, and what happens to the global list when only one country is restated?
- when: dense_rank, dense rank, row_number → ask: The specification says 1, 2, 2, 4. Which window function gives that, and what do the other two give?
- when: lower(, casefold, strip( → ask: Normalising strings hides a typo in this case. What test would have caught the preview filter before it shipped?

**Evaluation Criteria.** Finds and explains every bug with its business symptom; the latest batch chosen per day and country; previews excluded with the right literal; runtime in hours as a real division; ordering by views with the title-id tie-break; competition ranks for ties, with views compared exactly; the fix stays minimal and linear; adds a check per bug.

## NFX-L2-04: Ingesting viewing events from devices that go offline

| | |
|---|---|
| **Template ID** | NFX-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / device telemetry, offline replay, deduplication, clock skew |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "devices": {"2": ["40 million", "90 million"], "3": ["250 million", "400 million"]},
  "peak_eps": {"2": ["400,000", "900,000"], "3": ["3 million", "6 million"]},
  "offline_window": ["48 hours", "7 days", "30 days"],
  "regions": [3, 4, 6]
}
```

**Business Scenario.** A streaming service's apps run on smart TVs, phones, tablets, game consoles, streaming sticks and web browsers, about {{devices}} active devices in a day. While a title plays, the app sends playback events: start, a heartbeat every few seconds or minutes, pause, seek, quality change, error and stop. At peak the service receives about {{peak_eps}} events per second across {{regions}} regions. On phones and tablets, members watch downloaded titles with no connection, and the app keeps the events in a local buffer for up to {{offline_window}}, then sends them in a burst when it reconnects. Device clocks are often wrong, by minutes or by years. The events feed several consumers: resume points for "continue watching", viewing history, daily popularity counts and playback-quality monitoring.

**Problem Statement.** Design the path from the device to durable, deduplicated viewing data that each consumer can use. Cover the event schema and what identifies one event, the regional ingestion tier and what it acknowledges, the durable buffer and its partition key, deduplication of retried and replayed events, how you assign a trustworthy time to an event whose device clock is wrong, how late and offline events reach each consumer, backpressure when a reconnect storm arrives, and the health metrics you would watch.

**Constraints.** A device retries until it receives an acknowledgement, so the same event can arrive many times. Events from one playback session can arrive out of order, and part of a session can arrive days after the rest. Resume points need seconds, popularity counts need complete days, and quality monitoring needs minutes. Events carry a profile identifier and nothing else personal. No event may be lost once acknowledged.

**Assumptions.** All volumes, windows and rates are hypothetical. Each app can keep a local counter and a session identifier. You may use common building blocks: a partitioned durable log, a stream processor, a key-value store and object storage with a table format.

**Clarifications.**
- Q: Which timestamp do consumers want? | A: When the viewing happened. You also have the server's receive time, which is trustworthy but can be days late.
- Q: How wrong can a device clock be? | A: Usually seconds, sometimes hours, and occasionally a reset to a date years ago.
- Q: Does the device know when it was offline? | A: It knows its own clock and can keep a monotonic counter since boot. It does not know the true time while offline.
- Q: Are events for one session always sent by the same device? | A: Yes. A session belongs to one device and one profile.
- Q: Can a member delete viewing history? | A: Yes. A deleted item must stop appearing in history and recommendations, but aggregate counts already published are not changed.

**Hints.**
1. Give every event an identity that the device chooses: device, session and a sequence number. Then deduplication is a lookup, not a guess.
2. Record both the device time and the server receive time. Estimate each device's clock offset when it is online, and apply it to the events it buffered.
3. Consumers with different freshness needs should read the same log, each with its own rule for late data, rather than each having its own ingestion path.

**Follow-ups.**
1. Ten million phones reconnect in the same hour after a regional network outage and upload {{offline_window}} of buffered events. Walk through what each stage does.
2. A device's clock jumps back by two years in the middle of a session. Which events are affected, and how do you place them in time?
3. Popularity counts for a day are computed and then offline events for that day keep arriving for {{offline_window}}. What do you do with them?
4. How would you prove, with numbers, that no acknowledged event was lost during a regional failover?
5. A new app version doubles the heartbeat rate. What does it cost, and how would you stop that from reaching the bill unnoticed?

**Follow-up rules.**
- when: kafka, kinesis, partition key, partitioned → ask: What is your partition key? What happens to ordering within a session, and to the load on one partition, when one device type replays a backlog?
- when: dedupe, dedup, deduplication, exactly once → ask: How long do you remember event identities, and what happens to an event replayed after {{offline_window}}?
- when: watermark, event time, late data → ask: Your watermark advances with the wall clock. Where do events that are {{offline_window}} late go, and who still sees them?
- when: server time, receive time, ntp, clock offset → ask: How do you estimate a device's clock offset, and what do you do for events recorded before you had an estimate?
- when: uuid, random id, guid → ask: A random id per event makes retries deduplicable. What does it not give you that a per-session sequence number does?

**Production Reality Check.**
- A regional network outage ends and, in one hour, phones upload {{offline_window}} of buffered viewing; the ingestion rate in that region reaches four times its usual peak (the service-wide peak is about {{peak_eps}} events per second).
- A firmware bug on one family of smart TVs resets the clock to 1 January 2000 at every boot, so their events claim to be 26 years old.
- A mobile release retries without waiting for the acknowledgement timeout, and duplicate rates rise from 0.2% to 30% for one platform.

**Evaluation Criteria.** Device-assigned event identity with a bounded, justified deduplication window; acknowledgement only after a durable write; a partition key that keeps a session in order without hot partitions; device time and receive time both kept, with an offset estimate and a rule for implausible timestamps; one log, several consumers with their own lateness rules; admission control and backpressure for reconnect storms; privacy by minimal identifiers and deletion handling; health metrics such as duplicate rate, clock-correction rate, lag and late-event volume; a plan for each incident.

## NFX-L2-05: Daily title popularity: hours viewed, views and restatements

| | |
|---|---|
| **Template ID** | NFX-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / batch aggregation, late data, restatements, publishable numbers |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, data-architect |

```params
{
  "countries": [40, 90, 190],
  "titles": {"2": ["15,000", "30,000"], "3": ["60,000", "120,000"]},
  "late_window": ["3 days", "7 days", "14 days"],
  "publish_at": ["06:00 UTC", "10:00 UTC"]
}
```

**Business Scenario.** A streaming service publishes, every day at {{publish_at}}, the most-watched titles of the previous day for each of {{countries}} countries and globally, with hours viewed and views. In this exercise a title's views are its hours viewed divided by its runtime in hours. About {{titles}} titles have some viewing every day. Viewing data keeps arriving after the day ends: offline downloads sync later, some devices batch their events, and an ingestion fix can re-deliver a day. Most late viewing arrives within {{late_window}}. The list is read by the press, by partners who licensed the titles and by internal teams, so a published number must be explainable, and a change to it must be visible.

**Problem Statement.** Design the pipeline that turns deduplicated viewing events into the daily popularity tables and the published lists. Cover what counts as viewing (and what does not, such as autoplay previews), the grain and keys of each table, runtime as a versioned input (series seasons, episodes added, re-cuts), how restated and late data change past days, what is published at {{publish_at}} and what happens when the number changes later, ties and ranks, how small numbers are handled, reruns and backfills that give the same answer for the same inputs, and the checks that run before anything is published.

**Constraints.** The published list must be ready by {{publish_at}} every day. A published number is never silently changed: a correction must be versioned and explainable. Any past day can be recomputed from stored inputs. Viewing that arrives later than {{late_window}} must still be counted somewhere.

**Assumptions.** All volumes, windows and times are hypothetical. Upstream delivers deduplicated playback sessions with a profile, a title or episode, a country, start and end times and the seconds actually played. The catalogue provides runtimes and the season structure with effective dates. This exercise's views rule is a simplification.

**Clarifications.**
- Q: Which day does viewing belong to? | A: The day it happened, in UTC for this exercise, not the day it arrived.
- Q: What is the runtime of a season? | A: The sum of its episodes' runtimes. Episodes can be added later, so runtime changes over time; you decide which runtime a day uses and say why.
- Q: Are autoplay previews viewing? | A: No. Neither are trailers. Only playback of the title itself counts.
- Q: Can a published number change? | A: Yes, if late viewing arrives or a delivery is restated, but readers must be able to see which version they are looking at and why it changed.
- Q: Are there privacy rules for small countries? | A: Yes. In this exercise, a country-title figure below a minimum audience is not shown on its own.

**Hints.**
1. Aggregate by event day, country and title from immutable, versioned inputs, and rebuild a day's partition rather than appending to it.
2. Separate the computation from the publication: a day can be recomputed many times, but it is published on a schedule, with a version, and a later version is published only by a rule.
3. Make runtime an input with effective dates, joined as of the day, so a recomputation of last month uses last month's runtime.

**Follow-ups.**
1. A title's runtime in the catalogue was wrong for a week and is corrected. What do you recompute, what do you republish, and what do partners see?
2. Viewing for a day keeps arriving for {{late_window}}. Do you publish once, publish provisional numbers, or wait? Defend your choice to the press team.
3. A title ties for tenth place in one country. What does the list show, and is the rule the same in every country?
4. The job must finish by {{publish_at}} for {{countries}} countries. Where is the time spent, and what would you make incremental?
5. An analyst says the global list does not equal the sum of country lists. Explain when that is correct, and when it is a bug.

**Follow-up rules.**
- when: append, insert into, incremental → ask: A day is restated after a re-delivery. How does your table avoid counting that day's viewing twice?
- when: event time, event day, viewing day → ask: Viewing arrives {{late_window}} late. Which published day does it change, and when does a reader find out?
- when: runtime, scd, effective date → ask: A season gains an episode on Wednesday. Which runtime do Monday's views use if Monday is recomputed on Friday?
- when: rank(, dense_rank, row_number → ask: Which ranking function matches a published rule of 1, 2, 2, 4, and what happens at the cut-off for the list?
- when: threshold, k-anonymity, suppress → ask: A small country's number is suppressed but the global total includes it. Can a reader recover it by subtraction?

**Production Reality Check.**
- An ingestion fix re-delivers two days of viewing for one country after the list for both days was published at {{publish_at}}.
- A catalogue change sets the runtime of a popular season to 0 minutes for one day, and the views calculation divides by zero for that title only.
- Offline viewing for a holiday weekend keeps arriving for {{late_window}}, and the Monday list understates a family film by 12%.

**Evaluation Criteria.** Viewing defined precisely (title playback only, by event day); immutable, versioned inputs and overwrite-by-partition recomputation; runtime as a versioned, as-of input; separation of computation and publication with versioned, explained corrections; a policy for late viewing tied to {{late_window}}; ranks and ties defined; small-number suppression that cannot be undone by subtraction; pre-publication checks (completeness per country, runtime sanity, day-over-day changes); reruns that give the same answer; a plan for each incident.
