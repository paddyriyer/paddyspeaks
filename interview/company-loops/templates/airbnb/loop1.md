# Airbnb · Loop 1 — SQL + DSA

Simulated practice scenarios set in the public product domain of a marketplace for
stays and experiences: listings and their calendars, bookings, prices, search, reviews,
hosts and guests. Every workload, number, rule, name and schema is hypothetical; the
cancellation rules in particular are this exercise's own, not any current policy.
Format: docs/COMPANY-INTERVIEW-LOOPS.md.

## ABB-L1-01: Occupancy by city and month, with stays that cross month boundaries

| | |
|---|---|
| **Template ID** | ABB-L1-01 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / date ranges split across months, half-open intervals, availability denominators |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | ABB-L1-01.mjs |

**Business Scenario.** A stays marketplace shows hosts and its own market teams how full listings are: of the nights a listing could have been booked, how many were. The report is per city and calendar month, for {{window}}. Hosts block nights they do not want to rent (their own use, repairs), and a blocked night was never on offer, so it must not count against occupancy. Stays are stored as a check-in and a check-out date, and many run across the end of a month, or across the edges of the report window.

**Problem Statement.** Write one PostgreSQL query that returns `city, month, booked_nights, available_nights, occupancy`: one row per city and calendar month inside the window [`{{start_date}}`, `{{end_date}}`) that has at least one available night, ordered by `city, month`. `month` is the first day of the month, as a `DATE`. A night is a date; a reservation occupies the nights `check_in <= night < check_out`, and a block covers `start_date <= night < end_date`. A night is **booked** when a reservation with `status = 'confirmed'` occupies it (cancelled reservations occupy nothing). A night of a listing is **available** when the listing is listed that night and the night is booked or not blocked. `occupancy = booked_nights / available_nights`, rounded to 4 decimal places. {{listing_rule}} {{block_rule}}

**Constraints.** One SQL statement (CTEs allowed). Confirmed reservations of one listing never overlap each other. Nights outside the window never count, even for a stay that crosses one of its edges. The sample has {{listings}} listings and {{reservations}} reservation rows.

**Assumptions.** Cities, listings, dates and blocks are hypothetical. Dates are the listing's local calendar dates, so there is no time zone to convert. Occupancy can be defined in several ways (over all calendar nights, over available nights, weighted by revenue); this exercise uses booked over available nights, as defined above.

**Clarifications.**
- Q: A stay checks in on 30 June and checks out on 3 July. Which months get its nights? | A: June gets one night (30 June); July gets two (1 and 2 July). The check-out date is not a night of the stay.
- Q: A city has available nights in a month but no bookings. Is it in the result? | A: Yes, with `booked_nights` 0 and occupancy 0.
- Q: Two blocks cover the same night. Is it blocked twice? | A: No. A night is blocked or it is not.
- Q: A listing has every night of a month blocked and nothing booked. | A: It adds nothing to that month's available nights. A city-month with no available nights at all has no row.
- Q: How is occupancy rounded? | A: `ROUND(…, 4)` of the exact ratio, half away from zero.

**Hints.**
1. Think in nights, not stays: once you have one row per listing and night, splitting stays across months is just grouping by the night's month.
2. Build each listing's nights from its listed range clipped to the window (`generate_series`), then mark every night booked or blocked with `EXISTS`.
3. `COUNT(*) FILTER (WHERE …)` gives booked and available nights in one pass; keep the denominator `booked OR NOT blocked`.

**Follow-ups.**
1. Your night grid has one row per listing per night. For several million listings over a year that is billions of rows. How would you compute the same numbers from interval overlaps instead, without expanding nights?
2. A reservation is cancelled two months after the stay's month closed, and the report was already sent. Do you restate the past month, and how do the report's readers find out?
3. Market teams also want occupancy over all calendar nights and revenue-weighted occupancy. How would you name and version these definitions so two dashboards never silently disagree?
4. A host blocks the whole summer. Should that listing's 0 / 0 months affect the city at all, and how would you stop a few heavily blocked listings from distorting a small city's figure?

