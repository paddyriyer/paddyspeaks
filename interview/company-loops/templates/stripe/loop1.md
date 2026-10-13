# Stripe · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of an online
payments platform: authorizations and captures, refunds, webhooks, idempotent
API requests and card fraud signals. Every workload, number and schema is
hypothetical. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## STR-L1-01: Authorization-to-capture funnel

| | |
|---|---|
| **Template ID** | STR-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / pre-aggregation before joins, cohort attribution, ratios |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 25 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | STR-L1-01.mjs |

**Business Scenario.** Card payments on a payments platform can be authorized first and captured later: the authorization places a hold on the customer's card, the capture moves the money, and a void releases the hold without capturing. Merchants that ship goods before capturing want a daily funnel: of what we authorized, how much did we actually capture, and how much did we void? Amounts are stored as integers in the currency's smallest unit (cents for `usd`, whole yen for `jpy`).

**Problem Statement.** Write one PostgreSQL query that returns, for every `(auth_date, merchant_id, currency)` with at least {{min_auths}} authorizations: `auth_date` (the UTC date of `authorized_at`), `merchant_id`, `currency`, `authorizations` (count), `voided` (authorizations with a void), `captured_auths` (authorizations with at least one successful capture), `authorized_amount`, `captured_amount` (sum of successful captures), `capture_rate_count = ROUND(captured_auths / authorizations, 4)` and `capture_rate_amount = ROUND(captured_amount / authorized_amount, 4)`, both computed in numeric. Order by `auth_date, merchant_id, currency`. {{capture_rule}}

**Constraints.** One SQL statement (CTEs allowed). Never add amounts across currencies: each currency is its own row. The sample has {{n_auths}} authorizations; production has millions per day across many merchants.

**Assumptions.** Hypothetical schema, merchants and amounts. All amounts are integers in minor units and a capture is in its authorization's currency. A void and a successful capture never happen to the same authorization. Authorizations that are neither captured nor voided are still pending and stay in the denominator.

**Clarifications.**
- Q: Which day does a capture belong to? | A: The day of its authorization. The funnel is a cohort of authorizations, so a capture that lands the next day still counts toward the day the authorization was made.
- Q: Do voided authorizations count in the denominator? | A: Yes. A void is one outcome of an authorization; it stays in `authorizations` and `authorized_amount`.
- Q: If one authorization is captured in three parts, how many captured authorizations is that? | A: One. `captured_amount` adds all three parts.
- Q: Should I convert currencies to compare merchants? | A: No. There is no exchange-rate table; report each currency on its own row.
- Q: Is the minimum inclusive? | A: Yes. A group with exactly {{min_auths}} authorizations is reported.

**Hints.**
1. Reduce captures to one row per authorization first (successful captures only), then join that to `authorizations`. Joining raw capture rows repeats the authorization.
2. `COUNT(x)` counts non-null values, so a LEFT JOIN plus `COUNT(captured_amount)` counts captured authorizations directly.
3. Cast before dividing: `count::numeric / count`. Integer division truncates.

**Follow-ups.**
1. The same report at billions of authorizations: which table do you pre-aggregate, at what grain, and how does it stay correct when a capture arrives days later?
2. Finance wants one company-wide capture rate across all currencies. What would you need, and what would you refuse to do?
3. Uncaptured authorizations expire after a period set by the card network. How would you add an "expired" bucket to the funnel without a status column?
4. Some captures exceed the authorized amount for certain payment methods and merchant categories. Which parts of this query assume they never do, and what would you change?

