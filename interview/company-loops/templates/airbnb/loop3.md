# Airbnb · Loop 3 — Data Modeling + Low-Level Design

Simulated practice scenarios set in the public product domain of a marketplace
for stays and experiences, with listings, calendars, bookings, pricing, search,
reviews, hosts and guests. Every workload, number, schema, rule and incident is
hypothetical, and nothing here describes how any company's systems are actually
built. Where a scenario names a product rule, it is this exercise's rule, not a
statement of current policy. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## ABB-L3-01: Booking alterations — dates, guests, price differences and who agreed to what

| | |
|---|---|
| **Template ID** | ABB-L3-01 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / reservation versions, alteration requests, price deltas, payment and payout adjustments |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "daily_bookings": {"1": ["200,000"], "2": ["1 million", "2 million"], "3": ["4 million", "6 million"]},
  "alteration_share": ["3%", "7%", "12%"],
  "response_hours": [24, 48, 72],
  "currencies": [30, 60]
}
```

**Business Scenario.** Guests book about {{daily_bookings}} stays a day, and about {{alteration_share}} of reservations are later altered: new dates, a different number of guests, occasionally a different listing from the same host. Either side can propose a change. In this exercise's rules a guest's request must be accepted by the host, a host's proposal must be accepted by the guest, and an unanswered request expires after {{response_hours}} hours; customer support can also apply a change on behalf of either side. Every accepted change is re-priced: the guest pays a difference or is refunded part of what they paid, and the host's payout moves with it. Guests pay in their own currency and hosts are paid in theirs, across {{currencies}} currencies. Support, finance and the host performance team all need to know what was booked, what was changed, by whom, and what each change cost.

**Problem Statement.** Design the data model. Cover: the reservation and how its terms (listing, dates, guest count, price breakdown) are versioned; the alteration request with its lifecycle (proposed, accepted, declined, expired, withdrawn) and who proposed and who responded; the price quote for the proposed terms and the difference against the terms in force; the guest charge or refund and the host payout adjustment that an accepted change creates, and how they stay linked to it; how the calendar is updated when new dates are accepted; and the facts that answer "nights and booking value by stay date after alterations", "alterations by who proposed them and how they ended" and "net revenue change caused by alterations per month".

**Constraints.** A reservation's terms at any past time must be reconstructable, including what both parties saw when they agreed. Money is stored as integers in minor units with its currency; amounts in different currencies are never added without a stated conversion. An accepted alteration and its money movements are either all recorded or none. Booking counts must not grow when a reservation is altered.

**Assumptions.** Volumes, shares, the response window and currency counts are hypothetical. Fee schedules are out of scope: a price quote is an input with line items (nightly total, cleaning fee, service fee, taxes). The reservation id never changes when the reservation is altered.

**Clarifications.**
- Q: Can there be two open alteration requests on one reservation? | A: No. In this exercise one request is open at a time; a new one replaces the old, which becomes withdrawn.
- Q: Does a pending request hold the new nights on the calendar? | A: No. Acceptance re-checks availability and fails if the new nights were booked in the meantime.
- Q: Which exchange rate applies to a price difference? | A: Your choice; state it. Many designs keep the rate locked at booking for the original amount and use the rate at acceptance for the difference.
- Q: Can an alteration happen during the stay? | A: Yes, to shorten or extend it; nights already stayed cannot be removed.
- Q: Does support's change need the other side's acceptance? | A: No, but it records the support agent and the reason, and both parties are notified.

**Hints.**
1. Separate the reservation's identity (one row, stable id) from its terms (immutable versions). An accepted alteration creates a new terms version; it never overwrites the old one.
2. The alteration request points to the version it would replace and to a proposed version with its own price quote. Acceptance is the moment the proposed version becomes current.
3. Money moves for an alteration are their own records (charge, refund, payout adjustment) keyed by the alteration, not edits to the original payment.

**Follow-ups.**
1. A guest shortens a 7-night stay to 4 nights after check-in. Walk through the rows written: versions, request, quote, refund and payout adjustment.
2. The host accepts a date change, but the new nights were booked by another guest a minute earlier. Where does your model stop that, and what is recorded?
3. Finance wants booking value by stay date. A reservation was moved from March to May after March was reported. What changes in each month, and how is it labelled?
4. The guest pays in one currency and the host is paid in another. Show the difference for a one-night extension, with the rates you chose and where they are stored.
5. At {{daily_bookings}} bookings a day, which tables are OLTP and which are facts? How do you keep "reservations as of any date" cheap to query?

**Follow-up rules.**
- when: update the reservation, overwrite, updated_at → ask: The guest disputes a charge and says they agreed to 5 nights, not 6. With the reservation row overwritten, how do you show what they agreed to and when?
- when: new reservation, rebook, cancel and rebook → ask: If an alteration is a cancellation plus a new booking, what happens to booking counts, cancellation rates and the host's performance numbers?
- when: exchange rate, fx, currency → ask: The rate moved between booking and alteration. Which rate applies to the original amount and which to the difference, and where is each recorded?
- when: price difference, delta, refund → ask: An alteration lowers the price but a non-refundable part was already paid. How do you represent the part that is not refunded?
- when: scd, type 2, valid_from → ask: Which timestamp starts a new version: when the request was made, or when it was accepted? What does each choice do to "terms as of yesterday"?

**Production Reality Check.**
- With {{alteration_share}} of reservations altered, a backfill counted each accepted alteration as a new booking. Bookings for the quarter rose by about that share and the host performance team flagged hosts whose guests change plans often as having many cancellations.
- A guest's request was accepted after {{response_hours}} hours had passed: the expiry job ran late, and the acceptance path did not check expiry. The reservation shows new dates that the guest believed had lapsed, and the guest was charged the difference.
- A payment provider timeout left an accepted alteration with new dates on the calendar and no charge for the difference; a retry later charged it twice.

**Evaluation Criteria.** Reservation identity separated from immutable terms versions; alteration requests with a full lifecycle and actors; a quote per proposed version and an explicit difference; money movements as records linked to the alteration, atomic with acceptance; calendar updated only on acceptance with an availability re-check; currency handling stated; facts that keep booking counts stable and attribute value by stay date; each incident contained, corrected and guarded.

## ABB-L3-02: Experiences — templates, scheduled instances, group capacity and private bookings

| | |
|---|---|
| **Template ID** | ABB-L3-02 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / versioned templates, scheduled instances, capacity invariants, local time |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "experiences": {"1": ["20,000"], "2": ["80,000", "150,000"], "3": ["300,000", "500,000"]},
  "max_group": [6, 10, 15],
  "private_share": ["10%", "25%"],
  "min_guests_hours": [24, 48]
}
```