**Follow-up rules.**
- when: generate_series → ask: How many rows does your night grid have for a year of a market with 50 000 listings, and could you get the same counts from interval overlaps instead?
- when: date_trunc('month', check_in), check_in month, month of check_in → ask: Which month gets the nights of a stay that checks in on 30 June and checks out on 3 July?
- when: check_out - check_in, length of stay, sum of nights → ask: A stay starts five days before the window and ends inside it. How many of its nights does your sum count?
- when: inner join → ask: A city has availability in a month but no bookings at all. Does your join keep that row?
- when: overlap, overlapping blocks → ask: Two blocks cover the same night, and a third covers a booked night. How many times does your query subtract each?

**Evaluation Criteria.** Thinks in nights with half-open stays and blocks; splits stays across months and clips them to the window; confirmed reservations only; blocked nights out of the denominator, counted once even when blocks overlap; booked nights stay available whatever covers them (Very Hard); listed ranges respected (Hard+); zero-booking months kept; correct rounding and deterministic order; can discuss interval arithmetic at scale, restatements and metric definitions.

## ABB-L1-02: Refunds owed under this exercise's flexible, moderate and strict cancellation rules

| | |
|---|---|
| **Template ID** | ABB-L1-02 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / rule tables, choosing the applicable tier, timestamp arithmetic, money in integer cents |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, software-engineer |
| **Generator** | ABB-L1-02.mjs |

**Business Scenario.** On a stays marketplace each host picks a cancellation policy for their listing, and a guest who cancels gets back an amount that depends on the policy and on how much notice they gave. Finance needs, for every cancelled booking, the amount owed back, so it can reconcile what was actually refunded. The policies below are this exercise's own rules, stored in a table (check current docs for any real marketplace's policies): flexible pays 100% of the nightly amount plus the service fee with at least {{flexible_days}} days' notice and 50% otherwise; moderate pays 100% plus the service fee with at least {{moderate_days}} days' notice and {{moderate_pct}}% otherwise; strict pays 50% with at least {{strict_days}} days' notice and nothing otherwise.

**Problem Statement.** Write one PostgreSQL query that returns `booking_id, policy, days_before, nightly_refund_pct, refund_cents`: one row per booking with at least one row in `cancellations`, ordered by `booking_id`. `days_before` is the whole days of notice, `floor((check_in − cancelled_at) / 1 day)` (negative after check-in). A tier of the booking's policy **applies** when `days_before >= min_notice_days`. The booking gets the applicable tier with the highest `nightly_refund_pct`, reported as `nightly_refund_pct`. For a cancellation before `check_in`: `refund_cents = nights × nightly_cents × nightly_refund_pct / 100`, rounded half up to whole cents, plus `cleaning_cents` in full, plus `service_fee_cents` if the tier's `service_fee_refunded`. {{grace_rule}} {{dup_rule}} {{stay_rule}}

**Constraints.** One SQL statement (CTEs allowed). Amounts are integer cents and the result must be exact. Every policy has a tier with `min_notice_days = 0` and no booking window, so some tier always applies before check-in; tiers of one policy never share a percentage. All timestamps are UTC.

**Assumptions.** Policies, tiers, prices and fees are hypothetical and much simpler than any real marketplace's rules (no taxes, no currencies, no host-initiated cancellations, no special circumstances). The tier table is the single source of the rules: a correct query keeps working when finance adds a tier.

