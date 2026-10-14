# Apple · Loop 4 — evaluator notes (hidden from candidates)

The privacy techniques below (randomised response, sketches, end-to-end
encryption, on-device computation) are general, published techniques. Score the
candidate on whether they apply them correctly, never on whether they guess how
any company implements them.

## APL-L4-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Use-case registry**: each approved use case has an id, the value domain, the mechanism and its parameters (ε = {{epsilon}} per report), allowed slicing attributes, retention, and an owner. The device downloads the signed registry; a use case not in it cannot report.
- **On the device**: the value is chosen from local data. For a small domain, generalised randomised response: report the true value with probability p = e^ε / (e^ε + k − 1), otherwise one of the other k − 1 values uniformly. For a large domain ({{domain_size}} values) that is useless (p is tiny), so the device hashes the value with a randomly chosen hash function into a small range and randomises that (local hashing), or encodes it into a sketch row (count-mean or Hadamard-style), sending the hash index with the noisy bits. The error then depends on ε and n, not on the domain size.
- **Per-day limit**: a ledger in protected storage on the device counts reports per rolling 24 hours across all use cases ({{reports_per_day}} at most). Budget is spent when the randomised report is created, not when it is uploaded. The randomised report is stored in the upload queue and resent byte-identical on every retry; if the queue overflows, reports are dropped, never regenerated. The window uses stored creation times and does not reset when the wall clock moves backwards (a strong answer also mentions memoising the randomised answer for a value that does not change from day to day, so repeating it does not leak more over time).
- **Ingestion**: a dedicated endpoint whose front end drops network addresses and transport metadata before anything is stored or logged. The envelope holds only the use-case id, a coarse client version, the day, the payload and a fresh random report id used solely to drop retried duplicates. No device, account or persistent id. Reports are batched and stored by day; raw reports are deleted after 30 days.
- **Aggregation**: a daily batch per use case counts the noisy reports, debiases them (for randomised response, estimate = (observed − n·q) / (p − q), with q the probability of reporting any particular other value), decodes the sketch for dictionary values, and computes a standard error for each estimate. For local hashing the variance is about n · 4e^ε / (e^ε − 1)²: at n = 100 million and ε = 2 the standard error is about 8,500, so true counts below a few tens of thousands cannot be told from zero.
- **Release rules**: publish only values whose estimate exceeds a threshold of several standard errors (higher when many values are compared, to control false "top values"), only for populations above a floor, only for approved coarse slices, always with intervals. Product teams get tables of released estimates, never raw reports.
- **Governance and proof**: a review approves each use case's ε, slices and share of the daily budget; devices pick at most {{reports_per_day}} eligible use cases per day at random. Proof that the limit held comes from client tests, a lab fleet of test devices whose sends are captured, and a server monitor of reports per day per client version against the expected count for that version's opted-in population.

**Competing designs to accept.** Plain randomised response for a small domain if the candidate shows the domain is small. Count-mean sketch, Hadamard response or local hashing for a large one. A shuffler or anonymising relay between devices and the server, if the candidate explains what it adds and whom it trusts. Discovering new values with fragment- or prefix-based heavy-hitter rounds, as long as each round is charged to the daily limit.

**Bottlenecks and failure modes.** Re-randomising on retry (averaging away the noise); budget enforced on the server (impossible without linking); identifying attributes added "for slicing"; transport metadata in somebody else's logs; tiny slices where noise dominates; a top-K over many noisy estimates that crowns noise; dictionary values that hide new popular values.

**Incident guidance.**
- *Fresh report per retry*: k independent noisy copies of one value let an observer average the noise away, so those devices effectively spent about k·ε. Turn the use case off for that client version through the registry, delete the raw reports carrying that version since the release (they cannot be separated per device, by design), and publish nothing derived from them. Fix the client to persist and resend the randomised report, add a test that a retried upload is byte-identical, and alarm on reports per version exceeding {{reports_per_day}} times that version's expected population.
- *Negative counts in a 3,000-device slice*: the standard error in that slice is of the same size as most true counts, and the largest of thousands of noisy estimates is mostly noise. Withdraw the table, explain why, and apply the release floor and thresholds; offer a coarser slice, several days pooled, or the value's interval instead.
- *Network addresses in another team's logs*: treat it as a privacy incident. Stop the logging for this endpoint now, purge the logs, their replicas and backups, check who accessed them, and record the incident through the privacy owner. Prevention: a dedicated front end for the endpoint with its logging configuration under test, a periodic scan for addresses in any log tied to it, and an agreement with the team that runs the load balancer.

