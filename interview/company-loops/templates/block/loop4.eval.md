# Block · Loop 4 — evaluator notes (hidden from candidates)

## BLK-L4-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Inside the location (latency path)**: front-of-house devices and kitchen screens share the location's network. One device (a register, or an elected coordinator among the location's devices) runs a local ticket router: a sent ticket goes to the router, which pushes each item to the screens of its station with an acknowledgement and resends until acknowledged. If the coordinator fails, another device takes over from the replicated local log. The cloud is not on this path, so an internet outage does not stop the kitchen. A simpler acceptable design sends directly from the sending device to each station screen with acknowledgements.
- **Ids and events**: ticket, item, course and table-session ids are created on the device where the order is entered. Every change is an event with `event_id, location_id, device_id, device_seq, device_ts`: `ticket_sent`, `item_added`, `item_voided`, `item_remade (replaces item_id)`, `course_fired`, `item_bumped`, `ticket_bumped`, `bump_recalled`, `table_seated`, `table_moved`, `check_split`, `check_paid`, `table_cleared`. Events are appended to the local log and forwarded to the cloud in `device_seq` order; the cloud stamps receive time and deduplicates on `event_id`.
- **State machines**: item states `held → fired → bumped` (recall returns to `fired`); remakes are new items linked to the original; voids end an item without a bump. Ticket state derives from its items. Table session spans seated → cleared and survives a move (the session id stays, the table number changes) and a split (checks belong to the session).
- **Metric definitions**: kitchen time per item and station = last effective bump − fire (recalled bumps ignored); ticket kitchen time per station = last item bumped − first item fired for that course; guest wait = first bump of a course − send (or fire); course gap = fire of course n+1 − last bump of course n; table turn = cleared − seated. Remakes reported as a count and rate; voided items excluded from times. Report medians and p90, not means; tickets bumped after an absurd duration (for example over 2 hours) are flagged as "left on screen" and excluded, with the count shown.
- **Time**: instants in UTC with the location's IANA zone (versioned, with corrections recorded). Business day = local date of (local time − {{close_hour}} offset), daypart from local time. Durations are computed from UTC instants, so daylight-saving changes cannot produce negative or 25-hour durations; the reported business day on a transition night may be 23 or 25 hours long, which is stated.
- **Clocks**: within a location the router's clock is the reference; each device's offset is estimated from its acknowledgements (send and ack times) and stored; metrics use router-adjusted times. Offsets above a threshold raise a device alert.
- **Stations as data**: station id is stable; name and the item → station routing are versioned with validity intervals. Trends are reported per station id, with annotations when routing changes and an option to compare on a fixed item set.
- **Analytics**: a stream processor maintains today's provisional per-location aggregates within minutes; a daily build per location after its business day ends (plus a grace period for forwarded backlogs) produces the final figures by 9 a.m. local time. Late events after that trigger a recorded restatement.

**Competing designs to accept.** Cloud-routed tickets with a local fallback mode (acceptable if the candidate shows the fallback is exercised and the switch is automatic); device-to-device delivery with no coordinator; computing durations in the cloud only versus on the device; a fixed-length business day versus a local-date-shift rule, if daylight-saving behaviour is handled explicitly.

**Bottlenecks and failure modes.** Coordinator failure mid-service; duplicate events from flaky firmware; backlogs after outages arriving with skewed clocks; reports built on device local time; station renames breaking trends; means dragged by tickets left on screen overnight; split checks and table moves double-counting turns.

**Incident guidance.**
- *−58 minutes and 25-hour turns after the clocks go back*: durations were computed from local wall-clock times. Recompute from UTC instants for the affected day; add tests on both transitions for every zone in use; state the length of transition business days in the report.
- *40-minute outage and a screen three minutes fast*: the kitchen kept working because routing was local; the backlog is forwarded in order and deduplicated. Correct the screen's times with its measured offset (or the router's receive times) for the outage window, flag the station's numbers as adjusted, and alert on skew in future.
- *Desserts re-routed, cold station "improves" 22%*: not a training effect; the item mix changed. Show trends on a fixed item set or per item, annotate the routing change, and tell the owner plainly.
- *Bump events sent twice*: deduplicate on `event_id` (and on (device, seq)); a double bump on one item is idempotent in the state machine. Add a monitor comparing tickets per station with orders, and fix the firmware.