**Clarifications.**
- Q: Check-in is at 15:00 on the 20th and the guest cancels at 15:00 on the 13th. How many days of notice? | A: Exactly 7, so a 7-day tier applies. At 15:00:01 on the 13th it is 6.
- Q: Is the cleaning fee refunded? | A: In full, for any cancellation before check-in.
- Q: How is a half cent rounded? | A: Half up: 12 345.5 cents becomes 12 346.
- Q: Several tiers apply. Which one counts? | A: The one with the highest `nightly_refund_pct`; its own `service_fee_refunded` decides the service fee.
- Q: Should bookings that were never cancelled appear? | A: No. Only bookings with at least one cancellation event.

**Hints.**
1. Reduce `cancellations` to one row per booking first.
2. Join each booking to every tier of its policy that applies, then keep the most generous one per booking (`DISTINCT ON` or `ROW_NUMBER`).
3. Do the money in integers: `(nights * nightly_cents * pct + 50) / 100` rounds half up without floating point.

**Follow-ups.**
1. A host changes the listing's policy after a guest has booked. Which policy should apply, and what would you store on the booking to make this query right?
2. Guests pay in many currencies, and a refund paid a week later meets a different exchange rate. In which currency is the amount owed fixed, and where?
3. Support also issues partial refunds and goodwill credits on top of the policy. How would you model refunds so finance can reconcile owed against paid, booking by booking?
4. The rules themselves change (a new tier for long stays next quarter). How would you version `policy_tiers` so last year's refunds can be recomputed exactly?

