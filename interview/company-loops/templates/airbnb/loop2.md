# Airbnb · Loop 2 — Advanced DSA + Core Data Engineering

Simulated practice scenarios set in the public product domain of a marketplace for
stays and experiences: listings, host calendars, bookings, pricing, search, payouts,
cancellations and refunds. Every workload, number, rule, schema and incident is
hypothetical, and cancellation, payout and fee rules are this exercise's own, not a
statement of any current policy. Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## ABB-L2-01: Split stays — two listings, one move, every pair that covers the trip

| | |
|---|---|
| **Template ID** | ABB-L2-01 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Interval reasoning / free-run arrays, counting intersecting intervals with binary search |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 40 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer |
| **Generator** | ABB-L2-01.mjs |

**Business Scenario.** A guest searches for a week in a busy town, and no single listing is free for every night. A stays marketplace can still offer a split stay: the guest stays in one listing for the first part of the trip, moves once, and stays in a second listing for the rest. Before the search page decides whether to show a split-stay section, it needs to know how many pairs of listings could host each searched date range. The calculation runs for every search, over every listing in the map area, so it has to be fast.

**Problem Statement.** Implement `split_stays(calendars, queries, min_nights=None, capacity=None, exclude_whole=False)`. `calendars` maps a listing id to a string with one character per night of a shared horizon: `'.'` is free, `'b'` is booked and `'x'` is blocked by the host. Only `'.'` is free. Each query is `(check_in, check_out, guests)` and asks for nights `check_in` to `check_out − 1`, with `0 ≤ check_in < check_out ≤` the horizon. A split stay is an ordered pair `(first, second)` of two different listings and a move night `k`, with `check_in < k < check_out`, such that `first` is free on nights `check_in … k − 1` and `second` is free on nights `k … check_out − 1`. For each query, return the number of ordered pairs for which at least one move night works; a pair counts once, however many move nights work for it. A one-night query has no move night, so it returns 0. {{min_rule}} {{whole_rule}}

**Constraints.** Up to 3 000 listings, a horizon of 180 nights and 200 queries per call, with stays of up to a few weeks. Something close to O(n · h) preparation and O(n log n) per query is expected, for n listings and a horizon of h nights. Trying every pair is 9 million pairs per query, which is far too slow.

**Assumptions.** Listings, calendars and searches are hypothetical. Every calendar has the same length. The guest moves exactly once, and the move happens on the morning of night `k`: the first listing's check-out day is the second listing's check-in day.

**Clarifications.**
- Q: Is `(A, B)` the same pair as `(B, A)`? | A: No. The guest starts in the first listing, so order matters, and both can count.
- Q: If a pair works with three different move nights, does it count three times? | A: No. It counts once.
- Q: Does the check-out night have to be free? | A: No. The stay is nights `check_in` to `check_out − 1`. The move night `k` is the first night in the second listing.
- Q: Is a host-blocked night different from a booked one here? | A: No. Both are unavailable; only `'.'` is free.
- Q: Can one listing be both halves? | A: No. That would not be a move.
- Q: Can a query be invalid? | A: No. Every query satisfies `0 ≤ check_in < check_out ≤` the horizon. A one-night query returns 0.

**Hints.**
1. For one query, the first listing matters only through how many nights in a row it is free starting at `check_in`. The second listing matters only through how many nights in a row it is free ending at `check_out − 1`.
2. Precompute, per listing, the length of the free run that starts at each night and the one that ends just before each night. Then each listing gives an interval of move nights it accepts as the first half, and another interval as the second half.
3. Pairs whose intervals intersect are all pairs minus the disjoint ones. Sorted endpoints and binary search count the disjoint ones in O(n log n). Then remove each listing that would pair with itself.

**Follow-ups.**
1. The page wants the 20 cheapest split stays, where the price is the first listing's nightly price times its nights plus the second's. For one pair the best move night is at an end of its interval. How would you find the 20 cheapest without enumerating all pairs?
2. Guests prefer two listings close to each other. Add a maximum distance between the halves. What changes in your counting, and what index would you add?
3. Calendars change thousands of times a minute. What do you keep precomputed, and what do you update when one night is booked?
4. Allow two moves, so three listings. How does the counting change, and how fast does the number of combinations grow?