**Follow-up guidance.** Make the candidate compute one standard error with their numbers. Ask where the limit is enforced and how a retry behaves; a candidate who would deduplicate on a device id has missed the point. Push on what a product team receives for a value below threshold.

**Rubric anchors.** 2: "add noise on the server" or a device id for deduplication; no estimator; no limit enforcement. 3: on-device randomisation with a correct debiasing estimator, a large-domain strategy, a device-side ledger with resend-not-regenerate, metadata stripped at ingestion, thresholds on release. 4: also quantitative error at the stated n and ε, budget shared across use cases with governance, proof the limit held, discovery of new values within budget, and crisp handling of all three incidents.

**Strong signals.** Starts from the estimator and its error; names what must never be linkable. **Red flags.** Collecting raw values "temporarily"; slicing by many attributes; treating ε as a dial product teams can turn up when results are noisy.

## APL-L4-02

**Reference architecture (one defensible design; score others on the criteria).**
- **Capture**: the device creates a play id (random) when playback starts and logs recording id, start time by device clock, seconds heard, offline flag, app version and account. Uploads are batched; retries resend the same play ids. The service stamps arrival time.
- **Ingestion**: an append-only raw table (partitioned by arrival date) deduplicated on play id. A second check looks for different play ids with the same account, device, recording and start time, reported per app version as a duplicate rate.
- **Clock validation**: a start time after arrival, or earlier than arrival minus {{offline_days}} days, is flagged; such plays are quarantined or clamped by a stated rule rather than silently dated.
- **Qualifying**: seconds heard ≥ {{qualify_seconds}}; subscription valid at the play's start (an effective-dated subscription history); arrival within {{offline_days}} days of the play; territory from the account's effective-dated storefront history at the play's start; not excluded by fraud review. Exclusions are rows with their own recorded time, not deletions.
- **Aggregation**: an incremental table of counts keyed by (play day, arrival day, territory, recording), with exclusions entered as negative counts on the day they were recorded. A statement for month M is the sum over play days in M and arrival days up to the cutoff ({{close_days}} days after month end), so every statement is an as-of query that can be rerun exactly. At the volumes here this avoids rescanning tens of billions of raw rows each month.
- **Statements**: generated at the cutoff, mapped to rights holders with the catalogue version in force, stored as frozen, versioned artefacts together with their manifest (the cutoff, the catalogue version, counts and checksums per line).
- **Adjustments**: each new statement also lists, for every earlier month still inside the adjustment window, current as-of-now counts minus everything already reported for that month, as lines that name the period. Nothing sent is ever edited.
- **Traceability**: raw plays are append-only with arrival time, so any line can be re-derived down to its play ids; access for rights-holder audits uses those manifests.

**Competing designs to accept.** A lakehouse with time travel instead of arrival-day keys, if the candidate shows the as-of query and how long versions are kept. Holding suspected automated plays in a pending state that is not reported until cleared (fewer negative adjustments, later payments). Streaming ingestion with batch statements; a fully batch pipeline is fine at monthly cadence.

**Bottlenecks and failure modes.** Retry duplicates with new ids; device clocks; storefront changes mid-month; late offline plays after the cutoff; fraud found after reporting; catalogue mapping changes between statements; rescanning raw data for each restatement.

**Incident guidance.**
- *Offline plays sent twice with different ids*: confirm through the secondary duplicate rate by app version. Mark the duplicates as excluded (recorded now), so the current month is right before its cutoff and last month's correction appears as negative adjustment lines on the next statement. Fix the client, add the duplicate-rate monitor as a gate before each statement, and tell affected rights holders why the adjustment exists.
- *Rights holder shows 12% more*: reconcile before changing anything. Produce a waterfall from all plays received to qualifying plays: short plays below {{qualify_seconds}} seconds, plays without a valid subscription, plays attributed to other territories by storefront, late offline plays not yet arrived, exclusions, and recordings counted under another release of the album. Only a defect found in your own pipeline changes the statement; otherwise send the explanation.
- *40,000 automated accounts*: record exclusions with today's recorded time; the open month is corrected before its cutoff and the three reported months get negative adjustment lines with a reason code. Keep the evidence for disputes. Prevention: earlier detection, and possibly a pending state for suspicious plays.