**Follow-up rules.**
- when: max(cancelled_at), last cancellation, latest event → ask: A booking has two cancellation events: a retry logged later with an earlier timestamp. Which one decides the notice, and how does your query pick it?
- when: round(, ::float, double precision → ask: Where in your arithmetic can a half cent appear, which way must it round, and could floating point move it?
- when: case when → ask: Your tiers are written into a CASE expression. What happens next quarter when finance adds a tier to the table?
- when: ::date, date_part, age( → ask: The guest cancels at 23:00 on the 13th for a 15:00 check-in on the 20th. How many whole days of notice does your expression give?

**Evaluation Criteria.** One cancellation per booking (the earliest, Hard+); notice in whole days with the boundary inclusive; rules read from the tier table, the most generous applicable tier chosen; the booking-window condition on the grace tier (Hard+); integer money with half-up rounding; cleaning fee and the tier's service fee; mid-stay cancellations refund only nights not begun, at the base tier, without fees (Very Hard); can discuss policy changes, currencies, reconciliation and rule versioning.

## ABB-L1-03: Host response time: median minutes to the first real reply

| | |
|---|---|
| **Template ID** | ABB-L1-03 |
| **Loop** | 1 |
| **Kind** | sql |
| **Topic** | Analytical SQL / first qualifying event per thread, medians with PERCENTILE_CONT, denominators with unanswered rows |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | data-engineer, senior-data-engineer, analytics-engineer, data-architect |
| **Generator** | ABB-L1-03.mjs |

**Business Scenario.** Guests often message a host before booking, and how quickly hosts answer shapes whether the guest books at all. The marketplace shows hosts their own response time and the share of inquiries they answered within a day. The message log is noisy: hosts can turn on automated replies that fire within seconds, guests send follow-ups before anyone answers, and support sometimes joins a thread. None of those is a host answering.

**Problem Statement.** Write one PostgreSQL query that returns `host_id, inquiries, answered, within_24h, share_within_24h, median_response_minutes`, one row per host, ordered by `host_id`. An inquiry's **first reply** is the earliest message on that inquiry with `is_automated = false` sent by the inquiry's host side. Its response time is `sent_at − created_at` in minutes (whole minutes in this data). `answered` counts inquiries with a first reply; `within_24h` counts those answered within 1440 minutes, inclusive; `share_within_24h = within_24h / inquiries`, rounded to 4 places. `median_response_minutes` is the median response time over answered inquiries (the average of the two middle values when their number is even), as a numeric rounded to 1 decimal place, or NULL when none was answered. {{scope_rule}} {{host_rule}}

**Constraints.** One SQL statement (CTEs allowed). The guest's opening message is in `messages` too, sent at `created_at` by the guest. A host can reply several times; only the first real reply counts.

**Assumptions.** Hosts, guests, inquiries and timings are hypothetical. The definition of response time here (clock minutes, no pause overnight, first non-automated host-side message) is this exercise's; a production metric would document its own.

**Clarifications.**
- Q: The host's automated reply arrives in 30 seconds and the host writes personally 3 hours later. What is the response time? | A: 180 minutes. Automated messages are never replies, even when sent from the host's account.
- Q: Does a reply at exactly 24 hours count as within 24 hours? | A: Yes. 1440 minutes is within.
- Q: Do unanswered inquiries count? | A: In `inquiries` and in the share's denominator, yes. They have no response time, so they are not in the median.
- Q: Four answered inquiries took 10, 20, 40 and 300 minutes. What is the median? | A: 30.0, the average of 20 and 40 (`PERCENTILE_CONT(0.5)`).
- Q: A reply is sent after the reporting window ends. Does it count? | A: Yes. The window selects inquiries by `created_at`; replies count whenever they came.

**Hints.**
1. Compute one row per inquiry first: its host and the time of its first qualifying reply (NULL if none). A LEFT JOIN keeps the unanswered ones.
2. `MIN(sent_at)` over the qualifying messages is the first reply; filter the messages before taking the minimum, not after.
3. `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY minutes)` ignores NULLs, which is exactly what the median needs.

**Follow-ups.**
1. An inquiry arrives at 3 a.m. in the host's time zone. Should the clock pause overnight, and what would that do to the metric's meaning and its computation?
2. Phones send messages late when they were offline. Which timestamp would you trust for `sent_at`, and how would you restate a host's figure when late messages arrive?
3. This must refresh daily for millions of hosts. What state per open inquiry lets you update it incrementally instead of rescanning every message?
4. A guest books instantly a minute after asking, and the host never replies. Should that inquiry count against the host, and how would you encode the decision?

**Follow-up rules.**
- when: avg(, average, mean → ask: Two inquiries were answered in 5 minutes and one in three days. What do the mean and the median say, and which describes a typical guest's wait?
- when: percentile_disc → ask: With an even number of answered inquiries, which value does PERCENTILE_DISC return, and does it match the definition here?
- when: min(sent_at), first message, row_number → ask: Does your first message skip the guest's own follow-ups and the automated replies before the minimum is taken?
- when: inner join → ask: An inquiry was never answered. Is it still in your `inquiries` count and the share's denominator?
- when: count(minutes), count(*) → ask: Which of your counts includes unanswered inquiries, and which does not?

**Evaluation Criteria.** First reply restricted to the host side and non-automated messages, filtered before the minimum; unanswered inquiries kept in counts and the denominator; 24 hours inclusive; a true median with the even case averaged; the reporting window on `created_at` with late replies still counting and the minimum-inquiries floor (Hard+); co-host replies credited to the listing's host (Very Hard); can discuss time zones, late data and incremental computation.

## ABB-L1-04: Orphan nights: calendar gaps shorter than the minimum stay

| | |
|---|---|
| **Template ID** | ABB-L1-04 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Intervals / sort, merge and scan per key, gaps between occupied runs |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 30 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, analytics-engineer |
| **Generator** | ABB-L1-04.mjs |

**Business Scenario.** A host sets a minimum stay, say three nights. When two bookings leave a two-night hole between them, nobody can ever book it: an **orphan gap**. Pricing tools suggest relaxing the minimum stay or discounting exactly those nights, so they first need every orphan gap of every listing, computed nightly across the whole calendar.

**Problem Statement.** Implement `orphan_gaps(min_stay, bookings, blocks)`. `min_stay` maps each listing id to its minimum stay in nights (at least 1). `bookings` holds `(listing_id, check_in, check_out, status)`, occupying the nights `check_in <= n < check_out`; nights are integers (day numbers). `blocks` holds `(listing_id, start, end)` in the same half-open form. A listing's occupied nights form runs; a **gap** is the free nights between two consecutive runs, and it is orphan when `0 < length < min_stay[listing]`. Free nights before the first run or after the last are never a gap. Return `{listing_id: [(gap_start, gap_end), ...]}` for every listing in `min_stay`, each list sorted by `gap_start` and holding half-open ranges; a listing with no orphan gap maps to `[]`. {{status_rule}} {{block_rule}} {{order_rule}}

**Constraints.** Up to 4 000 listings with 100 or more bookings each, calendars of several hundred nights. Checking every booking for every night of every calendar is too slow; aim for O(n log n) in the number of bookings and blocks.

**Assumptions.** Listings, minimum stays and calendars are hypothetical. Minimum stay is one number per listing here; real products let it vary by date and by check-in day.

**Clarifications.**
- Q: Two bookings are back to back (one checks out on the day the next checks in). Is there a gap? | A: No. The gap has length 0.
- Q: The minimum stay is 3 and the gap is exactly 3 nights. Orphan? | A: No. Somebody can book it. Only gaps shorter than the minimum.
- Q: What about the free nights before the first booking? | A: Never a gap: they are not between two runs.
- Q: What is the length of the gap `(5, 7)`? | A: Two nights, 5 and 6.
- Q: Can I return listings in any order? | A: Yes; it is a dict. The gaps inside each list must be sorted.

**Hints.**
1. Group the intervals by listing, then sort each group by start.
2. Walk the sorted intervals keeping the end of the current occupied run; an interval that starts after it opens a gap, and the run's end is the maximum end seen so far, not the last interval's end.
3. A nested interval (a short booking inside a long block) must not move the run's end backwards.

**Follow-ups.**
1. Minimum stay varies by date (longer in summer) and by check-in weekday. Which minimum applies to a gap, and what changes in your scan?
2. The calendar changes all day as bookings arrive and cancel. How would you update the orphan gaps of one listing incrementally rather than recomputing it?
3. As a batch job over every listing on the platform, where would this run, and how would you partition it so one huge listing group does not dominate?
4. Suppose the pricing tool discounts orphan nights. How would you measure whether that sold nights that would otherwise stay empty, rather than discounting nights that would have sold anyway?

**Follow-up rules.**
- when: for night in range, for each night, every night → ask: How many night-by-booking checks is that for 4 000 listings with 100 bookings over 700 nights each?
- when: set(), nights set, mark → ask: Marking nights works. What does it cost in memory and time when a calendar spans two years, and what does sorting intervals cost instead?
- when: prev_end, previous end, last end → ask: A short booking sits entirely inside a long host block. What does your previous-end variable hold after it?
- when: sorted(, .sort( → ask: What exactly do you sort, by which key, and how many separate sorts does the whole run do?

**Evaluation Criteria.** Groups by listing and sorts once per group; merges overlapping and touching intervals with a running maximum end; gaps only between runs, with `0 < length < min_stay`; half-open arithmetic without off-by-one; cancelled bookings ignored (Hard+); blocks merged with bookings and unknown listings ignored (Very Hard); every listing present in the output; O(n log n) argued; sensible incremental and batch designs.

## ABB-L1-05: Map search across the antimeridian, sorted by price and paged

| | |
|---|---|
| **Template ID** | ABB-L1-05 |
| **Loop** | 1 |
| **Kind** | python |
| **Topic** | Spatial indexing / grid buckets, longitude wrap-around, sort and paginate |
| **Difficulty** | Medium, Hard, Very Hard |
| **Minutes** | 35 |
| **Roles** | software-engineer, data-engineer, senior-data-engineer, ml-platform-engineer |
| **Generator** | ABB-L1-05.mjs |

**Business Scenario.** Guests search a stays marketplace by dragging a map: every pan or zoom sends the visible rectangle, and the result list shows the listings inside it, cheapest first, a page at a time. Most viewports are small, over one city, but some sit over Fiji or the Chukotka coast, where the map's west edge is at +179° and its east edge at −179°: the viewport crosses the antimeridian, and a naive "west ≤ longitude ≤ east" test finds nothing.

**Problem Statement.** Implement `search_map(listings, queries)`. Each listing is `(listing_id, lat, lng, nightly_price)` with `lng` in [−180, 180) and an integer price. Each query is `(south, west, north, east, page, page_size, max_price)`. A listing matches when `south <= lat <= north` and its longitude is inside the viewport: if `west <= east`, `west <= lng <= east`; if `west > east`, the viewport crosses the antimeridian and `lng >= west or lng <= east`. Matches are sorted by `nightly_price`, then `listing_id`; `page` is 0-based. For each query return `(total_matches, ids)` where `ids` are the listing ids on that page (empty past the end). Return one tuple per query, in order. {{invalid_rule}} {{price_rule}}

**Constraints.** Up to 60 000 listings and 6 000 queries per call, nearly all viewports a fraction of a degree across. Testing every listing for every query is too slow; build an index once and make each query's work depend on the listings near its viewport.

**Assumptions.** Listings, prices and coordinates are hypothetical. Latitude and longitude are treated as a flat rectangle grid; real map search projects coordinates, ranks by more than price and returns pins and a list separately.

**Clarifications.**
- Q: Are the edges of the viewport inclusive? | A: Yes, all four.
- Q: How do I know a viewport crosses the antimeridian? | A: `west > east`. A viewport with `west == east` is one meridian wide.
- Q: Two listings have the same price. | A: The smaller `listing_id`, compared as a string, comes first.
- Q: The page is past the last match. | A: Return the total and an empty list.
- Q: Does each query get its own result even when two are identical? | A: Yes. One tuple per query, in order.

**Hints.**
1. Bucket listings into grid cells of a fixed size (a fraction of a degree) keyed by `(floor(lat / size), floor(lng / size))`, once.
2. A viewport touches a rectangle of cells; one that crosses the antimeridian touches two column ranges, from `west` to the last column and from the first column to `east`.
3. Cells only give candidates: test each candidate exactly against the viewport before sorting. If a viewport would touch more cells than exist, loop over the occupied cells instead.

**Follow-ups.**
1. Listing density varies by orders of magnitude between a city centre and the countryside. How would you choose cell sizes, or switch to a structure that adapts (a quadtree, geohash prefixes)?
2. Most map moves are small pans. How would you reuse the previous viewport's work, and what would you cache?
3. Price is the nightly price, but guests see the total for their dates. How does sorting by a date-dependent total change the index and the paging?
4. Deep pages are rare but expensive. How would cursor-based paging (after the last price and id seen) compare with page numbers when listings change between requests?

**Follow-up rules.**
- when: for listing in listings, every listing, all listings → ask: How many coordinate checks is that for 6 000 viewports over 60 000 listings?
- when: west <= lng <= east, between west and east → ask: A viewport has west = 179.5 and east = −179.5. What does your condition return for a listing at longitude 179.9?
- when: haversine, distance, radius → ask: The viewport is a rectangle in latitude and longitude. Does a distance from its centre select the same listings?
- when: offset, page * page_size → ask: A new listing appears between a guest's page 1 and page 2. What happens to the listing that was last on page 1?
- when: kd-tree, quadtree, r-tree → ask: What does your tree do with a viewport that crosses the antimeridian?

**Evaluation Criteria.** Inclusive bounds; correct wrap-around when `west > east`, including longitude −180; sorting by price then id and 0-based paging with the total; the sentinel `(0, [])` for invalid queries (Hard+); `max_price` inclusive (Very Hard); an index built once with per-query work proportional to nearby listings, and exact filtering of candidates; can discuss density-adaptive indexes, caching and cursor paging.