**Follow-up rules.**
- when: itertools.product, every pair, all pairs, nested loop → ask: How many pairs is that for 3 000 listings, and how many searches a second could one machine serve with it?
- when: bisect, binary search, sorted → ask: Which endpoints did you sort, and how do you make sure a listing is never counted as a pair with itself?
- when: min_nights, minimum stay → ask: With minimum stays, is the latest possible move night always the one to try? Give a pair where it fails and an earlier move night works.
- when: prefix, suffix, free run → ask: A listing is free for 40 nights from check-in on a 6-night search. What do you store for it, and how does exclude_whole treat it?
- when: cache, memo, precompute → ask: Your precomputed runs go stale when one night is booked. Which entries change, and how many?

**Evaluation Criteria.** Correct counts with ordered pairs counted once each; one-night queries return 0; booked and blocked nights both unavailable; free-run arrays in each direction; each listing reduced to an interval of acceptable move nights per role; intersecting intervals counted as all pairs minus disjoint ones, minus self-pairs; minimum stays applied to both halves and capacity to both listings (Hard); whole-stay hosts removed per query (Very Hard); a clear complexity argument; sensible answers on cheapest pairs, distance and incremental updates.

## ABB-L2-02: Forward occupancy curve for every listing and date

| | |
|---|---|
| **Template ID** | ABB-L2-02 |
| **Loop** | 2 |
| **Kind** | python |
| **Topic** | Prefix sums / difference arrays, sliding windows over calendars |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, software-engineer |
| **Generator** | ABB-L2-02.mjs |

**Business Scenario.** Hosts and pricing tools look at a forward occupancy curve: for each date, how much of the following weeks is already booked. A curve that is high in three weeks' time but low next week tells a host where a price change or a shorter minimum stay might help. The curve is computed from a calendar snapshot for every listing in a market, for every date in a reporting range, and it is recomputed often.

**Problem Statement.** Implement `forward_occupancy(listings, bookings, start, end, window=30, blocked=None)`. Days are integers (day numbers from a fixed epoch). `bookings` is a list of `(listing_id, check_in, check_out, status)` and covers nights `check_in` to `check_out − 1`. For every listing in `listings` and every date `t` from `start` to `end − 1`, compute the share of nights `t … t + window − 1` that are booked: booked nights divided by available nights in that window, rounded with `round(x, 4)`. Return a dict from each listing id in `listings` to its list of `end − start` shares, in date order. Bookings for a listing that is not in `listings` are ignored. {{block_rule}} {{status_rule}}

**Constraints.** Up to 2 500 listings, 420 dates, a window of up to 150 nights and a few hundred thousand bookings. `start < end`. Bookings are not sorted, and they can start before `start` or end after the last window. Something close to O(B + n · (D + w)) is expected, for B bookings, n listings, D dates and a window of w nights. Rescanning each window night by night is about 160 million checks at the largest size, which is too slow.

**Assumptions.** Listings, bookings, blocks and day numbers are hypothetical. Every listing is active for the whole range. The curve uses one calendar snapshot; when each booking was made does not matter here.

**Clarifications.**
- Q: Does the window include date `t` itself? | A: Yes. It is nights `t` to `t + window − 1`.
- Q: Is the check-out day a booked night? | A: No. A booking covers `check_in` to `check_out − 1`, so the next guest can check in that day.
- Q: What if the window runs past every booking? | A: Those nights are not booked. They still count as available unless they are blocked.
- Q: Should the output be in the order of `listings`? | A: The result is a dict, so key order does not matter. Each list must be in date order.
- Q: Can a booking have `check_out <= check_in`? | A: No. Every booking has at least one night.

**Hints.**
1. Add +1 at a booking's check-in and −1 at its check-out on a per-listing array. A running sum then says whether each night is booked.
2. Only nights from `start` to `end − 2 + window` matter. Clamp every booking and block to that range.
3. With prefix sums of booked nights and of unavailable nights, every window is two subtractions.
4. When bookings can overlap, it is whether the running count is above zero, not the count itself, that marks a booked night.

**Follow-ups.**
1. Hosts want the curve as it looked on each past date, using only bookings made by then, to compare their booking pace with last year's. What extra data do you need, and how does the algorithm change?
2. The curve is needed nightly for millions of listings in a warehouse. Write the idea in SQL or Spark: a nights table with window functions, or an exploded range joined to a date spine. What does each cost?
3. A market-level curve is wanted. Is it the average of the listings' shares, or total booked nights over total available nights? Which one would a pricing tool want, and why do they differ?
4. One new booking arrives. Which dates' values change, for which listings, and how would you update only those?

