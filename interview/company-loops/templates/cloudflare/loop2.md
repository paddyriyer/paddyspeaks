# Cloudflare · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of a company that
runs a global edge network: CDN caching, DNS, security rules, edge compute with
key-value and object storage, analytics and log delivery. These are not questions
from any company's interviews, and they describe no company's internal systems.
Every workload, number, rule and schema is hypothetical. Format:
docs/COMPANY-INTERVIEW-LOOPS.md.

## CFX-L2-01: Weighted hashing ring for an origin pool — where each key goes, and what moves

| | |
|---|---|
| **Template ID** | CFX-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Hashing / consistent hashing with weighted virtual nodes, sorted ring and binary search |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | CFX-L2-01.mjs |

**Business Scenario.** A customer's site sits behind an edge network, and its traffic is served by a pool of origin servers. To keep each origin's cache warm, every request key (here, the URL path) should keep going to the same origin, and when one origin is taken out for maintenance only the keys it was serving should move. Origins differ in size, so a bigger origin should get a proportionally bigger share. A hashing ring with weighted virtual points does all three. In this exercise you write the routine that builds the ring and routes keys; the hashing rule is this exercise's rule, not a description of any product's load balancer (check current docs for real steering options).

**Problem Statement.** Implement `route_keys(origins, keys, vnodes, remove=None, detail=False)`. `origins` is a list of `(name, weight)` with distinct names and integer weights ≥ 0. Origin `name` places `weight * vnodes` points on the ring: point `i` (for `i` from 0 to `weight * vnodes − 1`) sits at position `ring_hash(name + "#" + str(i))`, using the `ring_hash` function given in the starter code, unchanged. Order all points by `(position, origin name, i)`. A key belongs to the first point in that order whose position is greater than or equal to `ring_hash(key)`. If no point qualifies, it wraps round to the first point of all. Return the list of origin names, one per entry of `keys`, in the same order. If the pool has no points at all (no origins, or every weight is 0), return None. {{remove_rule}} {{detail_rule}}

**Constraints.** Up to 60 origins, weights up to 5, `vnodes` up to 200, and 100 000 keys. Keys are ASCII strings and may repeat. Something close to O(V log V + n log V) for V points and n keys is expected. Scanning every point for every key is too slow at these sizes.

**Assumptions.** The pool, weights and traffic are hypothetical. Origins are always healthy in this exercise, so routing depends only on the ring. Two different points can, rarely, share a position; the ordering rule above decides between them.

**Clarifications.**
- Q: Is the comparison with the key's hash inclusive? | A: Yes. A point whose position equals the key's hash owns the key.
- Q: What happens to a key whose hash is larger than every point? | A: It wraps round to the first point in the ring's order.
- Q: Can I use Python's built-in `hash()` or `hashlib`? | A: No. Use the starter's `ring_hash` exactly, so that every answer is reproducible.
- Q: Does a weight of 0 mean the origin is in the pool? | A: It is listed but owns no points, so it never receives a key. That is how a drained origin looks.
- Q: Do the origins arrive in any particular order? | A: No. The answer depends only on the points, not on the order of `origins`.

**Hints.**
1. Build the list of points once, sort it, and keep the positions in a separate list. One binary search per key then finds the first position at or after the key's hash.
2. `bisect_left` on the sorted positions returns the first index whose position is greater than or equal to the hash. An index equal to the length means wrap to 0.
3. Removing an origin does not change any other origin's points. Which keys can possibly change origin, and where can they go?

**Follow-ups.**
1. Why give each origin many virtual points rather than one? What happens to the spread of keys with `vnodes = 1`, and how would you measure the imbalance?
2. Origins need to be added and removed several times a minute. What would you change so that you do not rebuild and re-sort the whole ring each time?
3. An origin is unhealthy for 30 seconds. Removing it moves its keys; is that what you want for such a short outage, and what would you do instead?
4. A single key (one very popular asset) is more traffic than one origin can serve. How would you change the scheme without losing cache affinity for every other key?