**Follow-up rules.**
- when: join captures, left join captures, join on auth_id → ask: If one authorization has three partial captures, how many rows does your join produce, and what does that do to `authorizations` and `authorized_amount`?
- when: captured_at, capture date → ask: A capture lands the day after its authorization. Which day's row should it change, and why is the funnel a cohort?
- when: sum(amount), total amount, convert → ask: Two currencies in one SUM: what number did you just produce, and who would be misled by it?
- when: count(*), count(distinct → ask: Which of your counts would change if a capture row were duplicated by an upstream retry?

**Evaluation Criteria.** Aggregates captures per authorization before joining (no fan-out); successful captures only; attributes captures to the authorization's day; keeps voids in the denominator; one row per currency; numeric division with ROUND to 4; inclusive minimum; deterministic ordering.

## STR-L1-02: The refund that crossed the cap

| | |
|---|---|
| **Template ID** | STR-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Window functions / running sums, frames and deterministic tie-breaks |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 25 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | STR-L1-02.mjs |

**Business Scenario.** A charge can be refunded in several partial refunds, but the total refunded may never exceed what was captured. An API enforces that limit when a refund is created; the warehouse copy of the data is used to audit it. A risk analyst asks: which charges ended up refunded beyond their cap, and which refund pushed each one over?

**Problem Statement.** Write one PostgreSQL query that returns one row per charge whose cumulative counted refunds exceed its cap: `charge_id`, `merchant_id`, `breach_refund_id` (the first refund, in time order, after which the running total is greater than the cap), `breached_at` (that refund's `created_at`), `refunded_total` (the running total after that refund), `amount_captured` and `excess = refunded_total − amount_captured`. Order by `breached_at, charge_id`. {{status_rule}} {{cap_rule}} {{tie_rule}}

**Constraints.** One SQL statement (CTEs allowed). Strictly greater: a charge refunded to exactly its captured amount is fully refunded, not over. Report only the first breaching refund per charge. The sample has {{n_refunds}} refunds.

**Assumptions.** Hypothetical schema and amounts, all integers in minor units in the charge's currency. The audit data deliberately contains breaches the API would have refused, so the query has something to find.

**Clarifications.**
- Q: Do later refunds that are also over the cap get rows? | A: No. One row per charge: the first refund that took the running total over the cap.
- Q: What is the cap? | A: `amount_captured`. For a partially captured charge that is less than `amount`.
- Q: Which refunds count? | A: Only refunds that moved or committed money: failed and canceled refunds are excluded before you compute the running total.
- Q: What if two refunds on one charge have the same `created_at`? | A: Order by `created_at`, then `refund_id`. The result must be deterministic.
- Q: Is a running total equal to the cap a breach? | A: No. Only strictly greater.

**Hints.**
1. `SUM(amount) OVER (PARTITION BY charge_id ORDER BY created_at, refund_id)` gives the running total after each refund.
2. Filter out failed refunds before the window function, not after: a filtered-out row must not contribute to anyone's running total.
3. Then keep the rows over the cap and take the first per charge (`ROW_NUMBER()` or `DISTINCT ON`).

**Follow-ups.**
1. Your window has `ORDER BY created_at` only. What does the default frame do with two refunds at the same second, and how does the answer change?
2. The API must refuse a refund that would cross the cap, under concurrent requests for the same charge. What does it need: a lock, a conditional update, a ledger? Sketch it.
3. Disputes can also take money back from a charge. How would you extend the cap check so refunds and dispute losses together never exceed the captured amount?
4. The refunds table has billions of rows. How do you make this audit incremental, so a nightly run touches only charges with new refunds?

**Follow-up rules.**
- when: order by created_at), range, default frame → ask: Two refunds on one charge share a `created_at`. What running total does each get under your frame, and which refund do you report?
- when: where status, status = 'succeeded' → ask: Did your status filter run before or after the window function, and what would the other order compute?
- when: amount > , amount >= , charges.amount → ask: Which column is the cap for a charge that was captured only in part?
- when: lag(, self join, correlated → ask: What is the cost of your approach on a charge with 500 small refunds, compared with a single running-sum window?

**Evaluation Criteria.** Running sum per charge with a fully specified order and ROWS frame; status filter before the window; cap is `amount_captured`; strict comparison; exactly one row per breaching charge; deterministic ordering; can explain how the API should prevent the race the audit detects.

## STR-L1-03: Webhook endpoints that keep failing

| | |
|---|---|
| **Template ID** | STR-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Gaps and islands / event-level outcomes from attempt-level logs |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | STR-L1-03.mjs |

**Business Scenario.** A payments platform notifies merchants of events (a payment succeeded, a refund was issued, an invoice was paid) by sending HTTPS POST requests to the webhook endpoints they register. A delivery succeeds when the endpoint answers with a 2xx status; otherwise it is retried for a while. Support wants to contact merchants whose endpoints are in trouble: an endpoint that fails many events in a row is more urgent than one with scattered failures.

**Problem Statement.** Write one PostgreSQL query that returns, for every endpoint whose longest run of consecutive failed events is at least {{min_streak}}: `endpoint_id`, `events` (events for that endpoint), `delivered_events` (events with at least one 2xx attempt), `avg_first_success_s` (average seconds from `created_at` to the first 2xx attempt, over delivered events, `ROUND(…, 1)`), `longest_failure_streak`, and `streak_started_at` (the `created_at` of the first event in that run; if two runs tie, the earlier run). An event has failed if it was never delivered. Events are ordered per endpoint by `created_at, event_id`. Order the result by `longest_failure_streak DESC, endpoint_id`. {{attempt_rule}}

**Constraints.** One SQL statement (CTEs allowed). A success is a status code from 200 to 299 inclusive. The sample has {{n_events}} events.

**Assumptions.** Hypothetical endpoints, event types, retry timings and status codes. Each `webhook_events` row is one event for one endpoint. The retry window has closed for every event in the sample, so "never delivered" is final.

**Clarifications.**
- Q: Is a streak about attempts or events? | A: Events. An event that failed twice and then succeeded is a delivered event and breaks a streak.
- Q: Does a redirect count as delivered? | A: No. Only 2xx counts; redirects are not followed.
- Q: What about an event with no attempts at all? | A: It was never delivered, so it is a failed event and belongs in the streak.
- Q: Latency to which success, if there are several? | A: The first 2xx attempt. A later re-send does not change when the event was first delivered.
- Q: Is the threshold inclusive? | A: Yes. A run of exactly {{min_streak}} qualifies.

**Hints.**
1. Reduce attempts to one row per event first: `MIN(attempted_at) FILTER (WHERE status_code BETWEEN 200 AND 299)`, from a LEFT JOIN so events with no attempts survive.
2. Gaps and islands: `ROW_NUMBER()` over all events minus `ROW_NUMBER()` within the failed events is constant along each run of consecutive failures.
3. Pick each endpoint's longest run with `DISTINCT ON (endpoint_id) … ORDER BY endpoint_id, len DESC, start`.

**Follow-ups.**
1. The same report every five minutes over a stream of attempts. What state do you keep per endpoint so you never rescan history?
2. Retries back off over hours. When is an event's outcome final, and how do you report an endpoint that is failing right now, before its events are final?
3. Support now wants to automatically disable endpoints that fail too much. What signal would you use, and how do you avoid disabling a merchant for one bad deploy?
4. How would you tell an endpoint that is down from one that is slow (timeouts) from one that rejects a single event type?

**Follow-up rules.**
- when: count(*) filter, sum(case, total failures → ask: An endpoint fails 10 events, but never 3 in a row. Does your query flag it, and should it?
- when: join delivery_attempts, inner join → ask: An event the platform never managed to attempt has no rows in `delivery_attempts`. Where does it go in your query?
- when: status_code = 200, < 400, status_code < 300 → ask: Which codes count as success in your query, and what happens to a 204, a 302 and a timeout with no status?
- when: lag(, lead( → ask: How do you get the length and start of each run from LAG alone, and what does that cost compared with the row-number difference?

**Evaluation Criteria.** Event-level outcomes from attempts (any 2xx, first success); LEFT JOIN keeps unattempted events; consecutive runs via gaps and islands with a deterministic order; earliest longest run; latency over delivered events only; inclusive threshold; deterministic result ordering.

## STR-L1-04: Idempotency keys with a 24-hour memory

| | |
|---|---|
| **Template ID** | STR-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Hash maps and queues / expiry in arrival order |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | STR-L1-04.mjs |

**Business Scenario.** Payment APIs let a client send an idempotency key with a POST request so a retry after a network error cannot charge a customer twice. Public API documentation describes the shape: the first request with a key is executed and its result saved; a later request with the same key gets the saved result back; reusing a key with different parameters is an error; and keys can be forgotten after 24 hours. You are writing the decision logic for a replay of the request log.

**Problem Statement.** Implement `idempotency_outcomes(requests, max_keys=None)`. `requests` is a list of `(ts_seconds, key, params_hash)` sorted by `ts_seconds`. Return one string per request: `"execute"` if the key is not live (first use, or its previous life has expired), `"replay"` if the key is live and `params_hash` equals the one stored at first use, or `"conflict"` if the key is live and the parameters differ. A key executed at time `t` is live while `ts < t + 86400`; at exactly `t + 86400` it has expired and behaves as new. Replays and conflicts never extend a key's life or change its stored parameters. {{tie_rule}} {{cap_rule}}

**Constraints.** Up to 200 000 requests; keys and hashes are short strings; timestamps are non-decreasing integers. Expected: O(1) amortised work per request and memory proportional to the live keys.

**Assumptions.** Hypothetical traffic. Real APIs also scope keys to an account and store the full response; here the store records only the first-use time and the parameters hash.

**Clarifications.**
- Q: Is a request exactly 24 hours after first use a replay? | A: No. At exactly 86 400 seconds the key has expired; that request executes and starts a new 24-hour life.
- Q: Does a replay refresh the 24 hours? | A: No. Expiry is measured from first use only.
- Q: After a conflict, which parameters are stored? | A: Still the first request's. A conflict changes nothing.
- Q: Can an expired key come back with different parameters? | A: Yes. It behaves as a brand-new key and executes.

**Hints.**
1. A dict from key to `(first_ts, params_hash)` answers live lookups in O(1).
2. Keys expire in the same order they were first used, because timestamps never go backwards. A FIFO queue of `(first_ts, key)` lets you drop expired keys from the front before each request.
3. Each key enters the queue once per life and leaves once, which is where amortised O(1) comes from.

**Follow-ups.**
1. The store now runs on 30 API servers behind a load balancer. Two retries with the same key arrive at two servers within a millisecond. What makes exactly one of them execute?
2. The first request is still running when its retry arrives. What should the retry get back, and what must the store record while the first request is in flight?
3. Memory: 50 000 requests per second, each with a key, kept for 24 hours. Estimate the store's size and say how you would bound it.
4. The process crashes after charging the card but before saving the result. What does the retry see, and how would you design the write order so this cannot double-charge?

**Follow-up rules.**
- when: redis, database, shared store, cache → ask: The store is unavailable for 30 seconds. Do you reject requests that carry idempotency keys, or execute them without protection, and why?
- when: ttl, expire, expiry → ask: Your store's TTL deletes keys lazily. Which requests near the 24-hour boundary could get a different answer from the one specified?
- when: scan, iterate over, for key in → ask: How many keys are live at once in the timing test, and what does a per-request scan cost?
- when: lock, mutex, setnx, compare-and-set → ask: What happens to a key whose holder dies while holding the lock?

**Evaluation Criteria.** Correct half-open 24-hour life; replays and conflicts do not extend it; expired keys behave as new; amortised O(1) with a justification (queue in first-use order); at the Very Hard level, purges expired keys before applying the cap and evicts the oldest live key. Discusses concurrency and in-flight requests honestly.

## STR-L1-05: Card testing across merchants

| | |
|---|---|
| **Template ID** | STR-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Sliding window / per-key counters of distinct values |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ml-platform-engineer |
| **Generator** | STR-L1-05.mjs |

**Business Scenario.** Card testing is a fraud pattern in which someone with stolen card numbers makes many small attempts to find out which cards work. One signal is velocity: the same card (identified by a fingerprint, not the raw number) attempting payments at many different merchants in a short time, which honest cardholders rarely do. You are writing the batch job that finds the moment each card first crossed a velocity threshold.

**Problem Statement.** Implement `first_flags(events, k, window_s, declined_only=False)`. `events` is a list of `(ts, card_fingerprint, merchant_id, outcome)` sorted by `ts`, with `outcome` either `'approved'` or `'declined'`. Return a dict from card fingerprint to the first timestamp `t` at which that card's counted attempts with timestamps in the closed window `[t − window_s, t]` span at least `k` distinct merchants. Cards that never reach it are absent. {{count_rule}} {{tie_rule}} In the samples, `k = {{k}}` and `window_s = {{window_s}}`.

**Constraints.** Up to 200 000 events; a card can have thousands of attempts inside one window. Expected: O(1) amortised work per event.

**Assumptions.** Hypothetical thresholds and traffic. A real system combines many signals; this one is deliberately simple.

**Clarifications.**
- Q: Is an attempt exactly `window_s` seconds earlier inside the window? | A: Yes. The window is closed: `[t − window_s, t]`.
- Q: Do two attempts at the same merchant count twice? | A: No. Distinct merchants.
- Q: Once a card is flagged, do I keep reporting it? | A: No. Only the first timestamp. You can stop tracking that card.
- Q: When `declined_only` is True, do approved attempts affect anything? | A: No. They are ignored entirely.

**Hints.**
1. Per card, keep a queue of its counted attempts in the window and a dict from merchant to how many of those attempts were at that merchant.
2. When an attempt leaves the window, decrement its merchant's count and delete the merchant only when the count reaches zero. A plain set loses a merchant that still has a later attempt inside.
3. The number of distinct merchants is the size of that dict, so checking the threshold is O(1).

**Follow-ups.**
1. The same detection on a live stream across 40 consumers. How do you partition the events, and what goes wrong if you partition by merchant?
2. Events arrive up to 2 minutes out of order. How would you change the window logic, and what does that do to the "first timestamp"?
3. A fraud ring rotates through thousands of card numbers at one merchant instead. Which other key would you count distinct values for, and how does your state grow?
4. Memory is bounded per card by the window. What happens with 100 million active cards, and what approximate structure would you accept?

**Follow-up rules.**
- when: set(, add(, discard, remove( → ask: A card used merchant A at second 0 and again at second 50, with a 100-second window. At second 101 is A still counted in your structure?
- when: partition by merchant, key by merchant, per merchant → ask: Card testing spreads across merchants. Which consumer sees all of one card's attempts under your partitioning?
- when: sort, rescan, for each event loop → ask: What is the cost per event when a card has 3 000 attempts inside the window?
- when: hyperloglog, bloom, approximate → ask: What false-positive or undercount rate would you accept for blocking a card, and who pays for each kind of error?

**Evaluation Criteria.** Closed window; distinct merchants via counts, not a set; per-card state; first timestamp only; declined-only filter applied before counting; amortised O(1) with a justification; sensible discussion of partitioning and out-of-order events.