**Follow-up guidance.** Ask for the exact query behind one statement line and how it is rerun a year later. Probe the territory rule with a mid-month storefront change. Ask what the adjustment window is and what happens to a play that arrives after it.

**Rubric anchors.** 2: one table updated in place, statements rerun on demand and different each time, no play ids. 3: device play ids with idempotent ingestion, event and arrival time, effective-dated subscription and storefront, frozen statements and computed adjustments. 4: also an incremental as-of aggregate that scales, clock validation, secondary duplicate detection, reconciliation by reason, and precise handling of each incident.

**Strong signals.** Defines a statement as an as-of query before drawing the pipeline. **Red flags.** Editing sent statements; deleting fraudulent plays; dating plays by arrival.

## APL-L4-03

**Reference architecture (one defensible design; score others on the criteria).**
- **What the server sees**: account and device ids, client version, request type, number and size of records, opaque record ids, change tags or version vectors used for conflict detection, timestamps, outcome codes, and the network address of the request. It needs some of this to work; it does not need to keep all of it.
- **Minimisation**: logs have an allowlist of typed fields and no free-text fields; unknown request fields are dropped before logging. Record ids are random, never derived from names. Network addresses are used for abuse protection and dropped or truncated within a short window. Analytics tables coarsen time (hour) and size (buckets). Ciphertext is padded to size buckets where exact size could reveal content (for example an attachment's length). Logs kept {{log_days}} days, then only aggregates.
- **Service metrics from metadata**: server-side sync latency = time from a change being committed for one device to its delivery to another device of the same account (commit time to fetch time); push delay; conflict rate from version mismatches; failure rates by request type and client version; storage per account by size bucket and by record count; active devices per account (about {{devices_per_account}}).
- **Opt-in client telemetry**: fixed, content-free schema, aggregated on the device per day: decryption failures (with the writer's client version, which travels as plaintext metadata in the record envelope), conflicts resolved, end-to-end sync durations as histograms. For sensitive counts, a local privacy mechanism and release thresholds.
- **Broken releases**: staged client rollout with gates on decrypt-failure rate per writer version; the server keeps previous ciphertext versions for a short time so healthy clients can restore; the server can refuse writes from a bad client version (it sees the version).
- **Questions refused**: anything about content. Offer instead an opt-in on-device aggregate under a privacy mechanism, with a minimum population, or a user research study with consent.
- **Deduplication**: no cross-account deduplication of encrypted content: making identical plaintext produce identical ciphertext lets the server confirm who stores a known file. At most, deduplicate within one account under that account's keys.
- **Support**: sees device list, last sync time per device, error codes and client versions, never content; recovery happens on the user's devices.

**Competing designs to accept.** Encrypting record types and change metadata too (better privacy, harder conflict handling and debugging) if the candidate states the cost. Relying on the server's view only and no client telemetry, if they show how a decryption bug would still be found (for example devices repeatedly re-fetching the same records). Differentially private client aggregates for some product questions.

**Bottlenecks and failure modes.** Metadata that leaks content (sizes, timing, names in debug fields); clients as the only witness of corruption; opt-in bias in telemetry; support pressure to "just look"; storage growth that cannot be explained by inspecting content.

**Incident guidance.**
- *Records other devices cannot decrypt*: the signal must come from clients: decrypt failures by writer version, or re-fetch loops visible on the server. Halt the rollout, have the server refuse or flag writes from that version, ship a fix, and let healthy clients restore the last good ciphertext versions. Prevention: decrypt-failure gates in the staged rollout and a cross-version compatibility test in the client release process.
- *Record names in logs for five days*: strip the field at the front end now, purge the logs (and copies, replicas, derived datasets) for the period, review access, and record it through the privacy owner, who decides on any notification. Prevention: allowlisted log schemas, a check that rejects new fields from reaching logs without review, and scanning for name-like strings.
- *Storage 30% above forecast*: work from shape, not content: growth by client version (a version history or retry bug writing duplicates), by account (a few accounts or everyone), by record count versus record size, and by retention of old versions. Usually a write-rate anomaly per client version gives it away.

**Follow-up guidance.** Have the candidate define sync latency with only observable timestamps. Ask what support can see. Push on the formatting-feature question: a strong candidate declines or proposes an opt-in on-device aggregate with thresholds, and says who approves it.

**Rubric anchors.** 2: plans to log or index content "for analytics", or ignores metadata leaks. 3: inventory and minimisation of metadata, service metrics from metadata, opt-in content-free client telemetry, staged rollouts with recoverable versions, refusal of content questions. 4: also padding and convergent-encryption trade-offs, decrypt failures tied to writer versions, a log-field allowlist enforced at the edge, opt-in bias acknowledged, and precise handling of each incident.

**Strong signals.** Starts with what the server sees and what it should forget. **Red flags.** "We can decrypt for support"; free-text debug fields; cross-user deduplication of encrypted files.

## APL-L4-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Model**: price points per currency (amounts in minor units with the currency's exponent: zero, two or three decimals). A product's base price (base storefront, price point) and every storefront price (generated or override, amount, currency, tax-inclusive flag, the FX rate version and tax rate version used, the generation run) are rows with a valid-from instant, a valid-to instant and a recorded-at time (bitemporal). Schedules are rows with future valid-from instants. Subscriptions add a per-subscriber price record and price-change application events.
- **Effective instant**: a strong answer chooses one rule and makes it visible: for example local midnight in a time zone designated for each storefront (shown to the developer as an instant per storefront), or a single UTC instant shown in local time. Either is acceptable if stated; ambiguity is not.
- **Regeneration**: an FX or tax update starts a batch that computes candidate prices, snaps them to each currency's price-point grid, diffs them with the current prices and applies guardrails: a change beyond a band (for example ±30%) or a ratio near 10 or 100 needs review; per-currency exponent tests; a canary storefront first. The approved set is published as a new version with a future valid-from, switched by a version pointer, so rollback is a pointer change.
- **Read path**: a precomputed, replicated key-value view of (product, storefront) → current price, next scheduled price and its switch instant, with a version. Caches switch at the instant themselves without a refresh. The product page and checkout read the same view; checkout issues a price quote (id, amount, currency, tax, version, expiry of a few minutes) and charges the quote. A scheduled change inside a quote's life honours the quote.
- **Purchase record**: immutable, carrying quote id, price row version, amount in minor units, currency, tax amount and tax rate version, FX version, storefront and instant. "What did this customer pay and why" is a lookup plus the bitemporal rows it points to. Proceeds reports are reproducible from purchase records and versioned commission rules.
- **Scale**: reads at {{purchases_per_second}} purchases per second from replicated in-memory or key-value stores; regeneration writes millions of rows into a new version off the read path.

**Competing designs to accept.** Computing equalised prices on read from base price and rates (less storage, harder audit and caching), if every input is versioned. A single UTC switch instant, if communicated clearly. Honouring or not honouring a mistaken price as a business decision, if the candidate names the owner and the record that supports either choice.

**Bottlenecks and failure modes.** Currency exponents; rounding to price-point grids; effective instants across time zones; stale caches at a switch; mass regeneration contending with reads; audits impossible after in-place updates; tax-inclusive and tax-exclusive storefronts handled the same way.

**Incident guidance.**
- *UTC switch*: the rule was not local. Refund the difference to customers charged the new price before their local first; for the future, switch at each storefront's local midnight (or show developers the UTC instant in local time) and add a pre-publish check that lists the local switch time per storefront.
- *Prices 100 times too low*: freeze publishing, move the version pointer back (minutes, because prices are versioned), and quantify the purchases from the purchase records. Whether to honour them, and how developers are made whole, is a business decision; the records support either. Prevention: per-currency exponent from a reference table, unit tests for zero- and three-decimal currencies, the ratio guardrail and a canary storefront.
- *Tax change in nine days*: add a new tax rate version with its effective date; regenerate that storefront's tax-inclusive prices (or keep prices and accept lower proceeds, if that is the developer's setting) and publish with valid-from at the effective instant; past reports still show the old rate because each purchase recorded the tax rate version it used.

**Follow-up guidance.** Ask for the exact effective instant in two storefronts. Probe a checkout that straddles a switch. Ask how the system answers an auditor's question about a price three years ago.

**Rubric anchors.** 2: one price column per product and storefront, updated in place, floats for money. 3: bitemporal effective-dated prices and schedules, minor units with exponents, defined switch instants, versioned regeneration with guardrails, immutable purchase records. 4: also price quotes so the page and checkout agree, version-pointer rollback, canary publishing, reproducible proceeds, and precise handling of each incident.

**Strong signals.** Asks about currency exponents and the switch instant early. **Red flags.** Floating-point money; schedules applied by a cron job editing rows; no record of the rate versions behind a price.

## APL-L4-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Storage and sync**: samples are the truth, stored encrypted on the user's devices and synced between them; a strong answer keeps the server unable to read values (end-to-end encrypted sync) and computes on the devices. A sample carries id, type, start, end, value, unit, source, the device, the local UTC offset at its start, created time and a deletion tombstone.
- **Merge**: per user, type and day, sweep over every sample boundary; for each elementary segment take the highest-priority source that covers it; its contribution is the sample's value times the segment's share of the sample's duration (even-spread assumption). Totals are recomputed for any day touched by a late sample, an edit, a deletion or a change to the priority list. Because the priority list itself syncs and the computation is deterministic, every device reaches the same total once synced.
- **Local days**: each sample's local date comes from its stored offset; a sample crossing local midnight is split proportionally. Travel days can be 16 or 32 hours long; that is correct, and the interface can say so.
- **Sources**: a new source starts at the lowest priority; the user can reorder. Samples identical in interval and value from two sources are flagged as likely copies.
- **Sharing**: a grant row (recipient, data types out of {{share_types}}, granularity per type: totals or samples, visible-from date, granted at, revoked at). Data shared under a grant is encrypted to the recipient's keys; the owner's devices send updates while the grant is active. Revocation stops updates at once, rotates the grant's keys, deletes server-held copies, and instructs the recipient's devices to delete theirs when they next connect. Copies a recipient already exported cannot be recalled, and the interface says so.
- **Apps**: per-type read and write permissions, enforced by the on-device store.
- **Deletion**: tombstones sync; totals recompute; shared copies are updated or removed.

**Competing designs to accept.** Server-side storage and merging with strict access controls, if the candidate justifies why the server must read values and limits who can. Merging by "most granular source wins" instead of a priority list, if explained. Sharing only daily totals, never samples, to reduce exposure.

**Bottlenecks and failure modes.** Summing overlapping sources; apps copying other sources' data; day boundaries computed in the wrong zone; recomputing whole histories on every change; revocation that cannot reach an offline device; deletions that miss derived totals or recipients.

**Incident guidance.**
- *A connected app doubles totals*: the merge summed across sources or placed the new app above the watch. Recompute with the app at the lowest priority by default, detect identical intervals and values across sources, and tell the user which source was ignored. Prevention: lowest-priority default for new sources and a copy detector.
- *Travel days wrong*: days were computed in the device's current zone (or UTC) instead of each sample's recorded offset. Store the offset, recompute the affected days from samples, and add tests for flights across many zones and samples crossing midnight.
- *Revoked access still visible on an offline phone*: revocation reached the server and online devices but not the offline one until it reconnects. On reconnection the device must check grants before showing shared data and delete revoked data; key rotation stops new data at once. Tell the user honestly what revocation guarantees.

**Follow-up guidance.** Have the candidate merge a concrete hour with a partial overlap and give the numbers. Ask which component can read values and why. Push on what revocation promises.

**Rubric anchors.** 2: sums all sources, UTC days, sharing as a flag on the account. 3: priority-based interval merge with proration, recomputation of affected days, local days from stored offsets, grants with scope and revocation, a reasoned choice of where computation runs. 4: also deterministic cross-device agreement, encryption to recipients with key rotation on revocation, honest limits, deletion through to recipients, copy detection for new sources, and precise handling of each incident.

**Strong signals.** Treats totals as derived from samples and defines the day carefully. **Red flags.** Sending raw health data to a server "for analytics"; no answer for offline recipients; revocation that deletes the owner's own data.
