# Airbnb · Loop 3 — evaluator notes (hidden from candidates)

## ABB-L3-01

**Reference architecture (one defensible design; score others on the criteria).**
- **Identity and terms.**
  - `reservations (reservation_id, guest_id, host_id, created_at, current_version_id, status)`: identity only; the id never changes.
  - `reservation_versions (version_id, reservation_id, version_no, listing_id, check_in, check_out, guests, quote_id, effective_at, created_by_alteration_id NULL)`: immutable. Version 1 is the booking; each accepted alteration adds one. "Terms as of T" = the version with the greatest `effective_at` ≤ T, where `effective_at` is the acceptance time (or the support action time).
- **Requests.** `alteration_requests (alteration_id, reservation_id, from_version_id, proposed_listing_id, proposed_check_in, proposed_check_out, proposed_guests, proposed_quote_id, proposed_by guest|host|support, proposer_id, reason, status proposed|accepted|declined|expired|withdrawn, responded_by NULL, responded_at NULL, expires_at)`. One open request per reservation (a partial unique index on reservation_id where status = 'proposed').
- **Quotes.** `price_quotes (quote_id, listing_id, check_in, check_out, guests, currency, nightly_total_minor, cleaning_fee_minor, service_fee_minor, tax_minor, total_minor, settings_version, quoted_at)` plus line items. The difference is stored on the request at acceptance: `delta_guest_minor` (guest currency) and `delta_host_minor` (host currency), with the rates used.
- **Money.** `guest_charges (charge_id, reservation_id, alteration_id NULL, kind original|difference|refund, amount_minor, currency, fx_rate_id, status, idempotency_key)` and `payout_adjustments (adjustment_id, reservation_id, alteration_id, amount_minor, currency, status)`. One rule, stated: the original amount keeps the rate locked at booking; a difference uses the rate at acceptance.
- **Acceptance transaction.** In one database transaction: check the request is still `proposed` and `now() < expires_at`; re-check the calendar for the new nights (the same availability lock or constraint that booking uses); insert the new version; mark the request accepted; insert pending charge/refund and payout adjustment rows (outbox). The payment provider is called after commit with the idempotency key; its result updates the charge row. If the charge ultimately fails, a follow-up state (payment_due) is visible to support, never a silent gap.
- **Facts.**
  - `fct_reservation_version` (one row per version, with valid_from/valid_to): nights, guests, booking value; "booking value by stay date" uses the version in force at the report's as-of time.
  - `fct_alteration` (one row per request): proposer role, outcome, response time, nights delta, value delta in a reporting currency (stated conversion), month accepted.
  - `fct_booking` keeps one row per reservation (counted once at creation); alterations never create bookings.
- **Calendar.** The calendar holds nights for the current version only; acceptance releases the old nights and holds the new ones in the same transaction.

**Competing designs to accept.** Event-sourced reservations (BookingCreated, AlterationProposed, AlterationAccepted…) with versions and facts as projections, if acceptance is checked against the current state. A type 2 dimension on reservations driven by acceptance time. Modelling an alteration as cancel-and-rebook is acceptable only if the candidate keeps the original id and fixes the booking and cancellation metrics explicitly; weak otherwise.

**Bottlenecks and failure modes.** Overwriting the reservation row (lost agreement history, disputes unanswerable); cancel-and-rebook inflating bookings and cancellations; pending requests holding or not re-checking nights (double bookings); money edits instead of new records; adding currencies; payment outside the transaction without idempotency (double charges); expiry enforced only by a batch job.

**Incident guidance.**
- *Backfill counted alterations as new bookings*: the booking fact was built from versions, not reservations. Rebuild bookings at reservation grain for the quarter, restate the dashboards with a note, and reverse the host performance flags that came from the inflated cancellation count; guard with a check that bookings per day = new reservation ids per day, and a test that an altered reservation contributes one booking. The size of the error is about {{alteration_share}} of reservations, which the check would have flagged.
- *Acceptance after expiry*: expiry was a batch status, not a condition on acceptance. Contain by finding accepted requests whose responded_at > expires_at; offer the guest the choice to revert (a new version back to the old terms, with a refund of the difference); fix acceptance to check `now() < expires_at` in the same transaction; keep the job only for notifications. The window here is {{response_hours}} hours.
- *Timeout then double charge*: the charge was not idempotent and its state was not recorded before calling the provider. Refund the duplicate, add an idempotency key per (alteration_id, kind), write the pending charge row in the acceptance transaction and reconcile charges against the provider's records daily; a reservation with a version that has no settled difference is listed for support.