**Business Scenario.** Besides stays, the marketplace sells experiences: a cooking class, a guided walk, a boat trip. There are about {{experiences}} active experiences. A host creates an experience (title, description, duration, what is included, a price per guest and a maximum group size of up to {{max_group}} here) and schedules instances of it at local times in the experience's city, some as one-offs and some from a weekly pattern. Guests book seats on an instance for themselves and companions. A guest can also book an instance privately for their own group at a group price; about {{private_share}} of booked instances are private. In this exercise's rules, an instance that has not reached the host's minimum number of guests {{min_guests_hours}} hours before the start may be cancelled by the host without penalty. Hosts can co-host with others, edit the experience over time and cancel single instances.

**Problem Statement.** Design the data model. Cover: the experience and its versions (which fields may change after guests have booked, and what a booked guest is held to); co-hosts and their roles; schedules and instances, including how a weekly pattern turns into instances and how an edited pattern affects instances already booked; bookings and attendees with the price each guest agreed to; the capacity invariant for shared and private bookings and how it is enforced when two guests book the last seats at once; instance and booking cancellations with who cancelled and why; and the facts that answer "fill rate per instance and per host", "revenue per experience per month in the host's currency" and "cancellations by reason, including minimum not met".

**Constraints.** Booked seats on an instance never exceed its capacity, and a private booking excludes all other bookings for that instance. A guest is held to the description, start time and price that were in force when they booked. Instance times are local to the experience's city and must survive daylight-saving changes. Money is stored in integer minor units with its currency.