**Follow-up guidance.** Push on where the clock of record is, how a recall changes the metric, and what exactly a business day is on a daylight-saving night. Strong candidates write the metric definitions down before the pipeline.

**Rubric anchors.** 2: every ticket goes through the cloud; metrics from device local times; means. 3: local routing with acknowledgements, ids created on the device, event state machines, UTC plus zone with a business-day rule. 4: also clock-offset estimation, versioned stations and routing, transition-night handling stated, provisional versus final reports with restatement, and crisp answers to every incident.

**Strong signals.** Asks what "ticket time" means to an owner before designing; separates kitchen time from guest wait. **Red flags.** Storing local times without the zone; deriving the business day on the device; dropping late events after the day closes without saying so.

## BLK-L4-02

**Reference architecture (one defensible design; score others on the criteria).**
- **Signals**: an hourly job computes per-seller aggregates from payment, refund and reversal events (rates over trailing windows, volume relative to the seller's own trailing baseline, payment-type mix). Each value is written append-only with `seller_id, signal_name, value, window, valid_from, computed_at, code_version`. Recomputations after a fix write new rows with a new `code_version`; old rows are never updated. Point-in-time reads use `valid_from ≤ t` and the code version of interest.
- **Score**: the given service is called with the signal values; the response (score, score version, request id) is stored with the input values.
- **Case opening**: written, versioned rules (thresholds over score and signals, owned by the risk team) decide whether a case opens; each open records the rule version and the triggering values. Volume controls: a cap on cases opened per hour with prioritisation by expected loss, and shadow mode for new rules and score versions (computed and logged, opening nothing) until the expected volume is known.
- **Cases**: a state machine `opened → assigned → decided → (appealed → decided) → closed`, every transition an append-only event with actor and reason codes. The decision record freezes a snapshot of everything shown to the reviewer: signal values with their validity and code version, score and version, rule version, the activity the reviewer viewed, the decision (none, partial hold with amount or percentage, full hold, release), reasons and messages sent.
- **Holds**: an instruction to the deposit system keyed by case id and decision id, acknowledged; a reconciliation job checks every decided case against the deposit system's hold state daily and alerts on any mismatch. Automatic holds allowed by a rule carry a deadline; a sweeper releases them if no reviewer confirms by {{review_hours}} hours.
- **Seller messages**: templated by reason category (no score, no rule thresholds), with typical durations measured from the queue, and a request-for-information path that attaches documents to the case.
- **Access**: reviewers see the case's frozen record and the specific activity; analysts see aggregates (counts, rates, durations by category and region) with small-cell suppression; all case access is logged.
- **Measures**: time to decision and hold duration percentiles; queue age; outcome rates (released with no loss, loss) per decision; reviewer consistency via double-reviewed samples; hold rate versus outcome rate by business category and region.
- **Retention**: case records and snapshots for {{audit_years}} years in immutable storage; raw signal rows can expire once snapshots hold what decisions used.

**Competing designs to accept.** Storing signal history as bitemporal tables instead of snapshots on the case (acceptable if reads are provably reproducible); event-sourced case store versus a relational case table with an audit log; an external case-management product, if the candidate covers the frozen inputs and reconciliation.

**Bottlenecks and failure modes.** Overwritten signal tables that make old decisions unexplainable; a new score or rule flooding the queue; silent failures between decision and deposit system; seasonal volume spikes mistaken for risk; per-seller data leaking to analysts.

**Incident guidance.**
- *Cases triple after a new score version*: roll the score version back for case opening (keep it in shadow), triage the backlog by expected loss and age, release automatic holds that pass the deadline, and introduce versions only through shadow mode with a volume budget. Add seasonality awareness (seller's same period last year, holiday calendars) to the baseline signals.
- *Explaining a four-month-old hold after recomputation*: show the frozen snapshot from the case; that is what the reviewer saw. If the fix shows the old value was wrong, that is a separate review of affected decisions (next incident), communicated plainly.
- *Refunds counted once per location*: stop the job, fix and recompute as a new code version; find every case whose triggering values used the bad version and whose decision would change under the corrected values; re-review those, release unjustified holds promptly, and tell the sellers that their review has been updated. Add a test with multi-location sellers and a monitor on the signal's distribution.
- *Release instructions failing silently*: the reconciliation job (or its absence) is the story. Re-send releases with the same decision id, notify affected sellers, and alert on any decided case whose hold state disagrees for more than an hour.

**Follow-up guidance.** Push on reproducibility (where exactly the reviewer's view lives), introduction of new score versions, and measuring fairness from outcomes. Stop any drift into how controls could be avoided; it is out of scope.

**Rubric anchors.** 2: one mutable signals table read at review time; holds placed by score alone; no audit. 3: append-only signals with versions, frozen decision snapshots, case state machine, holds through the deposit system with acknowledgement. 4: also volume control and shadow mode, reconciliation of hold state, outcome-based fairness and consistency measures from aggregates, least-privilege access, and clear incident handling.

**Strong signals.** Distinguishes what the reviewer saw from what is true today; treats every hold as costing an honest seller money. **Red flags.** Detailed descriptions of how signals could be gamed; conclusions about a seller's character, creditworthiness or legality; automatic permanent actions without review.

## BLK-L4-03

**Reference architecture (one defensible design; score others on the criteria).**
- **Device store**: an encrypted local database with an append-only outbox. Every payment and order gets a device-generated id (a random 128-bit id, plus `device_id` and `device_seq`) at the moment it is taken. Offline payment records hold encrypted card data, amount in cents, time taken, catalogue version used and an expiry time (taken + {{offline_hours}} hours). The {{offline_cap}} per-payment limit is enforced on the device.
- **Forwarding**: on reconnect the outbox drains in `device_seq` order, payments first, ordered by nearest expiry. The authorisation service accepts each payment keyed by its device id, so resending is safe: a resend returns the stored outcome. A server-controlled admission rate (tokens per device, jittered back-off) prevents a mass reconnection from overwhelming authorisation, with priority by time left before expiry.
- **Payment states**: `stored → forwarded → authorised | declined`, and `stored → expired` (decided on the device and reported). The seller sees counts and amounts of stored, declined and expired payments prominently, per device.
- **Catalogue and stock**: catalogue entities versioned; the device records the version used for each sale. The sale price is what was charged; a later dashboard price applies only to later sales. Stock is a set of signed adjustments (sale −1 from device X, count set from the dashboard as a "count at time t" event, receiving +n); the current count is the latest count event plus subsequent adjustments ordered by event time, so offline sales before a count are absorbed and sales after it are subtracted. Negative stock is allowed and surfaced to the seller as needing a count; the online store uses a separate available-to-sell number with a buffer.
- **Analytics**: events land in the platform with device times and receive times; per device, a watermark (highest contiguous `device_seq` received, and its time). A day's report per location is provisional until every device that was active that day has a watermark past the end of the day or has exceeded the forwarding limit; then final. Later arrivals produce a dated restatement with the reason. Daily sales summary reconciles with authorised and settled totals; declined and expired payments appear as their own lines, not silent removals.
- **Lost devices**: stored payments exist only on the device; the platform knows (from the last sync and any heartbeat) how many were pending, and the seller is told what is unrecoverable.

**Competing designs to accept.** CRDT counters for stock (PN-counters) with a separate count-reset mechanism; server-assigned ids handed out in blocks to devices in advance; last-write-wins for descriptive catalogue fields (names, images) while stock uses merged changes, if the candidate says which is which and why.

**Bottlenecks and failure modes.** Retry storms after mass reconnection; duplicate charges from non-idempotent forwarding; stock overwritten by counts or dashboard edits; reports finalised before late devices report; expired payments still counted as sales; card data leaking into logs.

**Incident guidance.**
- *1.4 million payments in 20 minutes, 9-second authorisation*: admission control with jittered back-off by device, priority by time to expiry, and a resend that is safe because the payment id is the key. Measure how many payments are near expiry and confirm all are forwarded in time; review whether timeouts on the device are longer than the server's processing time.
- *Tablet reconnects after the limit*: expired payments must be marked expired, removed from sales or shown as a separate line, and the seller told the amount. Prevention: device warnings well before expiry, a reminder notification from the last known pending count, and a report rule that counts offline payments as sales only once authorised (with pending shown apart).
- *Old price sold 80 times*: the reported price per unit must be the charged price per sale with the catalogue version recorded; revenue per unit shown per price period, not by dividing today's price into totals. Tell the seller which device sold at the old price.
- *−12 units and online overselling*: two devices' offline sales merged correctly but the stock was genuinely oversold; surface negatives to the seller and stop the online store from selling below zero with an available-to-sell buffer that accounts for devices known to be offline.

**Follow-up guidance.** Push on what makes forwarding safe to repeat, which number the seller sees for a day and when it becomes final, and the per-field conflict rule.

**Rubric anchors.** 2: server-assigned ids, last-write-wins on stock, reports that ignore late data. 3: device ids with keyed forwarding, explicit payment states, merged stock changes, watermarks and provisional reports. 4: also admission control for mass reconnection, catalogue versions on sales, reconciliation with settlement, restatements visible to the seller, and crisp incident handling.

**Strong signals.** Starts from "what does the seller lose if this goes wrong"; treats expiry as a deadline that drives ordering. **Red flags.** Card data in analytics; "the device just retries" with no key; silently dropping declined or expired payments from reports.

## BLK-L4-04

**Reference architecture (one defensible design; score others on the criteria).**
- **Calendars**: per-country business-day calendars as versioned data (holidays with effective dates, version id, owner, approval), loaded by the scheduler, with every scheduled deposit recording the calendar version. A calendar change triggers recomputation of not-yet-sent deposits and notices to affected sellers.
- **Standard deposits**: a scheduler per seller time zone runs after each cut-off: it asks the balance service for amounts available for the period, creates a deposit record (`deposit_id = hash(seller, business_date, kind)`, so a rerun produces the same id) with amount in cents, send date (next business day by the calendar) and expected arrival, and submits a batch to the rail partner. Reruns are safe because the id is deterministic and the balance debit references it.
- **Instant transfers**: the client creates a request id; the server checks product limits only (available balance, eligible linked destination, sum of today's transfers in the stated time zone + amount ≤ {{daily_limit}}), computes the fee in integer cents (`fee = max(25, (amount_cents × bps + 5000) // 10000)` with bps for {{fee}}; for 1.75% on 133,333 cents, 2,333.33 → 2,333 cents), shows amount, fee and net, and on confirmation debits the balance with the request id as reference and submits to the rail. On timeout, it queries the rail by reference before any resend; the state stays "submitted — confirming" meanwhile. A double tap reuses the request id.
- **Status model**: `scheduled → submitted → sent → confirmed | returned | failed`, with each partner code mapped and the original kept; unmapped codes route to an "unknown" state with an alert, never to "confirmed".
- **Arrival measurement**: for confirmations, arrival = confirmation time; without, "presumed arrived" after N business days with no return, labelled separately; returns are definitive failures. Per rail, bank and country: share arriving by the shown date, with confirmed and presumed reported apart. Estimates shown to sellers come from measured distributions (for example the date by which 95% arrive) and change automatically when misses exceed a threshold.
- **Seller views**: next deposit amount, send date and expected arrival, with the rule used; instant transfer fee before confirmation; status updates; returned deposits with the reason and the fix.

**Competing designs to accept.** A single global scheduler with per-seller cut-offs rather than per-zone runs; per-transfer arrival estimates from a learned model, if the label (confirmed vs presumed) is handled; a third-party calendar source, if versions and overrides exist.

**Bottlenecks and failure modes.** End-of-month spikes; rail timeouts and resends; late partner files making metrics wrong; calendars changed at short notice; fee rounding errors at scale; amounts shown in one place and debited in another disagreeing.

**Incident guidance.**
- *Missing holiday*: fix the calendar (new version), recompute affected expected dates, notify the ~40,000 sellers proactively with the corrected date, and add a review step (two sources per country, a yearly audit, alerts when a deposit fails to arrive in bulk at one bank on one day).
- *Partner file two days late*: the metric must distinguish "no status yet" from "late"; suppress seller alerts when a whole rail's status feed is late, alert the operations team on feed freshness instead, and backfill when the file arrives.
- *Sixfold spike, timeouts and doubles*: the doubles mean resends happened without a status query or with a new request id. Stop resends, query the rail by reference for every timed-out transfer, reverse confirmed duplicates with the partner and notify the sellers; then enforce request ids and status-before-resend.
- *Fees rounded down*: compute the undercharge per transfer from stored amounts (cents and count), decide with finance whether to absorb it (usually yes, since the seller saw the fee before confirming), fix the code, and add a test on exact halves and a daily check that recomputes fees from amounts.

**Follow-up guidance.** Ask for the exact fee cents and the rounding line; push on what "arrived" means without confirmation; ask what the seller sees during a timeout.

**Rubric anchors.** 2: holidays hard-coded; floats for money; arrival assumed from send date; resend on timeout. 3: versioned calendars, deterministic deposit ids, status model, integer-cent fee by the rule, query before resend. 4: also confirmed versus presumed arrival metrics feeding the estimates, feed-freshness monitoring, recomputation on calendar changes, and clear incident handling.

**Strong signals.** Treats the arrival date shown as a promise to be measured. **Red flags.** Credit or person-level eligibility logic; "the balance service handles it" for every double-send question; designing a new ledger when the balance service is given.

## BLK-L4-05

**Reference architecture (one defensible design; score others on the criteria).**
- **Contract**: typed reports (`serial, model, firmware, app_version, device_seq, device_ts, battery_pct, charging, rssi, disconnects, read_attempts, read_errors_by_type, uptime`) with a schema registry; no card, customer or free-text fields.
- **Paths**: registers send every {{interval}} directly; readers buffer reports and the paired app uploads them in batches with its own receive time and the reader's serial. The collector stamps server receive time and writes to a log partitioned by serial.
- **Cleaning**: dedup on `(serial, device_seq)`; device times checked against receive time and the batch's upload time (a device time before the factory date or far in the future is flagged and replaced by an estimate from receive time and sequence spacing, keeping both); sequence resets after a power loss detected by uptime and seq.
- **Current state**: a per-device record (last seen by receive time, battery, firmware, connection health, error counts today) updated by a stream consumer within a minute, feeding the seller's page. "Not reporting" is derived from last seen relative to expected cadence (registers) or last app session (readers).
- **Alerts**: rules with minimum durations (battery under 15% for two consecutive reports while not charging), plausibility per model (a model known to report 0% when asleep is ignored in that state), at most one alert per device per condition per day, and a global circuit breaker when an alert type fires for an unusual share of the fleet.
- **Fleet measures**: per device-day aggregates by model, firmware and age band; error rate as mean of per-device daily rates (or reads-weighted with a per-device cap); firmware share among devices seen in the last 7 days; battery health from full-charge capacity trends per device. Cohort comparisons for a new firmware against same-model devices on the previous version over the same days, with confidence intervals and a note on upload delay.
- **Storage and access**: raw kept {{retention_days}} days; daily per-device aggregates kept longer with only serial and model (no seller identifiers beyond location) to answer battery-age questions; raw access per device only for consented support cases, logged.

**Competing designs to accept.** Readers storing longer histories on the device and uploading summaries; a time-series database for the current state instead of a key-value store; reads-weighted error rates if heavy users are capped or reported separately.

**Bottlenecks and failure modes.** Upload delay for readers; clock resets; duplicate uploads; alert storms from model-specific quirks; heavy users dominating rates; retention too short for degradation studies.

**Incident guidance.**
- *Firmware regression invisible for six hours*: report data freshness per model (share of devices reported in the last hour) next to the metric, so silence is not read as health; compare cohorts by event time once uploads arrive; consider a staged install gate that waits for enough reports.
- *200,000 false battery alerts*: hold the queue (circuit breaker on unusual volume), suppress the condition for that model in deep sleep, apologise to sellers already notified, and add plausibility rules per model with a canary for alert volume.
- *Clocks reset to 2000*: detect device time before the factory date, re-time those reports by receive time and sequence, move them to correct partitions, and recompute firmware share for the affected days.
- *Batches re-uploaded at every launch*: dedup on `(serial, device_seq)` makes it harmless; if the counts doubled, dedup was missing or keyed on upload id. Fix and recompute; add a check comparing card reads with payments per seller.

**Follow-up guidance.** Push on the definition of active device, how silence is shown, and whose experience an error rate describes.

**Rubric anchors.** 2: a stream of device-timestamped events summed into dashboards; alerts on every low reading. 3: dedup on serial and sequence, receive-time last-seen, current-state store, debounced alerts with caps. 4: also clock-reset handling, per-device-day measures with cohort confidence and freshness, retention designed for the long questions, least-privilege access, and crisp incident handling.

**Strong signals.** Treats absence as data; designs alerts from the seller's point of view. **Red flags.** Telemetry carrying card or customer data; device positioning; means dominated by a few heavy devices.