**Follow-up guidance.** (1) Version 2 with 4 nights effective at acceptance; request accepted by the host; quote for the shorter stay; refund for nights not stayed (by this exercise's rules for refundable amounts) and a negative payout adjustment; nights already stayed are untouched. (2) The availability re-check inside the acceptance transaction fails; the request stays proposed or becomes declined with reason "dates unavailable"; nothing else is written. (3) As-of reporting: March loses the value, May gains it, labelled as a restatement after March closed — or March is frozen and the move appears as an adjustment in the month of acceptance; either, if stated. (4) Rate locked at booking for the original, rate at acceptance for the difference, both stored on the rows. (5) Requests, versions and charges are OLTP; facts are versions with valid_from/valid_to partitioned by month of effective_at; an as-of query is a range predicate.

**Rubric anchors.** 2: a reservation row updated in place, alterations as a log of text, or cancel-and-rebook without fixing metrics. 3: immutable versions, requests with lifecycle and actors, quotes and a stored difference, money as linked records, calendar re-check. 4: also atomic acceptance with an outbox and idempotent payments, expiry enforced at acceptance, a stated currency rule, as-of facts that keep booking counts stable, and correct incident handling.

**Strong signals.** Asks what both parties saw when they agreed; distinguishes request time from acceptance time. **Red flags.** Deleting the old terms; editing the original payment amount; booking counts that move with alterations.

## ABB-L3-02

**Reference architecture (one defensible design).**
- **Experience and versions.** `experiences (experience_id, primary_host_id, city_id, time_zone, created_at, status)`; `experience_versions (experience_id, version_no, title, description, duration_min, meeting_point, inclusions, price_per_guest_minor, private_group_price_minor, currency, max_group, min_guests, valid_from)`. Material fields (time, duration, meeting point, price) change only through a new version; existing bookings keep theirs.
- **Co-hosts.** `experience_hosts (experience_id, host_id, role primary|cohost, valid_from, valid_to)`.
- **Schedules and instances.** `schedules (schedule_id, experience_id, rule weekly-day-and-local-time, valid_from_date, valid_to_date)`; `instances (instance_id, experience_id, schedule_id NULL, local_date, local_start_time, time_zone, starts_at_utc derived, capacity, mode open|shared|private, status scheduled|cancelled|completed, cancel_reason NULL, cancelled_by NULL)`. Instances are materialised for a rolling horizon (e.g. 90 days); a changed pattern regenerates only instances with no bookings and flags booked ones for the host to keep or cancel with notice.
- **Bookings.** `bookings (booking_id, instance_id, booker_id, guest_count, kind shared|private, version_no, price_minor, currency, status, booked_at, cancelled_at NULL, cancelled_by NULL, reason NULL)`, `attendees (booking_id, seq, name NULL)`.
- **Capacity invariant.** `instances.seats_taken` updated in the same transaction as the booking with `UPDATE instances SET seats_taken = seats_taken + :n WHERE instance_id = :id AND mode <> 'private' AND seats_taken + :n <= capacity` (zero rows updated = rejected). A private booking requires `seats_taken = 0` and sets `mode = 'private'`; a shared booking sets `mode = 'shared'` when it is the first. A nightly reconciliation compares `seats_taken` with Σ guest_count of active bookings.
- **Time.** Local date and time plus an IANA time zone are the truth; UTC is derived per instance and recomputed if the zone rules change.
- **Facts.** `fct_instance` (one row per instance: capacity, seats sold, mode, status, minimum met), `fct_booking` (price, currency, reporting conversion), `fct_cancellation` (actor guest|host|minimum_not_met|support, reason). Fill rate = seats sold ÷ capacity over completed shared instances; private instances reported separately (count and group size), never in the seat-based rate.

**Competing designs to accept.** Row lock (`SELECT … FOR UPDATE`) on the instance instead of a conditional update. Instances generated on demand from rules and persisted at first booking (lazy), if reporting knows which instances existed. Separate tables for private bookings. A seat-level table (one row per seat) for small groups.

**Bottlenecks and failure modes.** Capacity computed from the current version (retroactive over-capacity); UTC-only start times; check-then-insert races; private and shared bookings on one instance; regenerating a pattern deletes booked instances; fill rate mixing private and shared; revenue summed across currencies.

**Incident guidance.**
- *Capacity lowered, bookings auto-cancelled*: capacity belonged to the instance at the time it was created and booked, not to the current version. Restore the cancelled bookings (notify and apologise), make capacity an instance field changed only for unbooked instances, and add a rule that no automated job cancels guests. Lowering below {{max_group}} affects only new instances.
- *Instances an hour early after a clock change*: the pattern was expanded with a fixed UTC offset. Recompute starts_at_utc from local time and the zone for affected instances, notify booked guests, and add a test that expands a weekly pattern across a daylight-saving transition.
- *Private bookings counted in fill rate*: report private instances separately; recompute fill rate over shared instances; at about {{private_share}} private instances the distortion is large for some hosts, so restate their history and tell them.

**Follow-up guidance.** (1) Both try the conditional update; one wins. If the shared booking wins, the private request fails (seats_taken > 0); if the private wins, the shared fails (mode private). Only the winner's booking row exists. (2) Unbooked Saturday instances are cancelled or deleted (never existed for guests); booked ones remain until the host cancels with notice, recorded as host cancellations with reason "schedule change". (3) The version at booking holds the price; revenue uses the booking's price and currency. (4) Seats sold ÷ capacity for completed shared instances; cancelled instances counted separately; final after the instance date. (5) Materialise a rolling horizon; beyond it compute from rules; at {{experiences}} experiences this keeps instance rows bounded.

**Rubric anchors.** 2: one experiences table with a schedule text field and bookings counted without a transactional check. 3: versions, instances, bookings with version and price, a transactional capacity invariant, local time with a zone. 4: also private/shared exclusivity, pattern changes that respect booked instances, metric definitions that separate private bookings, and correct incident handling.

**Strong signals.** States the capacity invariant as SQL; asks how a pattern change treats booked instances. **Red flags.** Storing only UTC; `SELECT COUNT(*)` then `INSERT` without a lock; editing the price of existing bookings.

## ABB-L3-03

**Reference architecture (one defensible design).**
- **Reviews.** `reviews (review_id, reservation_id, author_role guest|host, author_id, subject_id, eligible_at (checkout), window_closes_at (end of day checkout + {{review_window_days}} days in the listing's zone, as an instant), submitted_at NULL, published_at NULL, status eligible|draft|submitted|published|removed, overall_rating NULL, public_text NULL)`; unique (reservation_id, author_role).
- **Publication rule.** `published_at = LEAST(window_closes_at, GREATEST(guest.submitted_at, host.submitted_at))` when both are submitted, else `window_closes_at` for the one that exists. A small job writes `published_at`, but every read path also filters `published_at <= now()` computed from the timestamps (view or row-level policy), so a late job delays nothing and an early job cannot leak.
- **Sub-ratings.** `review_subratings (review_id, category, score)` and `review_categories_asked (review_id, category)`; averages per category use only reviews that were asked that category.
- **Private feedback.** `private_feedback (review_id, text)` in a separate table with access limited to the subject host's own views; excluded from the warehouse's analyst tables or kept in a restricted schema.
- **Responses.** `review_responses (response_id, review_id, version, text, posted_at)`.
- **Reports and removals.** `review_reports (report_id, review_id, reporter, reason, at)`, `review_moderation (review_id, decision removed|kept|restored, policy_reason, decided_at, appeal_of NULL)`. Removal sets status removed; text is retained for audit with restricted access.
- **Listing rating.** A dated series `fct_listing_rating_daily (listing_id, date, published_count, rating_sum, per-category sums and counts)` built from publication and removal events; the shown rating on date D = sum ÷ count of reviews published ≤ D and not removed ≤ D, shown only when count ≥ {{min_reviews_shown}}. Restatement rule stated: past dates either reflect what was shown (removal not back-dated) or are restated (removal back-dated) — pick one and label it.
- **Facts.** `fct_review` (one row per review: role, eligible, submitted, published, removed, days to submit), review rate by role = submitted ÷ eligible per checkout cohort, final after the window.

**Competing designs to accept.** A single table with nullable guest and host halves per reservation (works if the visibility rule is still timestamp-derived). An event log of review state changes with projections. A materialised `visible_reviews` table refreshed frequently, if leaks are impossible by construction (only published rows copied).

**Bottlenecks and failure modes.** A visibility boolean set by a job (late or early publication); window computed in UTC; sub-ratings as columns; averages kept as running sums that cannot subtract; private feedback in analyst-visible tables; deletes on removal; small-count averages leaking hidden information.

**Incident guidance.**
- *Early publication from UTC window close*: hold publication for affected reviews not yet seen (if any), apologise to affected parties, fix `window_closes_at` to use the listing's zone, and add a test across zones and a check that no review is published before both submitted or `window_closes_at`. The window here is {{review_window_days}} days.
- *Stale averages after removals*: the cached sum never decreased. Recompute ratings from published, non-removed reviews; make removal an event that updates the series; add a daily reconciliation of cached ratings against a recomputation. Removals run at about {{removal_share}} of reviews, so drift grows steadily without it.
- *Hidden rating inferable from a dashboard*: the dashboard read submitted rather than published reviews. Withdraw it, rebuild it from the published view only, apply the same {{min_reviews_shown}} threshold to every host-facing aggregate, and add a test that unpublished reviews never reach host-facing tables.

**Follow-up guidance.** (1) The host's review publishes at `window_closes_at`; the read-path predicate makes it visible even if the job is late. (2) Averages per category over reviews that were asked; report the count with each average. (3) Choose and state: the shown-history is kept (removal from its date) or restated; host performance uses the same rule. (4) Analysts get the published view only; private feedback in a restricted schema; a CI test greps for joins to it. (5) Definition with the threshold, published ≤ D, removed > D or never.

**Rubric anchors.** 2: a boolean visibility flag, sub-rating columns, a running average. 3: timestamps that derive publication, long-form sub-ratings, private feedback isolated, removals as states, a derived rating. 4: also a read-path guarantee against leaks, zone-correct windows, a dated rating series with a restatement rule and threshold, and correct incident handling.

**Strong signals.** Treats "hidden" as a security property of every read path, not a UI rule. **Red flags.** Deleting removed reviews; private feedback in general analyst tables; averages without counts.

## ABB-L3-04

**Reference architecture (one defensible design).**
- **Settings as rules (append-only, bitemporal).** `price_rules (rule_id, listing_id, kind base|weekend|custom_date|cleaning_fee|los_discount|currency, nights_from DATE NULL, nights_to DATE NULL, min_nights NULL, amount_minor NULL, percent NULL, currency, recorded_at, superseded_at NULL, changed_by)`. `recorded_at`/`superseded_at` is system time (when the setting was in force); `nights_from`/`nights_to` (half-open) is which nights it applies to. A change supersedes the old rule and inserts a new one; nothing is updated except `superseded_at`.
- **Price function.** For night N as of time T: rules in force at T (`recorded_at ≤ T < superseded_at`), precedence custom_date ⟶ weekend (Friday or Saturday by the night's local date) ⟶ base. Stay total = Σ nightly prices × (1 − largest applicable length-of-stay percent) + cleaning fee. Implemented once in the pricing service and replayed for audits.
- **Settings version.** A per-listing monotonically increasing `settings_version` bumped on every change; quotes and calendar rows carry it.
- **Nightly calendar (serving).** `listing_night_price (listing_id, night, price_minor, currency, settings_version, computed_at)` for the next 365 nights, recomputed for the affected nights on each change (event-driven), with a sweeper that compares the stored version with the listing's current version.
- **Quotes.** `quotes (quote_id, listing_id, check_in, check_out, guests, settings_version, nightly_breakdown, discount_kind, discount_minor, cleaning_fee_minor, fees_minor, taxes_minor, total_minor, currency, quoted_at, expires_at, surface search|listing|checkout)`. Checkout quotes kept in full forever (they are evidence for bookings); search quotes sampled or kept in full for a short period (e.g. 30 days) and aggregated after. `bookings.quote_id` references the checkout quote.
- **Facts.** `fct_quote_daily` (market, stay date, surface, avg nightly price, count), `fct_booking_price` (discount kind, discount amount), `fct_price_mismatch` (search quote vs checkout quote for the same session: total difference and reason — settings changed, quote expired, guests or dates changed).

**Competing designs to accept.** SCD type 2 per setting type in separate tables. Snapshotting the full settings document per change (JSON) with a version id, if the price function reads it. A calendar-only design where hosts edit nightly prices directly, if each nightly price change is append-only and quotes carry the version.

**Bottlenecks and failure modes.** A price column overwritten (history lost); confusing system time with valid nights; weekend computed from UTC; discount stacking; the serving calendar drifting from settings with no version to detect it; storing every search quote forever at {{quotes_per_day}} a day; currency changes that rewrite old amounts.

**Incident guidance.**
- *Weekly and monthly discounts stacked*: the precedence rule lived in code without a test. Contain by fixing the function and re-quoting open quotes; for bookings made in the window, decide with policy who absorbs the difference (in most designs the platform tops up host payouts rather than charging guests more); add a property test that at most one length-of-stay discount applies and a monitor on the share of quotes with two discounts. With discounts like {{weekly_discount}}, the affected bookings are easy to find from quotes' `discount_kind`.
- *Calendar an hour behind*: quotes carry `settings_version`, so the mismatch is measurable: compare each quote's version with the version in force at quoted_at. Scale the recompute workers for bursts above the usual {{setting_changes}} a day, alert on calendar version lag, and at checkout always recompute from rules, never from the calendar.
- *Weekend applied to the wrong nights east of UTC*: the weekday came from a UTC timestamp. Compute it from the night's date in the listing's zone; re-quote open quotes; identify bookings made in the window from their stored breakdown and correct per policy; add tests with listings far east and west of UTC.

**Follow-up guidance.** (1) Seven nights Thu→Thu: Friday and Saturday at the weekend price unless one is custom; the custom night at its price; {{weekly_discount}} off the nightly total; then the cleaning fee. Reads: rules in force at quote time for that listing. (2) Search at 13:59 used version v; booking at 14:05 re-quoted under v+1; both quotes stored; the mismatch fact records "settings changed". (3) Checkout quotes forever; search quotes in full for a short period, then aggregates. (4) Average offered price for 31 December by quote date: from `fct_quote_daily` (or by replaying rules at past times on a sample). (5) A currency change is a dated rule; custom prices are re-expressed or cleared by stated policy; open quotes expire; history stays in the old currency.

**Rubric anchors.** 2: a listing table with price columns updated in place. 3: effective-dated append-only rules, a precedence order, quotes stored with a version and referenced by bookings. 4: also both times kept apart (bitemporal), a materialised calendar reconciled by version, a quote retention plan, local-date weekend logic, and correct incident handling.

**Strong signals.** Separates "when the setting was in force" from "which nights it applies to" unprompted; treats quotes as evidence. **Red flags.** Recomputing a past booking's price from current settings; summing currencies; no version on quotes.

## ABB-L3-05

**Reference solution** (PostgreSQL)

```sql reference
WITH latest_accepted AS (                     -- per reservation, the accepted alteration resolved last
  SELECT DISTINCT ON (reservation_id) reservation_id, new_check_in, new_check_out
  FROM reservation_alterations
  WHERE status = 'accepted'
  ORDER BY reservation_id, resolved_at DESC
), stays AS (
  SELECT r.reservation_id, r.listing_id,
         COALESCE(a.new_check_in,  r.check_in)  AS check_in,
         COALESCE(a.new_check_out, r.check_out) AS check_out
  FROM reservations r
  LEFT JOIN latest_accepted a ON a.reservation_id = r.reservation_id
  WHERE r.status = 'confirmed'
), nights AS (                                -- half-open: check_in <= night < check_out
  SELECT s.listing_id, s.reservation_id, s.check_in + k AS night
  FROM stays s
  CROSS JOIN LATERAL generate_series(0, s.check_out - s.check_in - 1) AS k
), overbooked AS (
  SELECT n.listing_id, n.night, COUNT(*) - l.units AS excess
  FROM nights n
  JOIN listings l ON l.listing_id = n.listing_id
  GROUP BY n.listing_id, n.night, l.units
  HAVING COUNT(*) > l.units
), involved AS (
  SELECT n.listing_id, COUNT(DISTINCT n.reservation_id) AS reservations_involved
  FROM nights n
  JOIN overbooked o ON o.listing_id = n.listing_id AND o.night = n.night
  GROUP BY n.listing_id
)
SELECT l.listing_id,
       l.city,
       COUNT(*)      AS overbooked_nights,
       SUM(o.excess) AS excess_stay_nights,
       i.reservations_involved,
       MIN(o.night)  AS first_night
FROM overbooked o
JOIN listings l ON l.listing_id = o.listing_id
JOIN involved i ON i.listing_id = o.listing_id
GROUP BY l.listing_id, l.city, i.reservations_involved
ORDER BY excess_stay_nights DESC, l.listing_id;
```

**Explanation.** The effective stay comes first: one accepted alteration per reservation (the one resolved last) laid over the originally booked dates with `COALESCE`, and only for confirmed reservations. Each stay is expanded into its nights with the half-open rule (`check_in + 0 … check_out − check_in − 1`), so a check-out date is never a night. Counting stays per (listing, night) and keeping the counts above the listing's units gives the overbooked nights and their excess; the reservations involved are found by joining the nights back to those overbooked nights, with `COUNT(DISTINCT …)` because a reservation usually covers several of them.

**Complexity.** Linear in the number of stay-nights (Σ nights per counted reservation) plus one hash aggregate per step; the alteration pick is a sort or hash over accepted alterations. At production scale the expansion is the cost: a sweep over check-in/check-out boundaries (a running sum of +1/−1 ordered by date per listing) is linear in the number of reservations instead of nights.

**Dialect notes.** `DISTINCT ON` is PostgreSQL; Snowflake, BigQuery and Spark SQL use `QUALIFY ROW_NUMBER() OVER (PARTITION BY reservation_id ORDER BY resolved_at DESC) = 1` (Spark without QUALIFY: a subquery on the row number); MySQL 8 uses the row-number subquery. `date + integer` is PostgreSQL: Snowflake uses `DATEADD(day, k, check_in)` and `DATEDIFF(day, check_in, check_out)`, BigQuery `DATE_ADD(check_in, INTERVAL k DAY)` with `UNNEST(GENERATE_DATE_ARRAY(check_in, DATE_SUB(check_out, INTERVAL 1 DAY)))`, Spark SQL `explode(sequence(check_in, date_sub(check_out, 1)))`. Snowflake has no set-returning `generate_series` in a lateral join; join to a calendar table or use `TABLE(FLATTEN(ARRAY_GENERATE_RANGE(0, n)))`. None of these variants is executed here.

**Edge cases built into the data.** Back-to-back stays (check-out equals the next check-in: no overlap); cancelled, declined and (Hard+) pending reservations placed on booked nights; three stays on one night; a stay nested inside another; two confirmed reservations with identical dates; an accepted alteration that moves a stay onto booked nights; a listing whose only conflict was resolved by an accepted alteration, and which also has a declined alteration that would have caused one (it must not appear). Hard adds several alterations per reservation (the latest accepted wins, including a case where an earlier accepted move was onto booked nights and a later one moved away, and the reverse), pending alterations after an accepted one, and one-night accepted shifts of ordinary stays. Very Hard adds listings with 2 or 3 units, where ordinary overlaps within the unit count are not overbooked and one night carries units + 1 stays.

**Common mistakes.** `BETWEEN check_in AND check_out` (closed range: every turnover becomes a conflict); counting non-confirmed reservations; ignoring alterations; applying the latest alteration whatever its status; a self join that counts nights once per pair; counting every reservation of the listing as involved; (Hard+) taking the first accepted alteration; (Very Hard) comparing against 1 instead of `units`. Each has a diagnostic. Ordering only by `listing_id` returns the right rows in the wrong order.

**Follow-up guidance.** (1) Events (+1 at check_in, −1 at check_out) per listing, `SUM(delta) OVER (PARTITION BY listing_id ORDER BY day)` gives occupancy from each boundary to the next; ranges where it exceeds units are the overbooked islands, and their lengths sum to the nights. (2) `EXCLUDE USING gist (listing_id WITH =, daterange(check_in, check_out) WITH &&) WHERE (status = 'confirmed')` with the `btree_gist` extension: `daterange` is half-open by default, so back-to-back stays pass. It cannot express "at most `units` overlaps"; multi-unit listings need a unit assignment per reservation (then the constraint applies per unit) or a per-night inventory row with a checked counter. (3) `ROW_NUMBER() OVER (PARTITION BY listing_id, night ORDER BY booked_at)` over the nights; rows with a number above units are the stays to relocate (a stay is relocated if it is beyond units on any night). (4) Nights per year ≈ reservations × average stay length; partition by listing hash or by check-in month, run on future stays only, or switch to the sweep.

**Rubric anchors.** 2: right shape but a closed range, or alterations ignored, or nights counted per pair. 3: matches the expected result. 4: also explains the sweep, the exclusion constraint and why it fails for multi-unit listings, and the relocation ranking.

**Strong signals.** Asks which dates are authoritative after an alteration before writing SQL; states half-open ranges explicitly. **Red flags.** `BETWEEN` for stays; `MAX(new_check_in)` as "the latest alteration"; `SELECT DISTINCT` to hide row multiplication from a join.