**Assumptions.** Volumes, group sizes, shares and the minimum-guest window are hypothetical. A group price for a private booking is set per experience version. A guest's companions may not have accounts; one booking names the booker and a guest count.

**Clarifications.**
- Q: Can a host lower the maximum group size after people have booked? | A: Yes, but only for instances that are not already above the new size; existing bookings are honoured.
- Q: Can a private booking be made on an instance that already has shared bookings? | A: No. An instance is either private (one booking) or shared.
- Q: What happens to booked guests when the host edits the description? | A: Minor edits apply; changes to time, duration, meeting point or price do not apply to existing bookings without the guest's consent.
- Q: Are instance times stored in UTC? | A: Your choice. State how a 10:00 walk stays at 10:00 local time after the clocks change.
- Q: Who counts as the host for reporting? | A: The primary host; co-hosts are tracked separately with their role.

**Hints.**
1. Separate the experience (identity), its versions (content and price), the schedule (a rule) and instances (concrete dated occurrences). Bookings reference an instance and the version they were sold under.
2. Capacity is an invariant on the instance: keep a seats-taken counter updated in the same transaction as the booking, with a check, or lock the instance row; compare it with a sum over bookings in a reconciliation.
3. Store the instance's local date and time with the city's time zone identifier, and derive the UTC instant from them.

**Follow-ups.**
1. Two guests try to book the last 3 seats of an instance at the same moment, one shared and one private. What happens, and which rows are written?
2. A weekly pattern is moved from Saturday to Sunday. What happens to future Saturday instances that already have bookings, and to those without?
3. The host raises the price. Which guests pay the new price, and how does revenue reporting know?
4. Define fill rate precisely: seats or instances, which instances are in the denominator (cancelled, private, minimum not met), and when an instance's number is final.
5. At {{experiences}} experiences with weekly patterns, how far ahead do you create instance rows, and what is computed on demand?

**Follow-up rules.**
- when: seats_available, counter, decrement → ask: Two bookings commit at the same moment for the last seats. Show the statement or lock that keeps the counter from going negative.
- when: utc, timestamp, timestamptz → ask: The clocks go back an hour in the experience's city. Does next Saturday's 10:00 walk still start at 10:00 local time in your model?
- when: private → ask: A private booking is cancelled two days before the instance. Does the instance reopen for shared bookings, and what does your fill rate say about it?
- when: recurring, weekly, schedule → ask: Do you store every future instance or only the pattern? What happens to a booked instance when the pattern changes?
- when: fill rate, utilisation, occupancy → ask: Is a private booking of 2 guests on an instance for {{max_group}} a full instance or a 2-seat one in your metric?

**Production Reality Check.**
- A host lowered the maximum group size to below {{max_group}} while instances were already partly booked. A job that recomputed capacity from the experience's current version marked those instances as over capacity and cancelled the latest bookings automatically.
- After a daylight-saving change, instances generated from weekly patterns in one region started an hour early for two weeks: the pattern had been expanded with a fixed UTC offset.
- About {{private_share}} of booked instances are private, and fill-rate dashboards counted each private booking's guest count against the shared group size, so hosts with many private bookings appeared to run nearly empty instances.

**Evaluation Criteria.** Experience identity, versions, schedules and instances kept apart; bookings tied to the instance and the version they were sold under; a capacity invariant enforced transactionally for shared and private bookings; local time with a time zone identifier; cancellations with actor and reason, including minimum not met; fill rate and revenue defined at stated grains; each incident contained, corrected and guarded.

## ABB-L3-03: Two-sided reviews — hidden until both submit, then published, answered and sometimes removed