**Follow-up rules.**
- when: for night in range, nested loop, rescan → ask: How many night checks is that for 2 500 listings, 420 dates and a 150-night window?
- when: cumsum, prefix, accumulate, difference array → ask: Two confirmed bookings overlap after a sync problem. What does your running sum hold on those nights, and what do you store in the prefix array?
- when: set(, set of nights, set of booked → ask: A set of every booked night is fine for lookups. Do you still rescan each window, and what does that cost at the largest size?
- when: None, divide by zero, zero division → ask: What does 0 tell a host that None does not, and how should a market average treat a listing whose value is None?
- when: pandas, numpy, rolling → ask: Your rolling sum needs every night present. How do you build the nightly series from bookings without a row per night per listing?

**Evaluation Criteria.** Correct shares with half-open bookings and windows that start on `t`; bookings clamped to the range; unknown listings ignored; a listing with no bookings reported as 0, not missing; blocked nights removed from the denominator only when they are not booked, and None when nothing is available (Hard); cancelled bookings ignored and overlapping nights counted once (Very Hard); difference arrays and prefix sums with a clear O(B + n · (D + w)) argument; sensible answers on as-of curves, warehouse formulations and market aggregation.

## ABB-L2-03: Debug the host payout calculator

| | |
|---|---|
| **Template ID** | ABB-L2-03 |
| **Loop** | 2 |
| **Kind** | debug |
| **Topic** | Money arithmetic / rounding modes, payout schedules, partial refunds, aggregation keys |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer |
| **Generator** | ABB-L2-03.mjs |

**Business Scenario.** A stays marketplace pays hosts after their guests check in. In this exercise, a short stay is paid in one payout the day after check-in, and a stay of 28 nights or more is paid month by month. A guest who leaves a stay early may be refunded some nights after a cancellation. The marketplace keeps a host service fee of {{fee_pct}} of each payout. Host support has collected complaints about one calculator. Two hosts whose guests checked in on the same day say one of them received both payouts and the other nothing. Some payouts are a cent short. A long-stay host's first monthly payout was too small after a guest left early, and the next one too large. Hosts lose their cleaning fee after a partial refund. Hosts with 60-night stays see a transfer of $0.00 a month after their last real payout. The calculator below is the suspect.

**Problem Statement.** Fix `host_payouts(bookings, fee_bps)` so that it meets this specification. Here `fee_bps` is {{fee_bps}}. {{replay_rule}}
1. **Bookings.** Each booking is `{"id", "host", "check_in", "nights", "rate", "cleaning", "refund_nights"}`. Days are integer day numbers. `rate` (per night) and `cleaning` are integer cents. `refund_nights` is between 0 and `nights`.
2. **Refunds.** The refunded nights are the **last** `refund_nights` nights of the stay, and the host is not paid for them. If every night is refunded, the cleaning fee is refunded too and the booking has no payout at all. Otherwise the host keeps the cleaning fee.
3. **Schedule.** A stay of fewer than 28 booked nights has one payout on day `check_in + 1`, covering every paid night and the cleaning fee. A stay of 28 booked nights or more is paid monthly: night `i` of the stay (counting from 0) belongs to period `i // 30`, and period `p` is paid on day `check_in + 30·p + 1`. The cleaning fee belongs to period 0. A period with no paid night has no payout. Whether a stay is monthly depends on its booked nights, not on its paid nights.
4. **Fee.** A payout's gross is its paid nights times `rate`, plus the cleaning fee when it is in that payout. The host fee is `gross × fee_bps / 10000`, rounded to the nearest cent with exact halves rounded up, computed for each payout separately. The payout amount is gross minus fee.
5. **Transfers.** All payouts to the same host on the same day are added into one transfer. Return a list of `[day, host, amount]`, sorted by day and then by host. A transfer of 0 never appears.

**Constraints.** Keep the function's shape and output format. Up to 100 000 bookings, processed in linear time. Use integer arithmetic for money.

**Assumptions.** These schedule, fee and refund rules are this exercise's own and are simplified; real payout timing, fees and refund terms vary by product, country and policy, so check current docs. All amounts and ids are hypothetical. Taxes, currencies and payout methods are out of scope.

**Clarifications.**
- Q: Which nights are refunded, the first or the last? | A: The last ones. The guest left early.
- Q: Is a 40-night stay with 15 nights refunded still monthly? | A: Yes. The schedule depends on booked nights.
- Q: What is half a cent of fee? | A: It rounds up: a fee of 4.5 cents is 5 cents, and so is 5.5 cents rounded to 6.
- Q: Can a transfer be 0? | A: No. A period with no paid night has no payout, and a fully refunded stay has none.
- Q: How many bugs are there? | A: Several, of different kinds. Each check points at one of them.

**Hints.**
1. Trace a 60-night stay with no refund. How many periods does the loop create, and what does the last one pay?
2. What does Python's `round(4.5)` return? And `round(5.5)`?
3. Draw nights 0 to 39 of a stay with 5 nights refunded. Which nights does `paid_here` count in each period?
4. Look at the key of the `transfers` dict. What identifies a transfer?

**Follow-ups.**
1. A refund is issued after the first monthly payout was already released. What do you record, and how is the amount recovered from the host?
2. The payout run crashes halfway and is restarted. How do you make sure no host is paid twice? Name the key you would use.
3. Hosts are in many time zones. Which calendar decides the payout day, and what changes if it is the host's?
4. Finance proposes rounding the fee once per transfer instead of once per payout. Who gains, by how much at most, and how would you show it?

**Follow-up rules.**
- when: round(, half even, banker → ask: Which rounding mode does Python's round use, and where else in a payments codebase would you look for the same mistake?
- when: decimal, float → ask: Would Decimal with ROUND_HALF_UP fix this on its own? What does dividing a float before rounding do to very large amounts?
- when: ceil, period count, number of periods → ask: Is the right number of periods enough, or can a period inside the stay still have no paid night?
- when: composite key, tuple key, (day, host) → ask: A host has listings paid in two currencies. Is (day, host) still the right key for a transfer?
- when: idempotent, idempotency, retry → ask: Which key makes one payout safe to send twice: the booking, the period, or the transfer? Why?

**Evaluation Criteria.** Finds and explains every bug with its host-facing symptom; transfers keyed by host and day; fees rounded half up with integer arithmetic; refunded nights removed from the end of a long stay; the cleaning fee kept on a partial refund and refunded only with every night; no payout for an empty period; fixes that stay minimal and linear; a test per bug.

## ABB-L2-04: One calendar from many writers — the host app, channel managers and imported calendars

| | |
|---|---|
| **Template ID** | ABB-L2-04 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data pipelines / availability as a source of truth, conditional writes, polled external feeds, reconciliation |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, staff-data-engineer, data-architect |

```params
{
  "listings": {"2": ["400,000", "1.2 million"], "3": ["5 million", "8 million"]},
  "external_share": ["20%", "35%", "50%"],
  "import_refresh": ["every 15 minutes", "every hour", "every 3 hours"],
  "peak_writes": {"2": ["2,000 a second", "5,000 a second"], "3": ["30,000 a second", "60,000 a second"]}
}
```

**Business Scenario.** A stays marketplace has {{listings}} active listings. Hosts change availability in three ways: in the marketplace's own host app; through channel managers, software-connected tools that manage a host's listings on several sites through an API; and by importing calendar feeds from other sites they list on. About {{external_share}} of listings use a channel manager or an imported calendar. In this exercise, imported feeds are fetched {{import_refresh}}, and the marketplace also exports a feed of its own bookings for other sites to import. Availability writes, bookings included, peak at {{peak_writes}}. Hosts complain about double bookings: two guests with the same nights, one booked here and one booked elsewhere, or two booked here through different routes.

**Problem Statement.** Design the availability system. Cover the source of truth for each listing-night and its states (free, held, booked, blocked by the host, blocked by an import); how a booking request takes its nights atomically; how writes from the host app, the channel-manager API and imported feeds are applied, with ordering, retries and conflicts; how the search index and the exported feed learn about changes; how a double booking that still happens, because an imported feed was stale, is detected and resolved; and the metrics that show which route causes conflicts.

**Constraints.** Two confirmed stays made here must never overlap. Imported feeds can be stale for up to {{import_refresh}}, and they carry only date ranges with an event identifier, not guests or prices. Channel managers retry and can deliver updates out of order. A booking request must be answered within a second. Search may lag by a few seconds but must not show booked nights as free for long.

**Assumptions.** All volumes, intervals and rules are hypothetical. Nights are half-open: a check-out day can be the next guest's check-in day. A booking request that needs the host's approval holds its nights for up to 24 hours in this exercise. Each channel manager sends either full snapshots of a date range or individual changes, with its own timestamps.

**Clarifications.**
- Q: Is the marketplace the source of truth for nights booked elsewhere? | A: No. It learns about them only through imports or channel managers. It is the source of truth for bookings made on it.
- Q: Can a host block a night that is already booked here? | A: No. The write is refused, and the host is told why.
- Q: What happens to an import that says a night is busy when we already have a confirmed booking for it? | A: That is a conflict to record and resolve. Neither side is silently overwritten.
- Q: Do channel managers send deltas or snapshots? | A: Both kinds exist. Your design should handle both.
- Q: How fresh must the exported feed be? | A: As fresh as you can make it, because other sites poll it on their own schedule.

**Hints.**
1. Store availability per listing and night, with a version per listing. Make every booking a conditional write over its whole range, so that two requests for overlapping nights cannot both succeed.
2. Keep imported blocks as their own layer, keyed by feed and event identifier, and apply each fetch as a diff against the last one. Do not mix them into host blocks.
3. Make every external write idempotent and ordered per listing: a sequence number or a version you compare, never the arrival order.

**Follow-ups.**
1. A guest books here while an imported feed still shows the nights free; ten minutes later the other site confirms its own guest for the same nights. Who learns about the conflict first, how fast, and what happens to each guest?
2. A channel manager retries a batch after a timeout, and an older snapshot of a date range arrives after a newer one. Walk through what your system stores.
3. How would you shrink the exposure window for listings that use imported calendars, without fetching every feed every minute?
4. Measure it: what is the double-booking rate per route, and how would you show hosts which of their connections causes conflicts?

**Follow-up rules.**
- when: lock, mutex, select for update → ask: What exactly does your lock cover: a listing, a night or a range? What happens to a 90-night request while hundreds of 2-night requests for the same listing arrive?
- when: exclusion constraint, daterange, tstzrange → ask: How does that constraint treat a 24-hour request hold that expires, and nights blocked by an import?
- when: cache, redis → ask: The cache says a night is free and the database says it is booked. Which one wins at booking time, and which one does search use?
- when: poll, polling, webhook → ask: With imports fetched {{import_refresh}}, what is your exposure window, and how would you shorten it for listings in high demand?
- when: last write wins, timestamp → ask: Whose clock does the timestamp come from, and what happens when a channel manager's clock is five minutes behind?

**Production Reality Check.**
- A popular calendar provider slows down, and fetches of imported feeds, normally done {{import_refresh}}, fall an hour behind for a whole region; double bookings in that region rise the same evening.
- A channel manager deploys a bug and sends full-year snapshots marking every night free for 3 000 listings, including nights booked here.
- The search index misses a batch of availability changes after a consumer restart, and booked nights appear as free for twenty minutes.

**Evaluation Criteria.** A clear source of truth per listing-night with explicit states; atomic, conditional booking writes over a whole range; request holds that expire safely; imported blocks kept as a separate, diffed layer; idempotent, ordered external writes with versions rather than arrival order; a host block refused over a confirmed booking; change events that keep search and the exported feed fresh; conflict detection with a resolution workflow and a route recorded on each conflict; metrics per route; a plan for each incident.

## ABB-L2-05: Cancellations and refunds, by booking date and by stay date

| | |
|---|---|
| **Template ID** | ABB-L2-05 |
| **Loop** | 2 |
| **Kind** | design |
| **Topic** | Data modelling for analytics / booking lifecycle events, night-level facts, restatement, two reporting grains |
| **Difficulty** | Hard, Very Hard |
| **Minutes** | 45 |
| **Roles** | data-engineer, senior-data-engineer, staff-data-engineer, analytics-engineer, data-architect |

```params
{
  "bookings_per_day": {"2": ["150,000", "400,000"], "3": ["1.5 million", "3 million"]},
  "policies": [3, 4, 6],
  "currencies": [12, 40],
  "booking_window": ["up to 12 months", "up to 24 months"]
}
```

**Business Scenario.** A stays marketplace takes about {{bookings_per_day}} bookings a day in {{currencies}} currencies, made {{booking_window}} before check-in. Each listing has one of {{policies}} cancellation policies that this exercise defines (for example its own flexible, moderate and strict rules), which set the refund by how many days before check-in the guest cancels. Guests and hosts can also alter a booking: change its dates, its number of guests or its price. Two teams ask for the same numbers in different shapes. The marketplace-health team wants cancellation rates **by booking date**: of the bookings made in a week, how many were later cancelled and how much was refunded. The finance and host-insights teams want the same events **by stay date**: how many booked nights in a month were lost to cancellations, and the revenue that went with them.

**Problem Statement.** Design the data model and the pipeline that produce both views from the same facts. Cover the source events (booking created, altered, cancelled, refunded) and how they land; how a booking's history is kept so that any past state can be rebuilt; a night-level fact and how alterations move nights between dates; how refunds that arrive later or in parts are attached; how the cancellation policy in force at booking time is recorded; currencies; how a late event restates past reporting periods and what each team sees when it does; and metric definitions that let the two views reconcile.

**Constraints.** A booking can be altered several times and then cancelled; a refund can be partial and can arrive days after the cancellation. Events can arrive late or twice. A report for a closed month may change only through a recorded restatement. The two views must agree on totals over any range that covers both all booking dates and all stay dates of the bookings involved.

**Assumptions.** All volumes, policies and rules are hypothetical; cancellation and refund policies are defined by the exercise and are not quoted from any current policy. Every event carries a booking id, an event id, an event time and the amount in the booking's currency in minor units. Daily exchange rates are available.

**Clarifications.**
- Q: Is a booking whose dates were altered a new booking? | A: No. It keeps its id and its booking date. Its nights move.
- Q: Does a cancellation always refund everything? | A: No. The refund depends on the policy recorded at booking time and on when the guest cancelled, and it can be partial.
- Q: Which date is the booking date of an altered booking? | A: The date it was first made. The alteration has its own event date.
- Q: What does the stay-date view count for a booking cancelled after check-in? | A: The nights not stayed, which this exercise treats as the last nights of the stay.
- Q: Are host cancellations in scope? | A: Yes, as a separate reason: the guest is refunded in full and the host's record is affected.

**Hints.**
1. Keep an append-only event log per booking, and build a versioned booking-state table from it, with valid-from and valid-to times, so any past state can be rebuilt.
2. A night-level fact (one row per booking and stay night, with its amount and status) answers stay-date questions directly. An alteration ends some rows and starts others.
3. Decide the grain of each metric before the table: "cancelled bookings by booking week" and "nights lost by stay month" need different denominators.

**Follow-ups.**
1. A refund for a booking made six weeks ago arrives today. Which partitions of each view change, and what does each team see?
2. A booking is shortened from 7 nights to 4, then cancelled. Walk through the night rows and the refund at each step.
3. Rates are reported in one currency. Which day's rate do you use for a refund made 60 days after the booking, and why might the two views disagree because of it?
4. Data science wants to train a cancellation model on this data. What must they not read from your tables to avoid leaking the future into training rows?

**Follow-up rules.**
- when: snapshot, daily snapshot → ask: A booking is altered twice in one day. What does a daily snapshot miss, and does it matter for either view?
- when: scd, valid_from, valid_to → ask: An alteration event arrives two days late. Which versions do you close and reopen, and what does a report run yesterday now show?
- when: night-level, nights table, per night, explode → ask: At {{bookings_per_day}} bookings a day made {{booking_window}} ahead, how many night rows exist at once, and how do you partition them?
- when: overwrite, update in place → ask: Finance closed last month. How do you change a number in it without losing the version they already reported?
- when: exchange rate, fx, conversion → ask: Do you convert at the booking date, the cancellation date or the refund date? What does each choice do to a cancellation rate measured in money?

**Production Reality Check.**
- A payments outage delays refund events in 3 of the {{currencies}} currencies by four days; the by-booking-date view shows refund amounts dropping and then jumping back.
- A bug in the alteration service sends every date change twice, a minute apart, with different event ids.
- A policy is renamed in the listing settings and every booking made under its old name loses its policy in the night-level fact.

**Evaluation Criteria.** An append-only event log with idempotent landing; a versioned booking state with valid times; a night-level fact that alterations update by ending and starting rows; refunds attached by booking and event, partial and late; the policy recorded at booking time; explicit metric grains and denominators for each view, and a reconciliation between them; restatements of closed periods recorded and explained; a deliberate currency rule; protection against leakage for model training; a plan for each incident.