**Follow-up rules.**
- when: hash(, hashlib, md5, sha1 → ask: The starter gives you a hash. Why does it matter that every process in the edge network computes exactly the same hash for a key, and what does Python's built-in hash do across processes?
- when: modulo, % len, mod n → ask: With hash(key) % number_of_origins, what fraction of keys move when one origin of twenty is removed? Compare that with your ring.
- when: bisect, binary search → ask: Your search returns an index equal to the length of the list. What does that mean for the key, and which test catches it?
- when: rebuild, recompute the ring, re-sort → ask: How much work is a full rebuild for each pool change at 60 origins and 200 points per unit of weight, and how often can you afford it?
- when: reweight, weight change, change the weight → ask: An origin's weight goes from 2 to 3. Which keys move, and in which direction?

**Evaluation Criteria.** Exactly the given hash and point naming; points ordered by position, then origin name, then index; inclusive comparison and wrap-around; None for a pool without points; weight 0 handled as no points; repeated keys reported and counted for each entry; a sorted ring with binary search rather than a scan per key; for removal, the observation that only the removed origin's keys can move; a clear complexity argument; credible answers on virtual-node spread, churn and hot keys.

## CFX-L2-02: Peak requests per second over many dashboard ranges

| | |
|---|---|
| **Template ID** | CFX-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Range queries / sparse table for range maximum, clipping, tie-breaking |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | CFX-L2-02.mjs |

**Business Scenario.** An analytics dashboard for one zone (a customer's domain on the edge network) shows requests per second over the last few days. Customers drag over the chart to select a time range, and the dashboard shows the peak requests per second inside it. A page with many panels, comparisons and alert previews asks for tens of thousands of ranges over the same series, so each range must be answered without rescanning it.

**Problem Statement.** Implement `range_peaks(samples, ranges, with_time=False)`. `samples` is a list of `(second, requests)` rows for one zone, where `second` is a Unix epoch second and `requests` a non-negative integer. The series covers every second from the earliest to the latest second in `samples`. {{rows_rule}} `ranges` is a list of `(first, last)` pairs, both inclusive epoch seconds. Clip each range to the series. If no second remains, or `first > last`, the answer for that range is None. Otherwise it is the largest requests count of any second in the clipped range. {{time_rule}} Return one answer per range, in order. If `samples` is empty, every answer is None.

**Constraints.** Up to 200 000 seconds and 200 000 ranges. Ranges can be as long as the series. Something close to O(n log n + q) or O(n + q log n) is expected. Scanning each range is too slow.

**Assumptions.** Traffic numbers are hypothetical. Requests per second are exact counts in this exercise (no sampling). Seconds are UTC epoch seconds, so there are no time-zone or daylight-saving gaps.

**Clarifications.**
- Q: Are both ends of a range included? | A: Yes. `(t, t)` is a one-second range.
- Q: What if a range starts before the first sample? | A: Clip it to the series. Only a range with nothing left after clipping is None.
- Q: Can the same range be asked twice? | A: Yes. Answer it each time.
- Q: May I sort or preprocess the samples? | A: Yes. Preprocessing once is the point; the ranges are the many queries.
- Q: Are the values small? | A: They fit comfortably in a Python int. Do not assume a small maximum.

**Hints.**
1. The maximum of a range is the maximum of two overlapping ranges that together cover it. Overlap does not matter for a maximum, as it would for a sum.
2. Precompute, for every start and every power of two `2^k`, the maximum of the `2^k` seconds from that start. Each level is built from the one below in linear time.
3. To keep the earliest second on ties, store something whose maximum prefers a larger value and then a smaller second, for example a tuple `(value, -second)` or one integer that encodes both.

**Follow-ups.**
1. New seconds arrive every second while the dashboard is open. Which structure would you use so that appending is cheap and ranges stay fast?
2. The dashboard also shows the total requests in the range. What would you precompute for that, and why is it simpler than the maximum?
3. The series is stored at one-second resolution for a day, one-minute for a month and one-hour for a year. Which resolution answers a 10-day range, and what does the peak mean then?
4. The same peaks are needed for 50 000 zones on a shared analytics cluster. Where do you compute them, and what do you keep in memory?

**Follow-up rules.**
- when: segment tree → ask: A segment tree answers in O(log n) and supports updates. What does it cost per range here, and when would you prefer it to a sparse table?
- when: max(, slice → ask: How many seconds does max(series[a:b]) read over 100 000 ranges of a two-day series, and how long would that take?
- when: prefix max, running max → ask: A running maximum from the start answers ranges that start at the first second. What breaks for a range that starts in the middle?
- when: tuple, (value, -second), encode → ask: How does your stored value make the maximum prefer the earlier second on a tie? Show it on two equal peaks.
- when: sqrt, block → ask: With blocks of √n seconds, how much work is one range, and is that fast enough at 200 000 ranges?

**Evaluation Criteria.** Inclusive ranges clipped to the series; None for ranges with nothing left and for an empty series; correct peak and, where asked, the earliest second on ties; for unsorted rows, seconds summed and missing seconds treated as 0; a sparse table (or another structure with a sound bound) built once and used for every range; correct overlap of the two halves; a clear complexity argument; sensible answers on streaming updates, resolutions and many zones.

## CFX-L2-03: Debug the zone analytics rollup

| | |
|---|---|
| **Template ID** | CFX-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Log processing / sampling weights, retried delivery, nanosecond time, IPv6 prefixes |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | CFX-L2-03.mjs |

**Business Scenario.** An analytics pipeline turns edge request log lines into an hourly rollup per zone: requests, bytes served, bytes served from cache, and how many distinct client networks were seen. High-volume zones are sampled, so a log line can stand for many requests. Customers have raised several complaints. Some hours show more bytes served from cache than bytes served in total. Requests near the end of an hour appear in the next hour. Request counts jump after a log delivery is retried. A cache ratio by bytes looks worse than the customer's own measurements. Zones with many IPv6 visitors report far more distinct client networks than expected. The rollup below is the suspect.

**Problem Statement.** Fix `zone_rollup(lines)` so that it meets this specification. {{replay_rule}} Each line is a dict `{"zone", "ray", "batch", "ts_ns", "sample_interval", "bytes", "cache_status", "client_ip"}`.
1. **One request, one line.** `ray` identifies a request uniquely across all zones. A retried delivery can repeat a line in a later `batch`. Count each `ray` once and ignore later copies.
2. **Hour.** `ts_ns` is an integer number of nanoseconds since the Unix epoch, UTC. The line's hour is the epoch second at the start of its UTC hour.
3. **Sampling.** A line with `sample_interval = k` stands for `k` requests, each with the line's `bytes`. Requests and both byte totals are weighted by `k`.
4. **Cached bytes.** In this exercise's rule, responses with `cache_status` `hit`, `revalidated` or `updating` were served from cache; every other status was not (check current docs for real cache statuses).
5. **Client networks.** An IPv4 client is its own network. An IPv6 client's network is its /64 prefix, whatever way the address is written. The count is of distinct networks among the counted lines and is not weighted.
6. **Output.** A list of `[zone, hour, requests, bytes, cached_bytes, networks]`, one per zone and hour that has lines, sorted by zone and then hour.

**Constraints.** Keep the function's shape and output format. Up to 200 000 lines, processed in linear time. The standard library (including `ipaddress`) is available.

**Assumptions.** Log fields, statuses and the sampling scheme are hypothetical and simplified, not a product's log format. IPv6 addresses are in hexadecimal notation, possibly compressed with `::` and in any letter case, with no embedded IPv4 part.

**Clarifications.**
- Q: Is a repeated line always in a different batch? | A: Usually, because retries resend the batch under a new id. A line is a repeat if its `ray` was already counted, whatever the batch.
- Q: Should distinct networks be scaled by the sample interval? | A: No. Report the networks seen in the counted lines, unweighted. Estimating the unsampled count is a follow-up.
- Q: Is `ts_ns` ever a float? | A: No, it is always an integer. Keep it that way.
- Q: Are `2001:db8::1` and `2001:db8:0:0::2` the same network? | A: Yes. Both have the /64 prefix `2001:db8:0:0`.
- Q: How many bugs are there? | A: Several, of different kinds. The checks point at each one.

**Hints.**
1. Compute an hour by hand for a line at the last nanosecond before an hour boundary, first with the code's arithmetic and then with integers only.
2. Read the de-duplication key and ask what a retried batch changes and what it keeps.
3. Write two IPv6 addresses for the same /64 in different forms and pass them to `_network`.
4. Check that every total that depends on sampling multiplies by the same weight.

**Follow-ups.**
1. The network count is from sampled lines only. How would you estimate the number of distinct networks for a zone sampled at 1 in 100, and how confident could you be?
2. Retried batches can arrive hours later. How long must you remember `ray` ids, and how do you bound that memory across all zones?
3. A late batch arrives for an hour already shown to the customer. How do you update the rollup, and what does the dashboard show while it changes?
4. Customers want the same rollup per country and per status code. How do you avoid one pass per breakdown, and which totals can be added across breakdowns?

**Follow-up rules.**
- when: float, / 1e9, int( → ask: At what size does a float stop representing every nanosecond exactly, and how far from it is today's epoch in nanoseconds?
- when: batch, dedupe, dedup, seen → ask: How long does your seen-set live, and what happens to a retry that arrives after you have forgotten the ray id?
- when: ipaddress, /64, prefix → ask: Why group IPv6 clients by /64 rather than by full address, and what would grouping IPv4 by /24 change for the customer?
- when: scale, scaled, extrapolate, multiply → ask: Which output columns can be scaled by the sample interval and which cannot, and why?
- when: hyperloglog, hll, sketch → ask: Can you merge your per-hour sketches into a per-day count, and what error would you quote to the customer?

**Evaluation Criteria.** Finds and explains every bug with its customer-visible symptom; de-duplicates by request id, not by batch; integer-only nanosecond arithmetic; bytes and cached bytes weighted like requests; the full set of cached statuses; IPv6 networks by parsed /64 prefix; a minimal, linear fix; a regression test per bug; sensible answers on sampling, late data and memory.

## CFX-L2-04: Logs delivery to customer destinations — batching, retries and proving completeness

| | |
|---|---|
| **Template ID** | CFX-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / push delivery to external sinks, batching, retries, completeness manifests |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, software-engineer |

```params
{
  "jobs": {"2": ["20,000", "60,000"], "3": ["250,000", "600,000"]},
  "volume": {"2": ["3 million log lines a second"], "3": ["40 million log lines a second", "90 million log lines a second"]},
  "batch_window": ["30 seconds", "1 minute", "5 minutes"],
  "outage": ["6 hours", "24 hours", "3 days"]
}
```

**Business Scenario.** Customers of an edge network can ask for their request logs, firewall events and other datasets to be pushed to a destination they own: an object-storage bucket, an HTTP endpoint or a log analytics service. Each customer configures a delivery job: which dataset, which fields, an optional filter and sample rate, and a destination. There are about {{jobs}} jobs, and together they carry about {{volume}}, produced at hundreds of locations worldwide. Jobs deliver files every {{batch_window}} or so. Destinations are outside your control: they throttle, reject credentials after a key rotation, or disappear for up to {{outage}}. Customers ask one question above all: did I get every log line?

**Problem Statement.** Design the delivery pipeline from the moment a log line exists at an edge location to the moment a file lands at the customer's destination. Cover where lines are collected and buffered, how they are grouped into per-job batches, the file naming and content, the retry policy and back-off per destination, what happens to a destination that is down for {{outage}}, how one slow destination is kept from delaying other jobs, how a job's configuration change takes effect, and how you prove completeness to the customer: what they can check on their side and what you show them.

**Constraints.** Delivery is at least once; a retry can produce a duplicate file, so the customer must be able to tell. Lines from different jobs must never be mixed. The pipeline must not buffer unboundedly for a dead destination. Customers' credentials for destinations are secrets and never appear in logs or analytics. In this exercise's rule, a job may be disabled after a long run of failures and the customer notified (check current docs for real product behaviour).

**Assumptions.** All volumes, windows and limits are hypothetical. Each log line carries a unique request id and its event time. You may use common building blocks: a partitioned log, object storage for staging, a scheduler and a stream processor. Nothing here describes how any real edge network is operated.

**Clarifications.**
- Q: Is the batch window by event time or by arrival time? | A: You decide, and you must say what the customer can conclude from a file's time range.
- Q: Can the customer filter fields and sample? | A: Yes, per job. Sampling is part of the job's configuration and must be visible in what you deliver.
- Q: How late can a line be? | A: Most lines reach the pipeline within seconds; a location that loses connectivity can send lines up to an hour late.
- Q: What does the customer see if their bucket is unreachable? | A: Today, nothing until files reappear. Part of your design is what they should see.
- Q: Is exactly once required? | A: No. At least once with a way to detect duplicates is the contract.

**Hints.**
1. Separate collection (durable, independent of destinations) from delivery (per job, retryable). A dead destination should only make one job's backlog grow.
2. Give every file a deterministic name from the job, the time window and a sequence number, so a retried upload overwrites or is recognisably the same file.
3. A completeness claim needs a count. Publish, per window, how many lines the job should contain and which files carry them.

**Follow-ups.**
1. A customer's destination is down for {{outage}}. Walk through what you keep, for how long, what you drop, and what the customer sees and can recover afterwards.
2. A customer says lines are missing for one hour. What evidence can you and they look at, and how do you tell a gap in delivery from a gap in traffic?
3. A customer changes a job's filter at 12:00:30. Which lines are delivered under which configuration, and how do they know?
4. One destination accepts uploads at a tenth of the rate you send. How do you protect the jobs that share capacity with it?
5. At {{volume}}, how do you size the batching layer, and what dominates the cost: compute, storage or egress?

**Follow-up rules.**
- when: exactly once, exactly-once → ask: The destination is outside your control and acknowledges after writing. Where exactly can a duplicate still appear, and how does the customer detect it?
- when: retry, back-off, backoff, exponential → ask: How long do you keep retrying a destination that has been down for {{outage}}, and where are the lines kept meanwhile?
- when: manifest, line count, checksum → ask: Who writes the manifest, when, and what does it say about lines that arrive an hour late for a window already delivered?
- when: kafka, partition key, topic → ask: What is your partition key, and what happens to other jobs on that partition when one destination stalls?
- when: dead letter, dlq, drop → ask: When you finally give up on a batch, what do you tell the customer, and can they ask for it again?

**Evaluation Criteria.** Collection decoupled from per-job delivery, with bounded per-job backlogs and isolation between jobs; deterministic file names and sequence numbers that make retries recognisable; a clear rule for event-time windows and late lines; per-window manifests or counts the customer can check; retry and back-off with a documented give-up point and notification; configuration changes applied at a recorded boundary; secrets kept out of logs; sampling visible in the output; a cost and sizing argument.

## CFX-L2-05: Measuring global key-value propagation — write-to-visible time, stale reads and a trustworthy dashboard

| | |
|---|---|
| **Template ID** | CFX-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Measurement pipelines / probes, clock skew, percentiles, customer-facing metrics |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, software-engineer, data-architect |

```params
{
  "locations": {"2": ["120", "200"], "3": ["300", "330"]},
  "target": ["60 seconds", "30 seconds", "10 seconds"],
  "namespaces": {"2": ["50,000"], "3": ["2 million", "5 million"]},
  "probe_rate": ["one write a minute per location", "one write every 10 seconds per region"]
}
```

**Business Scenario.** An edge compute platform offers a global key-value store: a write is accepted in one place and becomes readable at every location eventually, and reads are served from the nearest location, possibly from a cache. In this exercise's rule, a write is expected to be visible everywhere within about {{target}} (check current docs for the real consistency model). There are {{locations}} locations and {{namespaces}} customer namespaces. Customers want to know how stale their reads can be, the product team wants to know when propagation is getting worse, and both want a dashboard they can trust.

**Problem Statement.** Design how propagation is measured and reported. Cover what is measured (write-to-visible time per location, the share of reads that returned an older value, the age of what was read), how measurements are taken (synthetic probes, customer traffic, or both, at {{probe_rate}}), how you get correct durations when clocks at different locations disagree, how measurements are aggregated (per location, region, namespace and time window, with percentiles), how you handle probes that never see their write, and what the customer-facing dashboard shows and does not claim.

**Constraints.** Never read or log customers' values; metadata (keys hashed, sizes, versions, timestamps) only. Clocks at different locations may differ by tens of milliseconds and occasionally by seconds. Percentiles must be correct when combined across locations and windows. The measurement itself must not be a meaningful share of the store's load or cost.

**Assumptions.** The scale, target and probe rates are hypothetical. Each stored value carries a version or write timestamp from the location that accepted it. Locations can run small probe programs and report to a central pipeline. Nothing here describes how any real network or store is operated.

**Clarifications.**
- Q: Can I use customer reads, or only synthetic probes? | A: Both are open to you. Customer reads tell you what customers saw; probes give a controlled, continuous signal. Say what each can and cannot prove.
- Q: What is a stale read? | A: A read that returned a version older than the newest version accepted at least {{target}} earlier. You may refine that definition, but state it.
- Q: How good are the clocks? | A: Synchronised, but not perfectly. Assume tens of milliseconds normally and occasional jumps of seconds.
- Q: Who sees the dashboard? | A: Customers see their own namespaces and global health. The product team sees everything, including per-location detail.
- Q: Is a write that never arrives at a location possible? | A: In this exercise, yes, rarely, until repaired. Your measurement must notice it.

**Hints.**
1. Measure a duration with one clock where you can: a probe that writes and then polls from the same location avoids skew for that leg. For cross-location timing, carry the write's timestamp and estimate the skew.
2. Percentiles do not average. Keep histograms or mergeable sketches per location and window, and merge them.
3. A probe that has not seen its write yet is not missing data. It is a censored measurement, and dropping it makes the numbers look better than they are.

**Follow-ups.**
1. One location's clock jumps by 4 seconds for ten minutes. What does your dashboard show, and how do you detect and correct it?
2. The p99 write-to-visible time doubles in one region. How would you tell a propagation problem from a probe problem?
3. A customer says their reads were stale for 5 minutes yesterday, and your dashboard shows nothing. What can you check, without reading their values?
4. How would you show a customer the staleness of their own namespace when it gets only a few writes a day?
5. At {{namespaces}} namespaces, which aggregates do you keep per namespace, and which only globally?

**Follow-up rules.**
- when: average, mean, avg → ask: The average write-to-visible time is 2 seconds. What does that say about the slowest location, and what would you show instead?
- when: percentile, p99, p95 → ask: How do you combine p99 across 300 locations and 60 one-minute windows, and why is averaging the p99s wrong?
- when: ntp, clock skew, skew → ask: Which leg of your measurement depends on two clocks, and how big must the skew be before it changes what you report?
- when: timeout, never arrive, censored → ask: A probe gives up after 5 minutes without seeing its write. Does that become a 300-second sample, a missing sample, or something else, and why?
- when: customer reads, real traffic → ask: Customer reads tell you a version, not when it was written elsewhere. What extra metadata would you need, and can you get it without reading values?

**Evaluation Criteria.** A precise definition of propagation time and of a stale read; probes and customer-read signals combined with what each can prove; durations measured on one clock where possible and skew handled explicitly elsewhere; censored measurements kept rather than dropped; mergeable histograms or sketches for percentiles across locations and windows; no customer values read or logged; a dashboard that states its definition, coverage and uncertainty; measurement cost bounded; credible answers on clock jumps, regional regressions and customer complaints.