| | |
|---|---|
| **Template ID** | ABB-L3-03 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / visibility rules as data, review lifecycle, sub-ratings, aggregate ratings with removals |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "daily_checkouts": {"1": ["150,000"], "2": ["800,000", "1.5 million"], "3": ["3 million", "5 million"]},
  "review_window_days": [10, 14, 21],
  "min_reviews_shown": [3, 5],
  "removal_share": ["0.2%", "1%"]
}
```

**Business Scenario.** After about {{daily_checkouts}} checkouts a day, the guest can review the stay and the host can review the guest. In this exercise's rules, each review stays hidden from the other party until both have submitted or the review window of {{review_window_days}} days after checkout closes, whichever comes first; then both are published together, or the one that exists is published alone. A guest's review has an overall rating and sub-ratings (cleanliness, accuracy, check-in, communication, location, value) plus optional private feedback that only the host sees. The host may post one public response to a published review. Reviews that break the content policy are removed after a report; about {{removal_share}} of reviews are removed this way. A listing shows its average rating only after it has {{min_reviews_shown}} published reviews.

**Problem Statement.** Design the data model. Cover: the review per reservation and author role, with its states (eligible, draft, submitted, published, removed) and the timestamps that drive them; how "hidden until both submit or the window closes" is represented so that no read path can leak a hidden review; sub-ratings and how new categories added later are handled; private feedback and who may read it; responses; reports and removals, with reason and appeal; and the derived listing rating (overall and per sub-rating) with how it changes when a review is published or removed. Include the facts that answer "review rate after checkout, by role", "average rating per listing over time" and "reviews removed by policy reason".

**Constraints.** A hidden review is never visible to the other party, in the product or in any data the other party can query. A published review's text and ratings never change; removal hides it from guests and hosts but keeps it for audit. The listing rating must be reproducible for any past date. Private feedback never appears in public data or in aggregates shown to anyone but the host.

**Assumptions.** Volumes, the window, the display threshold and the removal share are hypothetical. Review text is moderated by a separate service that returns a decision; only the decision and reason are modelled here. Times are stored as instants; the window is measured from checkout in the listing's time zone.

**Clarifications.**
- Q: Can a review be edited after submitting? | A: Not in this exercise. A draft can be edited until it is submitted.
- Q: Does a removed review still count in the listing's rating? | A: No. It is removed from the rating from the time of removal; whether past ratings are restated is your decision, stated.
- Q: Can a host's response be edited? | A: Yes, within a short period after posting; keep the versions.
- Q: When exactly does the window close? | A: At the end of the last day of the window, in the listing's local time, counted from the checkout date.
- Q: Can the guest see that the host has already reviewed them? | A: Yes, that it exists; never what it says or the rating.

**Hints.**
1. Store the review once with submitted_at and a computed published_at (the earlier of "both submitted" and window close); visibility is a rule on published_at, applied in one place.
2. Keep sub-ratings in long form (review, category, score) so a new category does not change the table, and record which categories were asked on that review.
3. Treat the listing rating as a derived, dated series built from publication and removal events, not a counter updated in place.

**Follow-ups.**
1. The host submits on day 2, the guest never does. When and how is the host's review published, and which job or query makes it happen?
2. A new sub-rating category is added. How do averages treat older reviews that never had it?
3. A review is removed 40 days after publication. What happens to the listing rating for last month's report, and to the host's performance numbers?
4. Analysts query reviews in the warehouse. How do you stop a hidden review or private feedback from reaching a dashboard the other party can see?
5. Write the definition of the listing rating shown on a date, with the display threshold of {{min_reviews_shown}} reviews and removals.

**Follow-up rules.**
- when: is_visible, visible flag, boolean → ask: A job sets the flag when both have submitted. The job fails for a day. What does the guest see, and what would derive visibility from timestamps instead?
- when: average, avg, mean rating → ask: A review is removed. Do you recompute the average from published reviews, or subtract from a stored sum? What does each do for a past date?
- when: column per category, cleanliness column, wide table → ask: A new category is added next quarter. What happens to the table, to old rows and to the averages?
- when: private feedback → ask: Which tables hold private feedback, who can query them, and how do you prove it never reaches a public aggregate?
- when: delete → ask: Removal is for policy reasons and may be appealed. What do you delete, what do you keep, and what can an appeal restore?

**Production Reality Check.**
- A pipeline computed window close in UTC instead of the listing's local time. For listings far from UTC, some reviews were published a few hours before the {{review_window_days}}-day window had closed, while the other party was still writing.
- After a large batch of removals, listing pages kept showing the old averages for days: the rating was a cached sum that only ever increased, so removed reviews (normally about {{removal_share}} of all reviews) were never taken out of it.
- A host-facing dashboard computed a weekly average from submitted reviews instead of published ones. For listings below {{min_reviews_shown}} published reviews, where no rating should be shown at all, a host could read a guest's still-hidden rating from the change in the weekly number.

**Evaluation Criteria.** One review per reservation and role with states and timestamps; publication derived from "both submitted or window closed" and enforced in one place; long-form sub-ratings with the categories asked; private feedback isolated with access rules; responses versioned; removals as states with reason and appeal, never deletes; listing rating as a dated derived series with a threshold and a stated restatement rule; each incident contained, corrected and guarded.

## ABB-L3-04: Pricing settings — base, custom dates, weekend and length-of-stay discounts, and the price actually offered

| | |
|---|---|
| **Template ID** | ABB-L3-04 |
| **Loop** | 3 |
| **Kind** | design |
| **Topic** | Data modeling / effective-dated rules, bitemporal settings, quotes as evidence |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, data-architect, analytics-engineer, software-engineer |

```params
{
  "listings": {"2": ["1 million", "3 million"], "3": ["6 million", "8 million"]},
  "setting_changes": ["500,000", "2 million", "5 million"],
  "quotes_per_day": ["200 million", "1 billion"],
  "weekly_discount": ["10%", "15%"]
}
```

**Business Scenario.** Each of about {{listings}} listings has pricing settings that the host changes often (about {{setting_changes}} changes a day across all listings): a base nightly price, an optional different weekend price, custom prices for chosen dates, a cleaning fee, and length-of-stay discounts, for example {{weekly_discount}} off stays of 7 nights or more and a larger discount for 28 nights or more. In this exercise's rules only the largest length-of-stay discount that applies is used, and "weekend" means Friday and Saturday nights in the listing's local time. Search results and listing pages show quotes for dates the guest chose, about {{quotes_per_day}} quotes a day, and the booking charges the quote the guest accepted. Support regularly hears "the price changed between search and checkout", and the pricing team wants to know which settings were in force when a price was offered.

**Problem Statement.** Design the data model. Cover: how settings are stored so that the price of any night can be computed for any past moment (when a setting was in force and for which nights it applies are different times); custom date prices and their precedence over weekend and base prices; length-of-stay discounts and the rule that only one applies; the quote as a record of what was offered (inputs, settings version, line items, currency, expiry); how a booking links to the quote it charged; a materialised nightly price calendar and how it stays consistent with the settings; and the facts that answer "average nightly price offered per market and stay date", "share of bookings that used a length-of-stay discount" and "searches whose quoted total differed from the checkout total, and why".

**Constraints.** For any listing, night and past instant, the price that would have been quoted must be reproducible. A booking's charge equals a stored quote. Settings are never edited in place; a change is a new record. Money is in integer minor units in the listing's currency, and a currency change is itself a dated setting.

**Assumptions.** Listing counts, change and quote volumes, and discount sizes are hypothetical. Taxes and service fees are added after the nightly total and are out of scope except as quote line items. Price suggestions, if a host uses them, arrive as setting changes like any other.

**Clarifications.**
- Q: Which wins when a night has a custom price and is also a weekend night? | A: The custom price. Precedence is custom date price, then weekend price, then base price.
- Q: Is the length-of-stay discount applied per night or to the total? | A: To the nightly total of the stay, before the cleaning fee, in this exercise.
- Q: Do we keep every quote shown in search? | A: Your choice. Say what you keep, for how long, and how you answer a support case about a quote you did not keep.
- Q: Can a host change settings for nights already booked? | A: Yes, but it never changes an existing booking's price.
- Q: Does a quote expire? | A: Yes; your choice of how long, stated. Checkout re-quotes after expiry.

**Hints.**
1. There are two times: when a setting was in force (system time) and which nights it applies to (valid nights). Store both explicitly, so "the price of 12 March as seen on 1 February" is a lookup, not a guess.
2. Keep base, weekend, custom date and discount settings as typed, effective-dated rules; compute a nightly calendar from them for serving, tagged with the settings version it came from.
3. A quote is evidence: store its inputs, the settings version, line items and expiry, and let the booking reference it by id.

**Follow-ups.**
1. Compute the total for a 7-night stay from Thursday that includes one custom-priced night, with the {{weekly_discount}} weekly discount. Which rows did you read?
2. The host changed the weekend price at 14:00; a guest searched at 13:59 and booked at 14:05. What did they see, what were they charged, and how does your model show both?
3. At {{quotes_per_day}} quotes a day, which quotes do you keep in full, which as aggregates, and for how long?
4. A market analyst wants the average nightly price for New Year's Eve as it evolved over the three months before. Which table answers that, and at what cost?
5. The listing's currency changes. What happens to custom date prices already set, to the calendar, and to open quotes?

**Follow-up rules.**
- when: price column, nightly_price column, update price → ask: The host changes the base price. How do you answer "what would this night have cost if booked yesterday"?
- when: bitemporal, system time, valid time → ask: Which of your two times does the search cache key on, and which does a support agent need?
- when: weekend → ask: A listing is twelve hours ahead of UTC. From which value do you compute the weekday of a night, and what goes wrong if it is a UTC timestamp?
- when: discount → ask: Both the weekly and the monthly discount apply to a 30-night stay. Show where your model enforces that only the larger one is used.
- when: cache, materialised, materialized → ask: A setting changes. How quickly does the calendar reflect it, and what does a quote served from the stale calendar say about which version it used?

**Production Reality Check.**
- A release applied the weekly and the monthly discount together for 28-night stays. For a day, long stays were quoted and booked below the host's settings; with discounts like {{weekly_discount}} stacking, some hosts' payouts fell sharply.
- The nightly calendar fell behind the settings by up to an hour during a pre-holiday burst of setting changes, several times the usual {{setting_changes}} a day. Guests saw one total in search and another at checkout, and support could not tell which version each had seen.
- Weekend prices were applied to Saturday and Sunday nights for listings east of UTC: the weekday was computed from a UTC timestamp instead of the night's local date.

**Evaluation Criteria.** Settings as typed, effective-dated, append-only rules with system time and valid nights kept apart; explicit precedence and a single-discount rule; quotes stored as evidence with the settings version and line items, and bookings that reference them; a materialised calendar tagged with its version and reconciled; retention for quotes stated; local-date weekend logic; each incident contained, corrected and guarded.

## ABB-L3-05: Double-booked nights from confirmed reservations and their alterations

| | |
|---|---|
| **Template ID** | ABB-L3-05 |
| **Loop** | 3 |
| **Kind** | sql |
| **Topic** | SQL against a model / half-open date ranges, effective state from alterations, per-night coverage |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |
| **Generator** | ABB-L3-05.mjs |

**Business Scenario.** A stays marketplace takes bookings for listings in {{city_list}}. A reservation covers the nights from `check_in` (inclusive) to `check_out` (exclusive): a guest who checks out on the 5th and a guest who checks in on the 5th share no night. Guests and hosts change bookings through alterations, which the other party accepts or declines; {{alter_rule}} Calendars are synchronised with channel managers and imported calendars, and sometimes two bookings land on the same night anyway. Operations wants the listings where that happened and the size of each problem, so hosts can be contacted before guests arrive.

**Problem Statement.** Write one PostgreSQL query that returns `listing_id, city, overbooked_nights, excess_stay_nights, reservations_involved, first_night`, one row per listing that has at least one overbooked night, ordered by `excess_stay_nights` descending, then `listing_id`. Only reservations whose `status` is `'confirmed'` count. A reservation's stay is the `new_check_in` and `new_check_out` of its accepted alteration with the latest `resolved_at`; if it has no accepted alteration, its stay is its own `check_in` and `check_out`. Declined and pending alterations change nothing. A night is overbooked when more counted stays cover it than the listing has `units`. {{units_rule}} `overbooked_nights` is the number of distinct overbooked nights; `excess_stay_nights` is the sum, over those nights, of the stays covering the night minus `units`; `reservations_involved` is the number of distinct reservations covering at least one overbooked night; `first_night` is the earliest overbooked night.

**Constraints.** One SQL statement (CTEs allowed). Stays are half-open date ranges. The sample has {{listings_n}} listings, {{reservations_n}} reservations and {{alterations_n}} alterations; production has hundreds of millions of reservations, many of them long stays.

**Assumptions.** Hypothetical schema, listings, guests and dates. `check_in` and `check_out` on `reservations` are the dates as first booked and are not updated by alterations. A listing's `units` does not change during the period shown.

**Clarifications.**
- Q: Does a stay checking out on the day another checks in overlap it? | A: No. The check-out date is not a night of the stay.
- Q: Do pending requests or cancelled bookings hold nights? | A: No. Only status 'confirmed' counts.
- Q: A reservation was altered twice and both were accepted. Which dates apply? | A: The accepted alteration with the latest resolved_at.
- Q: Should listings with no overbooked night appear with zeros? | A: No. Only listings with at least one overbooked night.
- Q: Two confirmed reservations have identical dates. Is that one booking? | A: No. They are two reservations and both count; it is the worst kind of double booking.

**Hints.**
1. First build one row per counted reservation with its effective stay: pick the latest accepted alteration per reservation (`DISTINCT ON` or `ROW_NUMBER`) and `COALESCE` it over the original dates.
2. Expand each stay into its nights (`generate_series` over `0 .. check_out - check_in - 1` added to `check_in`), then count stays per listing and night.
3. Keep the overbooked (listing, night) rows, aggregate them per listing, and join back to the nights to count the reservations involved.

**Follow-ups.**
1. Rewrite it without expanding stays into nights: a sweep with +1 at check-in and −1 at check-out (a running sum over a window), then gaps-and-islands for the overbooked ranges.
2. How would PostgreSQL itself have refused the second booking? Describe an exclusion constraint on `daterange(check_in, check_out)`, and why it does not work as written for listings with `units` above 1.
3. For each overbooked night, which reservation should be relocated? Write the query that ranks the stays on a night by `booked_at` and returns those beyond `units`.
4. Production has long monthly stays. How many rows does the night expansion produce per year, and how would you partition and run this daily?

**Follow-up rules.**
- when: between → ask: Does `BETWEEN check_in AND check_out` include the check-out date? What does your query say about a guest leaving on the morning another arrives?
- when: self join, self-join, r1.check_in < r2.check_out → ask: A night is covered by three stays. How many pairs does your self join produce, and what does that do to the night count?
- when: generate_series → ask: Expanding is fine on the sample. A 120-night stay expands into 120 rows; what does that cost at production scale, and what would you do instead?
- when: max(resolved_at), latest alteration, order by requested_at → ask: Is the latest alteration the latest accepted one? Which timestamp decides, and what happens to a pending request made after an accepted one?
- when: units → ask: A listing has 2 units and 3 stays on one night. Which stays are "involved", and how many guests need to be moved?

**Production Reality Check.**
- A dashboard built with `BETWEEN check_in AND check_out` counted every same-day turnover as a double booking, and hosts with back-to-back stays were sent warnings; this report, with half-open stays, showed none for them.
- A host lowered a listing's `units` from 2 to 1 after taking a room off the market. Future nights already holding two confirmed stays became overbooked at once, and nobody was told until this report ran.
- During a slow-network spell a guest pressed Book twice and two confirmed reservations with identical dates were created a second apart. They appear here on the same nights; support wants to know which one to cancel.

**Evaluation Criteria.** Confirmed reservations only; effective stay from the latest accepted alteration with the original dates as fallback; half-open night coverage; overbooked nights against the listing's units; distinct nights, excess and distinct reservations exactly as defined; deterministic ordering; can explain the sweep alternative, an exclusion constraint and its limits, and how to choose which stay to relocate.
